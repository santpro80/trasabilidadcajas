import { db, doc, getDoc, collection, getDocs, query, where, requireDepositoAuth } from './firebase-config-deposito.js';

let selectedWarehouse = ''; // 'no_esteril_terminado' | 'esteril_terminado' | 'semi_elaborado' | 'materia_prima'
let selectedWarehouseLabel = '';
let depositoItemsCache = [];
let currentUser = null;
let currentItemCode = null;
let movimientosData = []; // Movimientos de la pieza seleccionada en "Buscar por Código"
let allWarehouseMovements = []; // Caché completo de movimientos del depósito actual
let lastCacheSyncAt = 0;

// Paginación y estado para "Productos que Más Salen"
const TOP_PAGE_SIZE = 100;
let currentTopLimit = TOP_PAGE_SIZE;
let currentTopRanking = [];

// Variables de gráficos Chart.js
let chartSemanal = null;
let chartMensual = null;
let chartAnual = null;
let chartTopProductos = null;

const THEME = {
    ingreso: {
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgb(16, 185, 129)'
    },
    egreso: {
        bg: 'rgba(239, 68, 68, 0.2)',
        border: 'rgb(239, 68, 68)'
    },
    top: {
        bg: 'rgba(59, 130, 246, 0.25)',
        border: 'rgb(59, 130, 246)'
    },
    grid: 'rgba(148, 163, 184, 0.1)',
    text: '#94a3b8'
};

const getMasterDoc = () => `master_catalog_${selectedWarehouse}`;
const getCacheKey = () => `villalba_items_cache_${selectedWarehouse}`;
const getMovimientosCollection = () => `deposito_movimientos_${selectedWarehouse}`;
const getMovimientosCacheKey = (wh = selectedWarehouse) => `villalba_movs_cache_v1_${wh}`;

// ============================================================================
// CACHÉ PERSISTENTE (IndexedDB con fallback a localStorage) + DELTA SYNC
// ============================================================================
const IDB_NAME = 'villalba_deposito_stats_db';
const IDB_STORE = 'movements_cache';
const CACHE_SYNC_TTL_MS = 1000 * 60 * 10; // 10 minutos sin volver a consultar si ya sincronizó

const openStatsIDB = () => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB no soportado'));
            return;
        }
        const req = window.indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains(IDB_STORE)) {
                idb.createObjectStore(IDB_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
};

const readMovementsCache = async (warehouse) => {
    const key = getMovimientosCacheKey(warehouse);
    try {
        const idb = await openStatsIDB();
        return await new Promise((resolve) => {
            const tx = idb.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.payload : null);
            req.onerror = () => resolve(null);
        });
    } catch (_) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (__) {
            return null;
        }
    }
};

