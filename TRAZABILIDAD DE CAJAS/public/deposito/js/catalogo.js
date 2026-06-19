import { db, doc, getDoc, collection, query, getDocs, orderBy, limit, startAfter, requireDepositoAuth, setDoc } from './firebase-config-deposito.js';

let selectedWarehouse = ''; // 'no_esteril_terminado' | 'esteril_terminado' | 'semi_elaborado' | 'materia_prima'
let allItems = [];
let filteredItems = [];
let renderLimit = 50;
let lastScrollHeight = 0;

const ROW_HEIGHT = 92; 

let isFetching = false;
let allLoaded = false;

const scrollContainer = document.getElementById('scroll-container');
const virtualStretcher = document.getElementById('virtual-stretcher');
const tbody = document.getElementById('catalogo-tbody');
const contador = document.getElementById('contador-items');
const emptyState = document.getElementById('empty-state');
const buscador = document.getElementById('buscador-catalogo');

// Modal Elements
const imageModal = document.getElementById('imageModal');
const enlargedImage = document.getElementById('enlargedImage');
const closeImageModalObj = document.getElementById('closeImageModal');
const modal3d = document.getElementById('modal-3d');
const modalCaption = document.getElementById('modal-caption');
const zControls = document.getElementById('zoom-controls');
const zControlsMob = document.getElementById('zoom-controls-mobile');

let currentScale = 1;
let is3dActive = false;

const getCatalogCollection = () => `deposito_catalogo_${selectedWarehouse}`;
const getMasterDoc = () => `master_catalog_${selectedWarehouse}`;
const getCacheKey = () => `villalba_items_cache_${selectedWarehouse}`;

