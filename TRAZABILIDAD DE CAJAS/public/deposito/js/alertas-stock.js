import { db, doc, getDoc, setDoc, getDocs, collection, requireDepositoAuth } from './firebase-config-deposito.js';

let selectedWarehouse = ''; // 'no_esteril_terminado' | 'esteril_terminado' | 'semi_elaborado' | 'materia_prima'
let depositoItemsCache = [];
let filteredCatalogItems = [];
let catalogFilterMode = 'todos'; // 'todos' | 'sin_alarma' | 'con_alarma'
let catalogRenderLimit = 80;
let itemSeleccionado = null;
let currentUser = null;

const THEME = {
    amarilla: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-500', icon: 'warning', label: 'AMARILLA' },
    roja: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-500', icon: 'error', label: 'ROJA' }
};

const hasAlarmConfigured = (item) => {
    const min = item.stockMinimo ?? item.minimo;
    const hasMin = min !== undefined && min !== null && Number(min) > 0;
    return item.alertaStock === 'amarilla' || item.alertaStock === 'roja' || hasMin;
};

const showAlertasView = (warehouseName, labelText) => {
    selectedWarehouse = warehouseName;
    document.getElementById('alertas-title-text').textContent = `Configurar Alerta: ${labelText}`;
    
    // Toggle screens
    document.getElementById('warehouse-choice-screen').classList.add('hidden');
    document.getElementById('alertas-main-container').classList.remove('hidden');
    
    // Load and render
    fetchListaItems(false).then(() => {
        applyCatalogFilters(true);
        renderAlertasActivas();
    });
};

const showChoiceScreen = () => {
    selectedWarehouse = '';
    document.getElementById('alertas-main-container').classList.add('hidden');
    document.getElementById('warehouse-choice-screen').classList.remove('hidden');
    
    depositoItemsCache = [];
    filteredCatalogItems = [];
    itemSeleccionado = null;
    document.getElementById('item-seleccionado').classList.add('hidden');
    document.getElementById('buscador-input').value = '';
    document.getElementById('btn-clear-search')?.classList.add('hidden');
    document.getElementById('cantidad-reposicion').value = '';
    renderAlertasActivas();
};

const setupApp = () => {
    // Bind choice screen buttons
    document.getElementById('choice-no-esteril-terminado').addEventListener('click', () => showAlertasView('no_esteril_terminado', 'No Estéril Terminado'));
    document.getElementById('choice-esteril-terminado').addEventListener('click', () => showAlertasView('esteril_terminado', 'Estéril Terminado'));
    document.getElementById('choice-semi-elaborado').addEventListener('click', () => showAlertasView('semi_elaborado', 'Semi Elaborado'));
    document.getElementById('choice-materia-prima').addEventListener('click', () => showAlertasView('materia_prima', 'Materia Prima'));
    
    // Bind back button
    document.getElementById('btn-back-to-choices').addEventListener('click', showChoiceScreen);

    // Bind sync catalog button
    const btnSync = document.getElementById('btn-sync-catalog');
    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            await syncCatalogFromCollection();
        });
    }

    initSearch();
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor']);
        currentUser = authData;
        const nameSpan = document.getElementById('user-display-name');
        if (nameSpan) nameSpan.textContent = authData.userData.name || authData.user.email;

        setupApp();
    } catch (e) {
        console.error("Autenticación fallida o carga abortada", e);
    }
});