const writeMovementsCache = async (warehouse, payload) => {
    const key = getMovimientosCacheKey(warehouse);
    try {
        const idb = await openStatsIDB();
        await new Promise((resolve, reject) => {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put({ key, payload });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    } catch (_) {
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.warn('No se pudo guardar caché en localStorage:', e);
        }
    }
};

const parseMovementTimestampMs = (d) => {
    const raw = d.timestamp || d.fecha;
    if (!raw) return 0;
    if (typeof raw.toMillis === 'function') return raw.toMillis();
    if (typeof raw.toDate === 'function') return raw.toDate().getTime();
    if (typeof raw.seconds === 'number') {
        return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
    }
    if (typeof raw === 'number') return raw;
    const parsed = new Date(raw).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

const normalizeMovementDoc = (docSnap) => {
    const d = docSnap.data();
    const timestampMs = parseMovementTimestampMs(d);
    return {
        id: docSnap.id,
        codigo: String(d.codigo || '').trim().toUpperCase(),
        descripcion: String(d.descripcion || '').trim(),
        tipo: d.tipo || '',
        cantidad: Number(d.cantidad) || 0,
        timestampMs
    };
};

const formatSyncStatus = (syncTimeMs, totalMovs) => {
    if (!syncTimeMs) return `${totalMovs} movimientos en caché`;
    const diffSec = Math.max(0, Math.floor((Date.now() - syncTimeMs) / 1000));
    let haceStr = ' recién';
    if (diffSec >= 60 && diffSec < 3600) {
        haceStr = ` hace ${Math.floor(diffSec / 60)} min`;
    } else if (diffSec >= 3600) {
        haceStr = ` hace ${Math.floor(diffSec / 3600)} h`;
    }
    return `Caché activo (${totalMovs.toLocaleString('es-AR')} movs • act.${haceStr})`;
};

const updateCacheStatusLabels = (customText = null) => {
    const text = customText || formatSyncStatus(lastCacheSyncAt, allWarehouseMovements.length);
    const topStatus = document.getElementById('top-cache-status');
    const codeStatus = document.getElementById('code-cache-status');
    if (topStatus) topStatus.textContent = text;
    if (codeStatus) codeStatus.textContent = text;
};

/**
 * Carga los movimientos del depósito usando caché local e incrementando solo
 * los movimientos nuevos (delta sync) para ahorrar lecturas de Firestore.
 */
const ensureWarehouseMovementsLoaded = async (forceRefresh = false) => {
    if (!selectedWarehouse) return [];
    const targetWarehouse = selectedWarehouse;

    const iconTop = document.getElementById('icon-sync-top');
    const iconCode = document.getElementById('icon-sync-code');
    if (iconTop) iconTop.classList.add('animate-spin');
    if (iconCode) iconCode.classList.add('animate-spin');

    try {
        const cached = await readMovementsCache(targetWarehouse);

        if (cached && Array.isArray(cached.movements)) {
            allWarehouseMovements = cached.movements;
            lastCacheSyncAt = cached.lastSyncAt || 0;
            updateCacheStatusLabels();

            const isFresh = (Date.now() - lastCacheSyncAt) < CACHE_SYNC_TTL_MS;
            if (isFresh && !forceRefresh) {
                return allWarehouseMovements;
            }

            // Delta sync: leer únicamente movimientos posteriores a maxTimestampMs
            updateCacheStatusLabels('Verificando movimientos nuevos...');
            const maxTs = Number(cached.maxTimestampMs) || 0;
            let qs;
            if (maxTs > 0) {
                const q = query(
                    collection(db, `deposito_movimientos_${targetWarehouse}`),
                    where('timestamp', '>', new Date(maxTs))
                );
                qs = await getDocs(q);
            } else {
                qs = await getDocs(collection(db, `deposito_movimientos_${targetWarehouse}`));
            }

            if (!qs.empty) {
                const existingIds = new Set(allWarehouseMovements.map(m => m.id));
                let newMaxTs = maxTs;

                qs.docs.forEach(docSnap => {
                    const norm = normalizeMovementDoc(docSnap);
                    if (norm.timestampMs > newMaxTs) newMaxTs = norm.timestampMs;
                    if (!existingIds.has(norm.id)) {
                        existingIds.add(norm.id);
                        allWarehouseMovements.push(norm);
                    }
                });

                lastCacheSyncAt = Date.now();
                await writeMovementsCache(targetWarehouse, {
                    warehouse: targetWarehouse,
                    lastSyncAt: lastCacheSyncAt,
                    maxTimestampMs: newMaxTs,
                    movements: allWarehouseMovements
                });
            } else {
                lastCacheSyncAt = Date.now();
                await writeMovementsCache(targetWarehouse, {
                    ...cached,
                    lastSyncAt: lastCacheSyncAt
                });
            }

            updateCacheStatusLabels();
            return allWarehouseMovements;
        }

        // Primera carga histórica (no existe caché todavía para este depósito)
        updateCacheStatusLabels('Descargando historial por primera vez (se guardará en caché)...');
        const qs = await getDocs(collection(db, `deposito_movimientos_${targetWarehouse}`));
        let maxTs = 0;
        const loaded = qs.docs.map(docSnap => {
            const norm = normalizeMovementDoc(docSnap);
            if (norm.timestampMs > maxTs) maxTs = norm.timestampMs;
            return norm;
        });

        allWarehouseMovements = loaded;
        lastCacheSyncAt = Date.now();

        await writeMovementsCache(targetWarehouse, {
            warehouse: targetWarehouse,
            lastSyncAt: lastCacheSyncAt,
            maxTimestampMs: maxTs,
            movements: allWarehouseMovements
        });

        updateCacheStatusLabels();
        return allWarehouseMovements;
    } catch (error) {
        console.error('Error sincronizando caché de movimientos:', error);
        updateCacheStatusLabels('Usando datos en caché local');
        return allWarehouseMovements;
    } finally {
        if (iconTop) iconTop.classList.remove('animate-spin');
        if (iconCode) iconCode.classList.remove('animate-spin');
    }
};

// ============================================================================
// NAVEGACIÓN ENTRE PANTALLAS (DEPÓSITO -> MODO -> VISTA)
// ============================================================================
const hideAllScreens = () => {
    document.getElementById('warehouse-choice-screen')?.classList.add('hidden');
    const modeScreen = document.getElementById('mode-choice-screen');
    if (modeScreen) {
        modeScreen.classList.add('hidden');
        modeScreen.classList.remove('flex');
    }
    document.getElementById('stats-main-container')?.classList.add('hidden');
    document.getElementById('top-products-container')?.classList.add('hidden');
};

const showChoiceScreen = () => {
    selectedWarehouse = '';
    selectedWarehouseLabel = '';
    hideAllScreens();
    document.getElementById('warehouse-choice-screen')?.classList.remove('hidden');

    resetCodeSearchUI();
    if (chartTopProductos) {
        chartTopProductos.destroy();
        chartTopProductos = null;
    }

    depositoItemsCache = [];
    currentItemCode = null;
    movimientosData = [];
    allWarehouseMovements = [];
};

const showModeChoiceScreen = (warehouseName = selectedWarehouse, labelText = selectedWarehouseLabel) => {
    selectedWarehouse = warehouseName;
    selectedWarehouseLabel = labelText;

    const modeTitle = document.getElementById('mode-warehouse-title');
    if (modeTitle) {
        modeTitle.textContent = `Estadísticas: ${labelText}`;
    }

    hideAllScreens();
    const modeScreen = document.getElementById('mode-choice-screen');
    if (modeScreen) {
        modeScreen.classList.remove('hidden');
        modeScreen.classList.add('flex');
    }

    // Precargar catálogo de ítems del depósito seleccionado
    fetchListaItems();
};

const showCodeSearchMode = async () => {
    const titleText = document.getElementById('stats-title-text');
    if (titleText) {
        titleText.textContent = `Por Código: ${selectedWarehouseLabel}`;
    }

    hideAllScreens();
    document.getElementById('stats-main-container')?.classList.remove('hidden');

    await Promise.all([
        depositoItemsCache.length === 0 ? fetchListaItems() : Promise.resolve(),
        ensureWarehouseMovementsLoaded(false)
    ]);
};

const showTopProductsMode = async () => {
    const topTitle = document.getElementById('top-title-text');
    if (topTitle) {
        topTitle.textContent = `Productos que Más Salen: ${selectedWarehouseLabel}`;
    }

    hideAllScreens();
    document.getElementById('top-products-container')?.classList.remove('hidden');

    const tbody = document.getElementById('top-products-tbody');
    if (tbody && allWarehouseMovements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando y procesando movimientos...</td></tr>';
    }

    await Promise.all([
        depositoItemsCache.length === 0 ? fetchListaItems() : Promise.resolve(),
        ensureWarehouseMovementsLoaded(false)
    ]);

    currentTopLimit = TOP_PAGE_SIZE;
    computeAndRenderTopProducts();
};

const resetCodeSearchUI = () => {
    const input = document.getElementById('codigo-pieza');
    const autocompleteList = document.getElementById('autocomplete-list');
    const detalleInput = document.getElementById('detalle-pieza');
    const imgContainer = document.getElementById('img-container');
    const btnBuscar = document.getElementById('btn-buscar');

    if (input) input.value = '';
    if (autocompleteList) autocompleteList.innerHTML = '';
    if (detalleInput) detalleInput.value = '';
    if (imgContainer) imgContainer.classList.add('hidden');
    if (btnBuscar) btnBuscar.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');

    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsContainer.classList.add('hidden');
        statsContainer.classList.remove('flex');
    }

    if (chartSemanal) { chartSemanal.destroy(); chartSemanal = null; }
    if (chartMensual) { chartMensual.destroy(); chartMensual = null; }
    if (chartAnual) { chartAnual.destroy(); chartAnual = null; }
};

const setupApp = () => {
    // Paso 1: Selección de Depósito -> va al Paso 2 (Selección de Modo)
    document.getElementById('choice-no-esteril-terminado')?.addEventListener('click', () => showModeChoiceScreen('no_esteril_terminado', 'No Estéril Terminado'));
    document.getElementById('choice-esteril-terminado')?.addEventListener('click', () => showModeChoiceScreen('esteril_terminado', 'Estéril Terminado'));
    document.getElementById('choice-semi-elaborado')?.addEventListener('click', () => showModeChoiceScreen('semi_elaborado', 'Semi Elaborado'));
    document.getElementById('choice-materia-prima')?.addEventListener('click', () => showModeChoiceScreen('materia_prima', 'Materia Prima'));

    // Paso 2: Selección de Modo (Por Código vs Productos que Más Salen)
    document.getElementById('btn-back-to-warehouses')?.addEventListener('click', showChoiceScreen);
    document.getElementById('choice-mode-codigo')?.addEventListener('click', showCodeSearchMode);
    document.getElementById('choice-mode-top')?.addEventListener('click', showTopProductsMode);

    // Botones Volver desde cada vista al selector de modo
    document.getElementById('btn-back-to-choices')?.addEventListener('click', () => showModeChoiceScreen());
    document.getElementById('btn-back-from-top')?.addEventListener('click', () => showModeChoiceScreen());

    // Botones de sincronización manual de caché (solo trae delta nuevo)
    document.getElementById('btn-sync-code')?.addEventListener('click', async () => {
        await ensureWarehouseMovementsLoaded(true);
        if (currentItemCode) {
            await fetchMovimientos(currentItemCode);
            renderSemanal();
            renderMensual();
            renderAnual();
        }
    });

    document.getElementById('btn-sync-top')?.addEventListener('click', async () => {
        await ensureWarehouseMovementsLoaded(true);
        computeAndRenderTopProducts();
    });

    initSearch();
    initFilters();
    initTopProductsControls();
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor', 'operario']);
        currentUser = authData.user;
        const nameSpan = document.getElementById('user-display-name');
        if (nameSpan) nameSpan.textContent = authData.userData.name || currentUser.email;

        setupApp();
    } catch (error) {
        console.error("Error en estadísticas:", error);
    }
});