const openModal = () => {
    currentScale = 1;
    enlargedImage.style.transform = `scale(1)`;
    if (is3dActive && modal3d.cameraOrbit) {
        modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
        if (typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
    }

    imageModal.classList.remove('hidden');
    void imageModal.offsetWidth; // Reflow
    imageModal.classList.add('opacity-100');
    
    if (zControls) zControls.classList.remove('opacity-0');
    if (zControlsMob) zControlsMob.classList.remove('opacity-0');
};

const closeModal = () => {
    imageModal.classList.remove('opacity-100');
    if (zControls) zControls.classList.add('opacity-0');
    if (zControlsMob) zControlsMob.classList.add('opacity-0');
    
    setTimeout(() => {
        imageModal.classList.add('hidden');
        enlargedImage.style.transform = `scale(1)`;
        if (is3dActive && modal3d.cameraOrbit) {
            modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
            if (typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
        }
        is3dActive = false;
    }, 300);
};

const handleZoom = (direction) => {
    if (is3dActive) {
        if (typeof modal3d.zoom === 'function') {
            modal3d.zoom(direction === 'in' ? 3 : -3);
        }
    } else {
        currentScale = direction === 'in' ? currentScale + 0.35 : Math.max(0.35, currentScale - 0.35);
        enlargedImage.style.transform = `scale(${currentScale})`;
        enlargedImage.style.transition = 'transform 0.3s ease-out';
    }
};

const resetZoom = () => {
    if (is3dActive) {
        modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
        if (typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
    } else {
        currentScale = 1;
        enlargedImage.style.transform = `scale(1)`;
    }
};

const renderRows = () => {
    if (filteredItems.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    const itemsToRender = filteredItems.slice(0, renderLimit);
    let html = '';
    html += itemsToRender.map(item => {
        const stockActual = item.stock || 0;
        let stockColor = 'text-slate-500 bg-slate-100 dark:bg-slate-800';
        if (stockActual > 0) stockColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
        else if (stockActual < 0) stockColor = 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20';

        let alertBadge = '';
        let rowStyle = 'hover:bg-slate-50 dark:hover:bg-white/5 border-slate-100 dark:border-slate-800/50';
        
        if (item.alertaStock === 'amarilla') {
            rowStyle = 'bg-yellow-500/5 hover:bg-yellow-500/10 border-yellow-500/20';
            alertBadge = '<span class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-yellow-500 text-white shadow-sm z-20" title="Alerta Amarilla (Media)"><span class="material-symbols-outlined text-[12px]">warning</span></span>';
        } else if (item.alertaStock === 'roja') {
            rowStyle = 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20';
            alertBadge = '<span class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm z-20" title="Alerta Roja (Alta)"><span class="material-symbols-outlined text-[12px]">error</span></span>';
        }

        let entrepisoCell = '';
        if (selectedWarehouse === 'no_esteril_terminado') {
            entrepisoCell = `
                <td class="py-2 px-6">
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">${item.entrepiso || '-'}</span>
                </td>
            `;
        }

        return `
            <tr style="height: ${ROW_HEIGHT}px" class="group transition-colors border-b ${rowStyle}">
                <td class="py-2 px-6">
                    <div class="relative w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        ${alertBadge}
                        <span class="material-symbols-outlined absolute text-2xl text-slate-300 dark:text-slate-700 transition-transform group-hover:scale-110">inventory_2</span>
                        <img src="../assets/items/${item.codigo}.webp" alt="${item.codigo}" 
                             class="max-h-[90%] max-w-[90%] object-contain relative z-10 transition-transform group-hover:scale-110" 
                             loading="lazy"
                             onerror="this.style.opacity='0'" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                        
                        <!-- Botones de acción al hacer hover -->
                        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm bg-white/75 dark:bg-slate-900/75 p-1">
                            <button class="view-3d-btn p-1 rounded-md bg-purple-500 hover:bg-purple-600 text-white shadow-sm transition-colors cursor-pointer" data-code="${item.codigo}" title="Ver modelo 3D">
                                <span class="material-symbols-outlined text-[15px]">3d_rotation</span>
                            </button>
                            <button class="zoom-img-btn p-1 rounded-md bg-villalba-blue hover:bg-blue-600 text-white shadow-sm transition-colors cursor-pointer" data-code="${item.codigo}" title="Ampliar imagen">
                                <span class="material-symbols-outlined text-[15px]">zoom_in</span>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="py-2 px-6">
                    <span class="text-sm font-black text-villalba-blue dark:text-blue-400 uppercase tracking-widest">${item.codigo}</span>
                </td>
                <td class="py-2 px-6">
                    <p class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide leading-relaxed line-clamp-2">${item.descripcion || 'Sin descripción'}</p>
                </td>
                ${entrepisoCell}
                <td class="py-2 px-6 text-center">
                    <span class="px-4 py-1.5 rounded-lg border ${stockColor} font-black text-xs uppercase tracking-widest">
                        ${stockActual}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
    
    // Asignar eventos a los botones de acción
    tbody.querySelectorAll('.zoom-img-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const code = btn.dataset.code;
            const imgPath = `../assets/items/${code}.webp`;
            
            is3dActive = false;
            modal3d.classList.add('hidden');
            enlargedImage.classList.remove('hidden');
            enlargedImage.src = imgPath;
            
            modalCaption.textContent = `Código: ${code}`;
            openModal();
        };
    });

    tbody.querySelectorAll('.view-3d-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            is3dActive = true;
            const code = btn.dataset.code;
            const glbPath = `../assets/3d/${code}.glb`;
            
            enlargedImage.classList.add('hidden');
            modal3d.classList.remove('hidden');
            if (modal3d.getAttribute('src') !== glbPath) {
                modal3d.src = glbPath;
            }
            
            modalCaption.textContent = `Modelo 3D - Código: ${code}`;
            openModal();
        };
    });
};

let ticking = false;
let isRendering = false;

const handleScroll = () => {
    if (!ticking) {
        window.requestAnimationFrame(() => {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            const doc = document.documentElement;
            
            const containerScroll = scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 300;
            const windowScroll = doc.scrollHeight > window.innerHeight && doc.scrollTop + window.innerHeight >= doc.scrollHeight - 300;

            if ((containerScroll || windowScroll) && !isRendering) {
                if (renderLimit < filteredItems.length) {
                    isRendering = true;
                    renderLimit += 50;
                    renderRows();
                    setTimeout(() => { isRendering = false; }, 150); // Lock to prevent rapid fire
                }
            }
            ticking = false;
        });
        ticking = true;
    }
};

const updateVirtualLayout = (items, shouldReset = false) => {
    filteredItems = items || [];
    virtualStretcher.style.display = 'none';
    if (contador) contador.textContent = `${filteredItems.length} ÍTEMS`;
    
    if (shouldReset) {
        renderLimit = 50;
        scrollContainer.scrollTop = 0;
    }
    renderRows();
};

const loadCatalog = async (reset = true) => {
    if (!selectedWarehouse || isFetching || (allLoaded && !reset)) return;
    isFetching = true;

    if (reset) {
        allItems = [];
        allLoaded = false;
        scrollContainer.scrollTop = 0;
    }

    try {
        const cached = localStorage.getItem(getCacheKey());
        const CACHE_EXPIRY = 1000 * 60 * 60 * 2; // 2 horas
        
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY && data && data.length > 0) {
                const containsNegative = data.some(i => (i.stock || 0) < 0);
                if (containsNegative) {
                    localStorage.removeItem(getCacheKey());
                } else {
                    allItems = data.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
                    allLoaded = true;
                    applyFilters(reset);
                    isFetching = false;
                    return;
                }
            }
        }

        console.log(`Descargando catálogo ${selectedWarehouse} desde Firestore...`);
        const masterRef = doc(db, 'system', getMasterDoc());
        const snap = await getDoc(masterRef);

        if (!snap.exists()) {
            allLoaded = true;
            if (reset) emptyState.classList.remove('hidden');
        } else {
            const masterData = snap.data().items || [];
            let hasNegative = false;
            const correctedItems = masterData.map(item => {
                if ((item.stock || 0) < 0) {
                    item.stock = 0;
                    hasNegative = true;
                    const itemRef = doc(db, getCatalogCollection(), item.codigo);
                    setDoc(itemRef, { stock: 0 }, { merge: true }).catch(err => console.error("Error al corregir stock negativo:", err));
                }
                return item;
            });

            if (hasNegative) {
                await setDoc(masterRef, { items: correctedItems }, { merge: true }).catch(err => console.error("Error al corregir master_catalog:", err));
            }

            allItems = correctedItems.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
            
            localStorage.setItem(getCacheKey(), JSON.stringify({
                timestamp: Date.now(),
                data: allItems
            }));
            
            allLoaded = true;
            applyFilters(reset);
        }
    } catch (e) { 
        console.error("Error al cargar el catálogo:", e); 
        if (reset) emptyState.classList.remove('hidden');
    }
    finally { isFetching = false; }
};

const applyFilters = (shouldReset = true) => {
    const text = buscador.value.trim().toLowerCase();
    if (!text) {
        filteredItems = [...allItems];
    } else {
        const termAlfanumerico = text.replace(/[^a-z0-9]/g, '');
        filteredItems = allItems.filter(i => {
            const codigo = (i.codigo || '').toLowerCase();
            const codigoAlfanumerico = codigo.replace(/[^a-z0-9]/g, '');
            const desc = (i.descripcion || '').toLowerCase();
            
            return codigo.includes(text) || desc.includes(text) || (termAlfanumerico.length > 0 && codigoAlfanumerico.includes(termAlfanumerico));
        });
    }
    updateVirtualLayout(filteredItems, true);
};

const showCatalogView = (warehouseName, labelText) => {
    selectedWarehouse = warehouseName;
    document.getElementById('catalog-title-text').textContent = `Listado: ${labelText}`;
    
    // Show/hide entrepiso header
    const colHeaderEntrepiso = document.getElementById('col-header-entrepiso');
    if (colHeaderEntrepiso) {
        if (selectedWarehouse === 'no_esteril_terminado') {
            colHeaderEntrepiso.classList.remove('hidden');
        } else {
            colHeaderEntrepiso.classList.add('hidden');
        }
    }
    
    // Toggle screens
    document.getElementById('warehouse-choice-screen').classList.add('hidden');
    document.getElementById('catalog-main-container').classList.remove('hidden');
    document.getElementById('catalog-main-container').classList.add('flex');
    
    loadCatalog(true);
};

const showChoiceScreen = () => {
    selectedWarehouse = '';
    document.getElementById('catalog-main-container').classList.add('hidden');
    document.getElementById('catalog-main-container').classList.remove('flex');
    document.getElementById('warehouse-choice-screen').classList.remove('hidden');
    
    // Hide entrepiso header
    const colHeaderEntrepiso = document.getElementById('col-header-entrepiso');
    if (colHeaderEntrepiso) {
        colHeaderEntrepiso.classList.add('hidden');
    }
    
    // Clear search and cache
    buscador.value = '';
    allItems = [];
    filteredItems = [];
    tbody.innerHTML = '';
};

const setupApp = () => {
    // Choice Screen Bindings
    document.getElementById('choice-no-esteril-terminado').addEventListener('click', () => showCatalogView('no_esteril_terminado', 'No Estéril Terminado'));
    document.getElementById('choice-esteril-terminado').addEventListener('click', () => showCatalogView('esteril_terminado', 'Estéril Terminado'));
    document.getElementById('choice-semi-elaborado').addEventListener('click', () => showCatalogView('semi_elaborado', 'Semi Elaborado'));
    document.getElementById('choice-materia-prima').addEventListener('click', () => showCatalogView('materia_prima', 'Materia Prima'));
    
    // Back to Choices
    document.getElementById('btn-back-to-choices').addEventListener('click', showChoiceScreen);

    buscador.addEventListener('input', () => applyFilters(true));

    scrollContainer.addEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);

    if (closeImageModalObj) {
        closeImageModalObj.onclick = closeModal;
    }
    
    if (imageModal) {
        imageModal.onclick = (e) => {
            if (e.target === imageModal || e.target === document.getElementById('modal-scroll-container')) {
                closeModal();
            }
        };
    }

    ['zoom-in', 'zoom-in-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); handleZoom('in'); });
    });
    ['zoom-out', 'zoom-out-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); handleZoom('out'); });
    });
    ['zoom-reset', 'zoom-reset-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });
    });

    const btnExportExcel = document.getElementById('btn-export-excel');
    const btnAddToList = document.getElementById('btn-add-to-list');
    const btnClearList = document.getElementById('btn-clear-list');
    const exportBtnText = document.getElementById('export-btn-text');
    let customExportList = [];

    const updateExportUI = () => {
        if (customExportList.length > 0) {
            exportBtnText.textContent = `Descargar Lista (${customExportList.length})`;
            exportBtnText.classList.remove('hidden', 'md:block');
            btnClearList.classList.remove('hidden');
            btnClearList.classList.add('flex');
        } else {
            exportBtnText.textContent = `Descargar a Excel`;
            btnClearList.classList.add('hidden');
            btnClearList.classList.remove('flex');
        }
    };

    if (btnAddToList) {
        btnAddToList.addEventListener('click', () => {
            if (filteredItems.length === 0) return;
            
            const icon = btnAddToList.querySelector('span');
            icon.textContent = 'check';
            setTimeout(() => icon.textContent = 'add', 1000);

            filteredItems.forEach(item => {
                if (!customExportList.some(i => i.codigo === item.codigo)) {
                    customExportList.push(item);
                }
            });
            updateExportUI();
        });
    }

    if (btnClearList) {
        btnClearList.addEventListener('click', () => {
            customExportList = [];
            updateExportUI();
        });
    }

    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            const listToExport = customExportList.length > 0 ? customExportList : filteredItems;
            
            if (listToExport.length === 0) return;
            
            const btnOriginalHtml = btnExportExcel.innerHTML;
            btnExportExcel.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Descargando...</span>';
            btnExportExcel.classList.add('pointer-events-none', 'opacity-75');

            setTimeout(() => {
                let csvContent = "";
                if (selectedWarehouse === 'no_esteril_terminado') {
                    csvContent = "\uFEFFCÓDIGO;DESCRIPCIÓN;ENTREPISO;CANTIDAD\n";
                    listToExport.forEach(item => {
                        const codigo = item.codigo ? `="${item.codigo}"` : "";
                        const desc = item.descripcion ? `"${item.descripcion.replace(/"/g, '""')}"` : "";
                        const entrepiso = item.entrepiso ? `"${item.entrepiso.replace(/"/g, '""')}"` : "";
                        const cant = item.stock || 0;
                        csvContent += `${codigo};${desc};${entrepiso};${cant}\n`;
                    });
                } else {
                    csvContent = "\uFEFFCÓDIGO;DESCRIPCIÓN;CANTIDAD\n";
                    listToExport.forEach(item => {
                        const codigo = item.codigo ? `="${item.codigo}"` : "";
                        const desc = item.descripcion ? `"${item.descripcion.replace(/"/g, '""')}"` : "";
                        const cant = item.stock || 0;
                        csvContent += `${codigo};${desc};${cant}\n`;
                    });
                }
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                
                const dateStr = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
                const timeStr = new Date().toLocaleTimeString('es-AR').replace(/:/g, '');
                
                link.setAttribute("download", `Inventario_${selectedWarehouse.toUpperCase()}_${dateStr}_${timeStr}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                btnExportExcel.innerHTML = btnOriginalHtml;
                btnExportExcel.classList.remove('pointer-events-none', 'opacity-75');
            }, 500);
        });
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { userData } = await requireDepositoAuth(['supervisor']);
        
        const nameEl = document.getElementById('user-display-name');
        if (nameEl && userData) {
            nameEl.textContent = userData.name || userData.email || 'USUARIO';
        }
        
        setupApp();
    } catch (e) { console.error(e); }
});