const normalizeAndSortItems = (rawItems) => {
    return (rawItems || [])
        .filter(item => item && item.codigo && String(item.codigo).trim().toLowerCase() !== 'codigo')
        .map(item => ({
            ...item,
            codigo: String(item.codigo).trim(),
            descripcion: String(item.descripcion || 'S/N').trim(),
            stock: Number(item.stock) || 0
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
};

const syncCatalogFromCollection = async () => {
    if (!selectedWarehouse) return;
    const btnSync = document.getElementById('btn-sync-catalog');
    const syncIcon = document.getElementById('sync-catalog-icon');
    const autocompleteList = document.getElementById('autocomplete-list');

    if (btnSync) btnSync.disabled = true;
    if (syncIcon) syncIcon.classList.add('animate-spin');
    if (autocompleteList) {
        autocompleteList.innerHTML = `
            <div class="py-12 text-center">
                <div class="flex flex-col items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin text-2xl text-villalba-blue">sync</span>
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando catálogo completo desde la base de datos...</p>
                </div>
            </div>
        `;
    }

    try {
        const catalogSnap = await getDocs(collection(db, `deposito_catalogo_${selectedWarehouse}`));
        const freshItems = [];
        catalogSnap.forEach(d => {
            const id = d.id;
            if (!id || id.toLowerCase() === 'codigo') return;
            const data = d.data() || {};
            const item = {
                codigo: id,
                descripcion: data.descripcion || 'S/N',
                stock: Number(data.stock) || 0
            };
            if (selectedWarehouse === 'no_esteril_terminado') {
                item.entrepiso = data.entrepiso || '';
                item.material = data.material || '';
            }
            const minVal = data.stockMinimo ?? data.minimo;
            if (minVal !== undefined && minVal !== null) {
                item.stockMinimo = Number(minVal);
                item.minimo = Number(minVal);
            }
            if (data.alertaStock) {
                item.alertaStock = data.alertaStock;
            }
            freshItems.push(item);
        });

        depositoItemsCache = normalizeAndSortItems(freshItems);

        const masterRef = doc(db, 'system', `master_catalog_${selectedWarehouse}`);
        await setDoc(masterRef, { items: depositoItemsCache });
        localStorage.removeItem(`villalba_items_cache_${selectedWarehouse}`);

        applyCatalogFilters(true);
        renderAlertasActivas();
        showToast(`Catálogo actualizado (${depositoItemsCache.length} ítems)`);
    } catch (error) {
        console.error("Error al sincronizar catálogo:", error);
        alert("No se pudo sincronizar el catálogo. Ver consola.");
    } finally {
        if (btnSync) btnSync.disabled = false;
        if (syncIcon) syncIcon.classList.remove('animate-spin');
    }
};

const fetchListaItems = async (forceCollectionSync = false) => {
    if (!selectedWarehouse) return;
    const autocompleteList = document.getElementById('autocomplete-list');
    if (autocompleteList) {
        autocompleteList.innerHTML = `
            <div class="py-12 text-center">
                <div class="flex flex-col items-center justify-center gap-2">
                    <span class="material-symbols-outlined animate-spin text-2xl text-villalba-blue">sync</span>
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargando catálogo de ítems...</p>
                </div>
            </div>
        `;
    }

    if (forceCollectionSync) {
        await syncCatalogFromCollection();
        return;
    }

    try {
        const masterRef = doc(db, 'system', `master_catalog_${selectedWarehouse}`);
        const snap = await getDoc(masterRef);
        
        if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length > 0) {
            depositoItemsCache = normalizeAndSortItems(snap.data().items);
            // Actualizar también el caché compartido del navegador para que catálogo y carga-datos estén al día
            localStorage.setItem(`villalba_items_cache_${selectedWarehouse}`, JSON.stringify({
                timestamp: Date.now(),
                data: depositoItemsCache
            }));
        } else {
            // Si master_catalog no existe o está vacío, sincronizar desde la colección individual
            await syncCatalogFromCollection();
        }
    } catch (error) {
        console.error("Error al cargar lista de ítems:", error);
        depositoItemsCache = [];
    }
};

const updateFilterButtonsUI = () => {
    const totalCount = depositoItemsCache.length;
    const conAlarmaCount = depositoItemsCache.filter(hasAlarmConfigured).length;
    const sinAlarmaCount = totalCount - conAlarmaCount;

    const contadorCatalogo = document.getElementById('contador-catalogo');
    if (contadorCatalogo) {
        contadorCatalogo.textContent = `${totalCount} ÍTEMS`;
    }

    document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
        const mode = btn.dataset.filter;
        if (mode === 'todos') btn.textContent = `Todos (${totalCount})`;
        else if (mode === 'sin_alarma') btn.textContent = `Sin Alarma (${sinAlarmaCount})`;
        else if (mode === 'con_alarma') btn.textContent = `Con Alarma (${conAlarmaCount})`;

        if (mode === catalogFilterMode) {
            btn.className = "catalog-filter-btn px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-villalba-blue text-white shadow-sm transition-all cursor-pointer";
        } else {
            btn.className = "catalog-filter-btn px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer";
        }
    });
};