// ============================================================================
// CARGA DE CATÁLOGO DE ÍTEMS
// ============================================================================
const fetchListaItems = async () => {
    if (!selectedWarehouse) return;
    const input = document.getElementById('codigo-pieza');
    try {
        if (input) {
            input.disabled = true;
            input.placeholder = "Cargando ítems...";
        }

        const CACHE_KEY = getCacheKey();
        const CACHE_EXPIRY = 1000 * 60 * 60 * 12; // 12 horas
        const cached = localStorage.getItem(CACHE_KEY);

        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY && Array.isArray(data) && data.length > 0) {
                depositoItemsCache = data;
                if (input) {
                    input.disabled = false;
                    input.placeholder = "Ej: 4211800";
                }
                return;
            }
        }

        const masterRef = doc(db, 'system', getMasterDoc());
        const snap = await getDoc(masterRef);

        depositoItemsCache = [];
        if (snap.exists()) {
            const masterData = snap.data().items || [];
            depositoItemsCache = masterData.map(item => ({
                codigo: item.codigo,
                descripcion: item.descripcion,
                stock: item.stock
            }));

            if (depositoItemsCache.length > 0) {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: depositoItemsCache
                }));
            }
        }

        if (input) {
            input.disabled = false;
            input.placeholder = "Ej: 4211800";
        }
    } catch (error) {
        console.error("Error al cargar lista de ítems:", error);
        if (input) {
            input.disabled = false;
            input.placeholder = "Error de conexión";
        }
    }
};

