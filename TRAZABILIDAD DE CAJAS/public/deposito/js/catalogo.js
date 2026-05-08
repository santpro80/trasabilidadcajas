import { db, collection, query, getDocs, orderBy, limit, startAfter, requireDepositoAuth } from './firebase-config-deposito.js';

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

        return `
            <tr style="height: ${ROW_HEIGHT}px" class="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-slate-800/50">
                <td class="py-2 px-6">
                    <div class="relative w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center cursor-pointer item-img-clickable">
                        <span class="material-symbols-outlined absolute text-2xl text-slate-300 dark:text-slate-700 transition-transform group-hover:scale-110">inventory_2</span>
                        <img src="../assets/items/${item.codigo}.webp" alt="${item.codigo}" 
                             class="max-h-full max-w-full object-contain relative z-10 transition-transform group-hover:scale-110" 
                             loading="lazy"
                             onerror="this.style.opacity='0'" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                    </div>
                </td>
                <td class="py-2 px-6">
                    <span class="text-sm font-black text-villalba-blue dark:text-blue-400 uppercase tracking-widest">${item.codigo}</span>
                </td>
                <td class="py-2 px-6">
                    <p class="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide leading-relaxed line-clamp-2">${item.descripcion || 'Sin descripción'}</p>
                </td>
                <td class="py-2 px-6 text-center">
                    <span class="px-4 py-1.5 rounded-lg border ${stockColor} font-black text-xs uppercase tracking-widest">
                        ${stockActual}
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
    
    document.querySelectorAll('.item-img-clickable').forEach(el => {
        el.onclick = () => {
            const img = el.querySelector('img');
            if (img && img.style.opacity !== '0') {
                enlargedImage.src = img.src;
                imageModal.classList.remove('hidden');
                setTimeout(() => imageModal.classList.remove('opacity-0'), 10);
            }
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
    if (isFetching || (allLoaded && !reset)) return;
    isFetching = true;

    if (reset) {
        allItems = [];
        allLoaded = false;
        scrollContainer.scrollTop = 0;
    }

    try {
        const CACHE_KEY = 'villalba_items_cache';
        const CACHE_EXPIRY = 1000 * 60 * 60 * 2; // 2 horas
        const cached = localStorage.getItem(CACHE_KEY);
        
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            // Reusar caché si es válido y no está vacío
            if (Date.now() - timestamp < CACHE_EXPIRY && data && data.length > 0) {
                console.log(`Cargando ${data.length} ítems desde caché local.`);
                // Asegurar ordenamiento
                allItems = data.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
                allLoaded = true;
                applyFilters(reset);
                isFetching = false;
                return;
            }
        }

        console.log("Descargando catálogo desde Firestore...");
        const catalogRef = collection(db, 'deposito_catalogo');
        const q = query(catalogRef, orderBy("codigo", "asc"));

        const snap = await getDocs(q);
        if (snap.empty) {
            allLoaded = true;
            if (reset) emptyState.classList.remove('hidden');
        } else {
            allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Guardar en caché compartido
            localStorage.setItem(CACHE_KEY, JSON.stringify({
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
    // we use true to always reset virtual view on filter change
    updateVirtualLayout(filteredItems, true);
};

const setupApp = () => {
    buscador.addEventListener('input', () => applyFilters(true));

    scrollContainer.addEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);

    if (closeImageModalObj) {
        closeImageModalObj.onclick = () => {
            imageModal.classList.add('opacity-0');
            setTimeout(() => imageModal.classList.add('hidden'), 300);
        };
    }
    imageModal.onclick = (e) => {
        if (e.target === imageModal) closeImageModalObj.onclick();
    };

    loadCatalog(true);
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { userData } = await requireDepositoAuth(['supervisor']);
        
        // Actualizar el nombre de perfil si el elemento existe
        const nameEl = document.getElementById('user-display-name');
        if (nameEl && userData) {
            nameEl.textContent = userData.name || userData.email || 'USUARIO';
        }
        
        setupApp();
    } catch (e) { console.error(e); }
});