const applyCatalogFilters = (resetScroll = true) => {
    updateFilterButtonsUI();

    const input = document.getElementById('buscador-input');
    const btnClear = document.getElementById('btn-clear-search');
    const val = (input?.value || '').trim().toUpperCase();
    const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');

    if (btnClear) {
        if (val.length > 0) {
            btnClear.classList.remove('hidden');
            btnClear.classList.add('flex');
        } else {
            btnClear.classList.add('hidden');
            btnClear.classList.remove('flex');
        }
    }

    filteredCatalogItems = depositoItemsCache.filter(item => {
        // 1. Filtro por estado de alarma
        const tieneAlarma = hasAlarmConfigured(item);
        if (catalogFilterMode === 'sin_alarma' && tieneAlarma) return false;
        if (catalogFilterMode === 'con_alarma' && !tieneAlarma) return false;

        // 2. Filtro por texto (código, código sin guiones, descripción o material)
        if (val) {
            const codigo = (item.codigo || '').toUpperCase();
            const desc = (item.descripcion || '').toUpperCase();
            const mat = (item.material || '').toUpperCase();
            const codigoAlfanumerico = codigo.replace(/[^A-Z0-9]/g, '');

            const match = codigo.includes(val)
                || desc.includes(val)
                || mat.includes(val)
                || (valAlfanumerico.length > 0 && codigoAlfanumerico.includes(valAlfanumerico));
            if (!match) return false;
        }

        return true;
    });

    if (resetScroll) {
        catalogRenderLimit = 80;
        const autocompleteList = document.getElementById('autocomplete-list');
        if (autocompleteList) autocompleteList.scrollTop = 0;
    }

    renderCatalogList();
};

const renderCatalogList = () => {
    const autocompleteList = document.getElementById('autocomplete-list');
    const mostrandoLabel = document.getElementById('catalogo-mostrando-label');
    if (!autocompleteList) return;

    if (mostrandoLabel) {
        mostrandoLabel.textContent = `${filteredCatalogItems.length} de ${depositoItemsCache.length} ítems`;
    }

    if (filteredCatalogItems.length === 0) {
        autocompleteList.innerHTML = `
            <div class="py-12 px-4 text-center text-slate-400">
                <span class="material-symbols-outlined text-3xl opacity-50 mb-1 block">search_off</span>
                <p class="text-[10px] font-black uppercase tracking-widest">No se encontraron ítems con ese criterio</p>
            </div>
        `;
        return;
    }

    const sliceToRender = filteredCatalogItems.slice(0, catalogRenderLimit);

    autocompleteList.innerHTML = sliceToRender.map(item => {
        const min = item.stockMinimo ?? item.minimo;
        const hasMin = min !== undefined && min !== null && Number(min) > 0;
        const stock = Number(item.stock) || 0;
        const isSelected = itemSeleccionado && itemSeleccionado.codigo === item.codigo;

        let badgeDot = '<span class="size-2.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" title="Sin alarma configurada"></span>';
        if (item.alertaStock === 'roja' || (hasMin && stock <= 0)) {
            badgeDot = '<span class="size-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] shrink-0" title="Alerta Roja / Crítica"></span>';
        } else if (item.alertaStock === 'amarilla' || (hasMin && stock <= Number(min))) {
            badgeDot = '<span class="size-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] shrink-0" title="Alerta Amarilla / Bajo Mínimo"></span>';
        } else if (hasMin) {
            badgeDot = '<span class="size-2.5 rounded-full bg-emerald-500 shrink-0" title="Alarma configurada (Stock OK)"></span>';
        }

        const matBadge = item.material
            ? `<span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">${item.material}</span>`
            : '';

        const minBadge = hasMin
            ? `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Mín: ${min}</span>`
            : `<span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800/80 text-slate-400">Sin alarma</span>`;

        const selectedClasses = isSelected
            ? 'bg-villalba-blue/10 dark:bg-villalba-blue/20 border-l-4 border-l-villalba-blue'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60';

        return `
            <div data-codigo="${item.codigo}" class="catalog-item-row px-4 py-3 cursor-pointer flex justify-between items-center gap-3 transition-colors group ${selectedClasses}">
                <div class="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                    ${badgeDot}
                    <div class="flex flex-col overflow-hidden min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">${item.codigo}</span>
                            ${matBadge}
                            <span class="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400">Stock: ${stock}</span>
                            ${minBadge}
                        </div>
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-tight truncate mt-0.5">${item.descripcion}</span>
                    </div>
                </div>
                <span class="text-[9px] font-black text-villalba-blue opacity-0 group-hover:opacity-100 transition-opacity shrink-0">CONFIGURAR</span>
            </div>
        `;
    }).join('');
};