// ============================================================================
// MODO 1: BUSCAR POR CÓDIGO
// ============================================================================
const initSearch = () => {
    const input = document.getElementById('codigo-pieza');
    const autocompleteList = document.getElementById('autocomplete-list');
    const detalleInput = document.getElementById('detalle-pieza');
    const imgContainer = document.getElementById('img-container');
    const previewPieza = document.getElementById('preview-pieza');
    const btnBuscar = document.getElementById('btn-buscar');

    const checkValid = () => {
        if (input.value.trim().length > 0 && detalleInput.value.trim().length > 0) {
            btnBuscar.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        } else {
            btnBuscar.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        }
    };

    input.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();

        let stripped = val.replace(/[^A-Z0-9]/g, '');
        let formatted = '';
        if (stripped.length > 0) formatted += stripped.substring(0, 2);
        if (stripped.length > 2) formatted += '-' + stripped.substring(2, 5);
        if (stripped.length > 5) formatted += '-' + stripped.substring(5, 7);

        if (input.value !== formatted) input.value = formatted;
        val = formatted;

        autocompleteList.innerHTML = '';
        detalleInput.value = '';
        imgContainer.classList.add('hidden');
        checkValid();

        if (!val) {
            autocompleteList.classList.add('hidden');
            return;
        }

        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');
        const matches = depositoItemsCache.filter(item => {
            const codigo = item.codigo.toUpperCase();
            const desc = (item.descripcion || '').toUpperCase();
            const codigoAlfanumerico = codigo.replace(/[^A-Z0-9]/g, '');
            return codigo.includes(val) || desc.includes(val) || (valAlfanumerico.length > 0 && codigoAlfanumerico.includes(valAlfanumerico));
        }).slice(0, 10);

        if (matches.length > 0) {
            autocompleteList.classList.remove('hidden');
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0 group";
                div.innerHTML = `
                    <div class="flex items-center w-full justify-between gap-4">
                        <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest whitespace-nowrap">${item.codigo}</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase text-right leading-tight break-words flex-1">${item.descripcion}</span>
                    </div>
                `;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = item.codigo;
                    detalleInput.value = item.descripcion;
                    autocompleteList.classList.add('hidden');

                    previewPieza.src = `../assets/items/${item.codigo}.webp`;
                    previewPieza.style.opacity = '0';
                    imgContainer.classList.remove('hidden');
                    imgContainer.classList.add('flex');
                    checkValid();
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => autocompleteList.classList.add('hidden'), 200);
        const val = input.value.toUpperCase();
        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');

        if (valAlfanumerico) {
            const exactMatch = depositoItemsCache.find(item => {
                const codAlfanumerico = item.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
                return codAlfanumerico === valAlfanumerico;
            });
            if (exactMatch) {
                input.value = exactMatch.codigo;
                detalleInput.value = exactMatch.descripcion;
                previewPieza.src = `../assets/items/${exactMatch.codigo}.webp`;
                previewPieza.style.opacity = '0';
                imgContainer.classList.remove('hidden');
                imgContainer.classList.add('flex');
            } else {
                imgContainer.classList.add('hidden');
                imgContainer.classList.remove('flex');
            }
        }
        checkValid();
    });

    btnBuscar.addEventListener('click', async () => {
        if (!input.value) return;
        currentItemCode = input.value.trim().toUpperCase();
        const btnOriginalText = btnBuscar.innerHTML;
        btnBuscar.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> Cargando...';

        await fetchMovimientos(currentItemCode);

        document.getElementById('stats-container').classList.remove('hidden');
        document.getElementById('stats-container').classList.add('flex');

        renderSemanal();
        renderMensual();
        renderAnual();

        btnBuscar.innerHTML = btnOriginalText;
    });
};