const seleccionarItem = (item) => {
    if (!item) return;
    itemSeleccionado = item;

    const panelSeleccionado = document.getElementById('item-seleccionado');
    const lblCodigo = document.getElementById('item-codigo');
    const lblDesc = document.getElementById('item-desc');
    const btnQuitar = document.getElementById('btn-quitar-alerta');
    const cantInput = document.getElementById('cantidad-reposicion');

    lblCodigo.textContent = item.codigo;

    const minStock = item.stockMinimo ?? item.minimo;
    const matInfo = item.material ? ` • MATERIAL: ${item.material}` : '';
    if (minStock !== undefined && minStock !== null && Number(minStock) > 0) {
        lblDesc.innerHTML = `${item.descripcion} <span class="block mt-1 text-[10px] font-black text-amber-500 uppercase tracking-wider">STOCK ACTUAL: ${item.stock || 0} UDS | MÍNIMO CONFIGURADO: ${minStock} UDS${matInfo}</span>`;
        cantInput.value = minStock;
    } else {
        lblDesc.innerHTML = `${item.descripcion} <span class="block mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">STOCK ACTUAL: ${item.stock || 0} UDS${matInfo}</span>`;
        cantInput.value = '';
    }

    panelSeleccionado.classList.remove('hidden');

    if (hasAlarmConfigured(item)) {
        btnQuitar.classList.remove('hidden');
    } else {
        btnQuitar.classList.add('hidden');
    }

    renderCatalogList();
    cantInput.focus();
    cantInput.select();
};

const initSearch = () => {
    const input = document.getElementById('buscador-input');
    const btnClear = document.getElementById('btn-clear-search');
    const autocompleteList = document.getElementById('autocomplete-list');
    const panelSeleccionado = document.getElementById('item-seleccionado');
    const btnCerrarSeleccion = document.getElementById('btn-cerrar-seleccion');
    const btnQuitar = document.getElementById('btn-quitar-alerta');

    input.addEventListener('input', () => {
        applyCatalogFilters(true);
    });

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            input.value = '';
            applyCatalogFilters(true);
            input.focus();
        });
    }

    document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            catalogFilterMode = btn.dataset.filter || 'todos';
            applyCatalogFilters(true);
        });
    });

    if (btnCerrarSeleccion) {
        btnCerrarSeleccion.addEventListener('click', () => {
            itemSeleccionado = null;
            panelSeleccionado.classList.add('hidden');
            renderCatalogList();
        });
    }

    // Scroll incremental en la lista del catálogo para mostrar los 2300+ ítems sin trabarse
    if (autocompleteList) {
        autocompleteList.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = autocompleteList;
            if (scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 180) {
                if (catalogRenderLimit < filteredCatalogItems.length) {
                    catalogRenderLimit += 80;
                    renderCatalogList();
                }
            }
        });

        autocompleteList.addEventListener('click', (e) => {
            const row = e.target.closest('.catalog-item-row');
            if (!row) return;
            const codigo = row.dataset.codigo;
            const found = depositoItemsCache.find(i => i.codigo === codigo);
            if (found) {
                seleccionarItem(found);
            }
        });
    }

    // Botones de Acción
    document.getElementById('btn-alerta-amarilla').addEventListener('click', () => setAlerta('amarilla'));
    document.getElementById('btn-alerta-roja').addEventListener('click', () => setAlerta('roja'));
    btnQuitar.addEventListener('click', () => setAlerta(null));
};

const setAlerta = async (nivel) => {
    if (!itemSeleccionado) return;

    const btnAmarillo = document.getElementById('btn-alerta-amarilla');
    const btnRojo = document.getElementById('btn-alerta-roja');
    const panel = document.getElementById('item-seleccionado');
    const oldHtmlA = btnAmarillo.innerHTML;
    const oldHtmlR = btnRojo.innerHTML;

    if (nivel === 'amarilla') btnAmarillo.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';
    if (nivel === 'roja') btnRojo.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';
    panel.style.pointerEvents = 'none';
    panel.style.opacity = '0.7';

    try {
        const cantInput = document.getElementById('cantidad-reposicion').value;
        const cant = parseInt(cantInput, 10) > 0 ? parseInt(cantInput, 10) : 1;
        const targetCode = itemSeleccionado.codigo;

        // 1. Actualizar Documento Individual en deposito_catalogo
        const itemRef = doc(db, `deposito_catalogo_${selectedWarehouse}`, targetCode);
        const itemUpdate = nivel
            ? { alertaStock: nivel, stockMinimo: cant, minimo: cant }
            : { alertaStock: null, stockMinimo: null, minimo: null };
        await setDoc(itemRef, itemUpdate, { merge: true });

        // 2. Actualizar en memoria y en Master Document (leyendo la versión más reciente para no pisar stock)
        const masterRef = doc(db, 'system', `master_catalog_${selectedWarehouse}`);
        const masterSnap = await getDoc(masterRef);
        let latestMasterItems = masterSnap.exists() && Array.isArray(masterSnap.data().items)
            ? masterSnap.data().items
            : [...depositoItemsCache];

        const updateItemEntry = (arr) => {
            const idx = arr.findIndex(i => i && i.codigo === targetCode);
            if (idx !== -1) {
                if (nivel) {
                    arr[idx].alertaStock = nivel;
                    arr[idx].stockMinimo = cant;
                    arr[idx].minimo = cant;
                } else {
                    delete arr[idx].alertaStock;
                    delete arr[idx].stockMinimo;
                    delete arr[idx].minimo;
                }
            }
        };

        updateItemEntry(latestMasterItems);
        updateItemEntry(depositoItemsCache);

        await setDoc(masterRef, { items: latestMasterItems }, { merge: true });

        // Actualizar caché local
        localStorage.setItem(`villalba_items_cache_${selectedWarehouse}`, JSON.stringify({
            timestamp: Date.now(),
            data: depositoItemsCache
        }));

        // Éxito
        showToast(nivel ? `Alerta ${nivel.toUpperCase()} guardada (${targetCode})` : `Alerta removida (${targetCode})`);
        document.getElementById('item-seleccionado').classList.add('hidden');
        document.getElementById('cantidad-reposicion').value = '';
        itemSeleccionado = null;

        applyCatalogFilters(false);
        renderAlertasActivas();

    } catch (error) {
        console.error("Error al configurar alerta:", error);
        alert("Ocurrió un error al configurar la alerta. Ver consola.");
    } finally {
        btnAmarillo.innerHTML = oldHtmlA;
        btnRojo.innerHTML = oldHtmlR;
        panel.style.pointerEvents = 'auto';
        panel.style.opacity = '1';
    }
};