const fetchMovimientos = async (codigo) => {
    try {
        await ensureWarehouseMovementsLoaded(false);
        const targetNorm = codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        movimientosData = allWarehouseMovements
            .filter(m => {
                const mNorm = (m.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                return m.codigo === codigo || (targetNorm && mNorm === targetNorm);
            })
            .map(m => ({
                ...m,
                fechaObj: m.timestampMs ? new Date(m.timestampMs) : new Date()
            }));
    } catch (error) {
        console.error("Error al cargar movimientos:", error);
    }
};

const initFilters = () => {
    const d = new Date();
    const selectMes = document.getElementById('select-mes');
    const selectAnio = document.getElementById('select-anio');

    selectMes.value = d.getMonth().toString();

    const currentYear = d.getFullYear();
    selectAnio.innerHTML = '';
    for (let y = 2024; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        selectAnio.appendChild(opt);
    }

    selectMes.addEventListener('change', renderMensual);
    selectAnio.addEventListener('change', () => {
        renderMensual();
        renderAnual();
    });
};

const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
    },
    scales: {
        x: { grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } },
        y: { beginAtZero: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
    }
};

const renderSemanal = () => {
    const ctx = document.getElementById('chart-semanal').getContext('2d');

    const labels = [];
    const daySlots = [];
    const ingresos = [0, 0, 0, 0, 0, 0, 0];
    const egresos = [0, 0, 0, 0, 0, 0, 0];

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        labels.push(d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }));
        daySlots.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            date: d.getDate()
        });
    }

    movimientosData.forEach(m => {
        if (!m.fechaObj) return;
        const y = m.fechaObj.getFullYear();
        const mo = m.fechaObj.getMonth();
        const da = m.fechaObj.getDate();

        for (let i = 0; i < 7; i++) {
            if (daySlots[i].year === y && daySlots[i].month === mo && daySlots[i].date === da) {
                if (m.tipo === "Ingreso") ingresos[i] += Number(m.cantidad) || 0;
                if (m.tipo === "Egreso") egresos[i] += Number(m.cantidad) || 0;
                break;
            }
        }
    });

    if (chartSemanal) chartSemanal.destroy();

    chartSemanal = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, borderColor: THEME.ingreso.border, backgroundColor: THEME.ingreso.bg, tension: 0.3, fill: true },
                { label: 'Egresos', data: egresos, borderColor: THEME.egreso.border, backgroundColor: THEME.egreso.bg, tension: 0.3, fill: true }
            ]
        },
        options: defaultOptions
    });
};

const renderMensual = () => {
    const ctx = document.getElementById('chart-mensual').getContext('2d');
    const mesSeleccionado = parseInt(document.getElementById('select-mes').value, 10);
    const anioSeleccionado = parseInt(document.getElementById('select-anio')?.value, 10) || new Date().getFullYear();

    const diasEnMes = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
    const labels = Array.from({ length: diasEnMes }, (_, i) => `${i + 1}`);

    const ingresos = new Array(diasEnMes).fill(0);
    const egresos = new Array(diasEnMes).fill(0);

    movimientosData.forEach(m => {
        if (!m.fechaObj) return;
        if (m.fechaObj.getMonth() === mesSeleccionado && m.fechaObj.getFullYear() === anioSeleccionado) {
            const diaIdx = m.fechaObj.getDate() - 1;
            if (diaIdx >= 0 && diaIdx < diasEnMes) {
                if (m.tipo === "Ingreso") ingresos[diaIdx] += Number(m.cantidad) || 0;
                if (m.tipo === "Egreso") egresos[diaIdx] += Number(m.cantidad) || 0;
            }
        }
    });

    if (chartMensual) chartMensual.destroy();

    chartMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, backgroundColor: THEME.ingreso.border, borderRadius: 4 },
                { label: 'Egresos', data: egresos, backgroundColor: THEME.egreso.border, borderRadius: 4 }
            ]
        },
        options: defaultOptions
    });
};

const renderAnual = () => {
    const ctx = document.getElementById('chart-anual').getContext('2d');
    const anioSeleccionado = parseInt(document.getElementById('select-anio').value, 10);

    const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresos = new Array(12).fill(0);
    const egresos = new Array(12).fill(0);

    movimientosData.forEach(m => {
        if (!m.fechaObj) return;
        if (m.fechaObj.getFullYear() === anioSeleccionado) {
            const mesIdx = m.fechaObj.getMonth();
            if (m.tipo === "Ingreso") ingresos[mesIdx] += Number(m.cantidad) || 0;
            if (m.tipo === "Egreso") egresos[mesIdx] += Number(m.cantidad) || 0;
        }
    });

    if (chartAnual) chartAnual.destroy();

    chartAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, backgroundColor: THEME.ingreso.border, borderRadius: 6 },
                { label: 'Egresos', data: egresos, backgroundColor: THEME.egreso.border, borderRadius: 6 }
            ]
        },
        options: {
            ...defaultOptions,
            scales: {
                x: { stacked: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } },
                y: { stacked: true, beginAtZero: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
            }
        }
    });
};

// ============================================================================
// MODO 2: PRODUCTOS QUE MÁS SALEN (ESTADÍSTICAS GLOBALES)
// ============================================================================
const initTopProductsControls = () => {
    const periodoSelect = document.getElementById('top-periodo-select');
    const searchInput = document.getElementById('top-search-input');
    const btnLoadMore = document.getElementById('btn-top-load-more');
    const btnExportCsv = document.getElementById('btn-export-top-csv');

    periodoSelect?.addEventListener('change', () => {
        currentTopLimit = TOP_PAGE_SIZE;
        computeAndRenderTopProducts();
    });

    searchInput?.addEventListener('input', () => {
        currentTopLimit = TOP_PAGE_SIZE;
        renderTopProductsTable();
    });

    btnLoadMore?.addEventListener('click', () => {
        currentTopLimit += TOP_PAGE_SIZE;
        renderTopProductsTable();
    });

    btnExportCsv?.addEventListener('click', exportTopProductsCSV);
};

const getStartTimestampForPeriod = (periodKey) => {
    const now = new Date();
    if (periodKey === '7d') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
    if (periodKey === '30d') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
    if (periodKey === 'month') {
        return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
    }
    if (periodKey === 'year') {
        return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
    }
    return 0; // 'all'
};