const renderAlertasActivas = () => {
    const tbody = document.getElementById('alertas-tbody');
    const contador = document.getElementById('contador-alertas');
    
    const itemsConAlerta = depositoItemsCache.filter(i => {
        const min = i.stockMinimo ?? i.minimo;
        const tieneBajoStock = min !== undefined && min !== null && Number(min) > 0 && (Number(i.stock) || 0) <= Number(min);
        return i.alertaStock === 'amarilla' || i.alertaStock === 'roja' || tieneBajoStock;
    });
    
    contador.textContent = `${itemsConAlerta.length} ÍTEMS`;

    if (itemsConAlerta.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="py-16 text-center">
                    <div class="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <span class="material-symbols-outlined text-4xl opacity-50">notifications_paused</span>
                        <p class="text-[10px] font-black uppercase tracking-widest">No hay alertas activas</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort: Rojas first, then Amarillas
    itemsConAlerta.sort((a, b) => {
        const nivelA = a.alertaStock || ((Number(a.stock) || 0) <= 0 ? 'roja' : 'amarilla');
        const nivelB = b.alertaStock || ((Number(b.stock) || 0) <= 0 ? 'roja' : 'amarilla');
        if (nivelA === 'roja' && nivelB !== 'roja') return -1;
        if (nivelA !== 'roja' && nivelB === 'roja') return 1;
        return a.codigo.localeCompare(b.codigo);
    });

    tbody.innerHTML = itemsConAlerta.map(item => {
        const min = item.stockMinimo ?? item.minimo;
        const nivelEfectivo = item.alertaStock || ((Number(item.stock) || 0) <= 0 ? 'roja' : 'amarilla');
        const theme = THEME[nivelEfectivo] || THEME.amarilla;
        
        return `
            <tr data-codigo="${item.codigo}" class="alerta-activa-row group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" title="Clic para editar esta alerta">
                <td class="py-4 px-4 border-b border-slate-100 dark:border-slate-800/80 w-[120px]">
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${theme.border} ${theme.bg} ${theme.text}">
                        <span class="material-symbols-outlined text-[14px]">${theme.icon}</span>
                        <span class="text-[9px] font-black uppercase tracking-widest">${theme.label}</span>
                    </div>
                </td>
                <td class="py-4 px-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-black text-slate-800 dark:text-white tracking-widest leading-none">${item.codigo}</p>
                        ${min !== undefined && min !== null ? `<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Stock: ${item.stock || 0} / Mín: ${min}</span>` : `<span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Stock: ${item.stock || 0}</span>`}
                    </div>
                    <p class="text-[10px] font-bold text-slate-500 uppercase mt-1 truncate max-w-[200px] sm:max-w-md">${item.descripcion}</p>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.alerta-activa-row').forEach(row => {
        row.addEventListener('click', () => {
            const codigo = row.dataset.codigo;
            const found = depositoItemsCache.find(i => i.codigo === codigo);
            if (found) seleccionarItem(found);
        });
    });
};

const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.querySelector('p:last-child').textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-24');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-24');
    }, 4000);
};