const computeAndRenderTopProducts = () => {
    const periodKey = document.getElementById('top-periodo-select')?.value || 'all';
    const minTimestampMs = getStartTimestampForPeriod(periodKey);

    // Mapa de catálogo para enriquecer descripciones rápidamente
    const catalogDescMap = new Map();
    depositoItemsCache.forEach(item => {
        if (item.codigo) {
            catalogDescMap.set(item.codigo.trim().toUpperCase(), item.descripcion || '');
        }
    });

    const statsByCode = new Map();
    let totalEgresosMovs = 0;
    let totalEgresosUnidades = 0;

    allWarehouseMovements.forEach(mov => {
        if (mov.tipo !== 'Egreso') return;
        const cantidad = Number(mov.cantidad) || 0;
        if (cantidad <= 0) return;
        if (minTimestampMs > 0 && mov.timestampMs < minTimestampMs) return;

        const codigo = (mov.codigo || '').trim().toUpperCase();
        if (!codigo) return;

        totalEgresosMovs++;
        totalEgresosUnidades += cantidad;

        let entry = statsByCode.get(codigo);
        if (!entry) {
            entry = {
                codigo,
                descripcion: catalogDescMap.get(codigo) || mov.descripcion || 'Sin descripción',
                totalSalidas: 0,
                totalUnidades: 0,
                ultimaSalidaMs: 0
            };
            statsByCode.set(codigo, entry);
        } else if ((!entry.descripcion || entry.descripcion === 'Sin descripción') && mov.descripcion) {
            entry.descripcion = mov.descripcion;
        }

        entry.totalSalidas += 1;
        entry.totalUnidades += cantidad;
        if (mov.timestampMs > entry.ultimaSalidaMs) {
            entry.ultimaSalidaMs = mov.timestampMs;
        }
    });

    // Solo contamos los productos que mínimo salieron 1 vez para no sobresaturar el sistema
    currentTopRanking = Array.from(statsByCode.values())
        .filter(item => item.totalSalidas >= 1 && item.totalUnidades >= 1)
        .sort((a, b) => {
            if (b.totalUnidades !== a.totalUnidades) return b.totalUnidades - a.totalUnidades;
            return b.totalSalidas - a.totalSalidas;
        });

    // Actualizar KPIs
    const kpiProductos = document.getElementById('kpi-top-productos');
    const kpiUnidades = document.getElementById('kpi-top-unidades');
    const kpiMovimientos = document.getElementById('kpi-top-movimientos');

    if (kpiProductos) kpiProductos.textContent = currentTopRanking.length.toLocaleString('es-AR');
    if (kpiUnidades) kpiUnidades.textContent = totalEgresosUnidades.toLocaleString('es-AR');
    if (kpiMovimientos) kpiMovimientos.textContent = totalEgresosMovs.toLocaleString('es-AR');

    renderTopProductsChart();
    renderTopProductsTable();
};

const renderTopProductsChart = () => {
    const canvas = document.getElementById('chart-top-productos');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartTopProductos) {
        chartTopProductos.destroy();
        chartTopProductos = null;
    }

    const top15 = currentTopRanking.slice(0, 15);
    const labels = top15.map(item => item.codigo);
    const dataUnidades = top15.map(item => item.totalUnidades);

    chartTopProductos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Unidades que Salieron',
                    data: dataUnidades,
                    backgroundColor: THEME.top.bg,
                    borderColor: THEME.top.border,
                    borderWidth: 2,
                    borderRadius: 6
                }
            ]
        },
        options: {
            ...defaultOptions,
            plugins: {
                ...defaultOptions.plugins,
                tooltip: {
                    callbacks: {
                        afterLabel: (context) => {
                            const item = top15[context.dataIndex];
                            if (!item) return '';
                            return `${item.descripcion} (${item.totalSalidas} salidas)`;
                        }
                    }
                }
            }
        }
    });
};

const renderTopProductsTable = () => {
    const tbody = document.getElementById('top-products-tbody');
    const counterEl = document.getElementById('top-table-counter');
    const loadMoreContainer = document.getElementById('top-load-more-container');
    const searchVal = (document.getElementById('top-search-input')?.value || '').trim().toUpperCase();
    const searchNorm = searchVal.replace(/[^A-Z0-9]/g, '');

    if (!tbody) return;

    const filtered = searchVal
        ? currentTopRanking.filter(item => {
            const cod = item.codigo.toUpperCase();
            const codNorm = cod.replace(/[^A-Z0-9]/g, '');
            const desc = (item.descripcion || '').toUpperCase();
            return cod.includes(searchVal) || desc.includes(searchVal) || (searchNorm.length > 0 && codNorm.includes(searchNorm));
        })
        : currentTopRanking;

    if (counterEl) {
        counterEl.textContent = `${filtered.length} PRODUCTOS CON SALIDA`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron productos con salidas registradas para este filtro</td></tr>';
        loadMoreContainer?.classList.add('hidden');
        return;
    }

    const visibleItems = filtered.slice(0, currentTopLimit);

    tbody.innerHTML = visibleItems.map((item, idx) => {
        const rank = currentTopRanking.indexOf(item) + 1;
        let rankBadge = `<span class="inline-flex items-center justify-center size-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[11px]">${rank}</span>`;
        if (rank === 1) {
            rankBadge = `<span class="inline-flex items-center justify-center size-6 rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/30 font-black text-[11px]">1</span>`;
        } else if (rank === 2) {
            rankBadge = `<span class="inline-flex items-center justify-center size-6 rounded-lg bg-slate-300/30 text-slate-500 dark:text-slate-300 border border-slate-400/30 font-black text-[11px]">2</span>`;
        } else if (rank === 3) {
            rankBadge = `<span class="inline-flex items-center justify-center size-6 rounded-lg bg-orange-500/20 text-orange-500 border border-orange-500/30 font-black text-[11px]">3</span>`;
        }

        const fechaStr = item.ultimaSalidaMs > 0
            ? new Date(item.ultimaSalidaMs).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '--';

        return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 text-center">${rankBadge}</td>
                <td class="py-3 px-4 font-black text-blue-600 dark:text-blue-400 tracking-wider whitespace-nowrap">${item.codigo}</td>
                <td class="py-3 px-4 font-bold text-slate-700 dark:text-slate-200 uppercase max-w-xs truncate" title="${item.descripcion}">${item.descripcion}</td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-300">${item.totalSalidas}</span>
                </td>
                <td class="py-3 px-4 text-center">
                    <span class="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black text-sm">${item.totalUnidades}</span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">${fechaStr}</td>
                <td class="py-3 px-4 text-right">
                    <button type="button" data-code="${item.codigo}" data-desc="${item.descripcion.replace(/"/g, '&quot;')}" class="btn-ver-codigo-top px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all inline-flex items-center gap-1 cursor-pointer">
                        <span class="material-symbols-outlined text-[14px]">monitoring</span>
                        Ver Gráficos
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Bind de botones "Ver Gráficos" para saltar al detalle individual de esa pieza
    tbody.querySelectorAll('.btn-ver-codigo-top').forEach(btn => {
        btn.addEventListener('click', async () => {
            const code = btn.getAttribute('data-code');
            const desc = btn.getAttribute('data-desc') || '';
            if (!code) return;

            await showCodeSearchMode();
            const input = document.getElementById('codigo-pieza');
            const detalleInput = document.getElementById('detalle-pieza');
            const previewPieza = document.getElementById('preview-pieza');
            const imgContainer = document.getElementById('img-container');
            const btnBuscar = document.getElementById('btn-buscar');

            if (input) input.value = code;
            if (detalleInput) detalleInput.value = desc;
            if (previewPieza && imgContainer) {
                previewPieza.src = `../assets/items/${code}.webp`;
                previewPieza.style.opacity = '0';
                imgContainer.classList.remove('hidden');
                imgContainer.classList.add('flex');
            }
            if (btnBuscar) {
                btnBuscar.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
                btnBuscar.click();
            }
        });
    });

    if (loadMoreContainer) {
        if (filtered.length > currentTopLimit) {
            loadMoreContainer.classList.remove('hidden');
            const btnMore = document.getElementById('btn-top-load-more');
            if (btnMore) {
                btnMore.textContent = `Mostrar más productos (${filtered.length - currentTopLimit} restantes)`;
            }
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }
};

const exportTopProductsCSV = () => {
    if (!currentTopRanking || currentTopRanking.length === 0) {
        alert('No hay productos con salidas para exportar.');
        return;
    }

    let csvContent = '\uFEFF'; // BOM UTF-8 para Excel
    csvContent += 'RANKING;CODIGO;DESCRIPCION;MOVIMIENTOS DE SALIDA;UNIDADES QUE SALIERON;ULTIMA SALIDA\r\n';

    currentTopRanking.forEach((item, index) => {
        const rank = index + 1;
        const cleanCode = `"${String(item.codigo || '').replace(/"/g, '""')}"`;
        const cleanDesc = `"${String(item.descripcion || '').replace(/"/g, '""')}"`;
        const fechaStr = item.ultimaSalidaMs > 0
            ? new Date(item.ultimaSalidaMs).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '';
        csvContent += `${rank};${cleanCode};${cleanDesc};${item.totalSalidas};${item.totalUnidades};"${fechaStr}"\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateISO = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `mas_usados_${selectedWarehouse}_${dateISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
