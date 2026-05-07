import { db, doc, getDoc, getDocs, collection, query, serverTimestamp, addDoc, setDoc, onSnapshot, orderBy, limit, requireDepositoAuth } from './firebase-config-deposito.js';

let depositoItemsCache = [];
let currentUser = null;

const initAutocomplete = () => {
    const input = document.getElementById('codigo-pieza');
    const autocompleteList = document.getElementById('autocomplete-list');
    const detalleInput = document.getElementById('detalle-pieza');
    const imgContainer = document.getElementById('img-container');
    const previewPieza = document.getElementById('preview-pieza');
    
    // Modal elements
    const imageModal = document.getElementById('imageModal');
    const enlargedImage = document.getElementById('enlargedImage');
    const closeImageModalObj = document.getElementById('closeImageModal');

    let isFetching = false;

    // Cachear lista de ítems en el navegador para ahorrar lecturas a Firebase (Válido por 12 hs)
    const fetchListaItems = async () => {
        try {
            input.disabled = true;
            input.placeholder = "Cargando ítems...";
            
            const CACHE_KEY = 'villalba_items_cache';
            const CACHE_EXPIRY = 1000 * 60 * 60 * 12; // 12 horas
            const cached = localStorage.getItem(CACHE_KEY);
            
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    depositoItemsCache = data;
                    input.disabled = false;
                    input.placeholder = "Ej: 4211800";
                    return; // Retornamos temprano sin gastar lecturas
                }
            }

            // Si no hay caché o expiró, descargamos y guardamos
            const q = query(collection(db, 'deposito_catalogo'));
            const snap = await getDocs(q);
            depositoItemsCache = [];
            snap.forEach(doc => {
                depositoItemsCache.push({ id: doc.id, codigo: doc.id, ...doc.data() });
            });
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: depositoItemsCache
            }));

            input.disabled = false;
            input.placeholder = "Ej: 4211800";
        } catch (e) {
            console.error("No se pudo cargar la lista de ítems", e);
            input.disabled = false;
            input.placeholder = "Error de conexión";
        }
    };
    
    fetchListaItems();

    input.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();
        
        // Auto-formatter XX-XXX-XX
        let stripped = val.replace(/[^A-Z0-9]/g, '');
        let formatted = '';
        if (stripped.length > 0) {
            formatted += stripped.substring(0, 2);
        }
        if (stripped.length > 2) {
            formatted += '-' + stripped.substring(2, 5);
        }
        if (stripped.length > 5) {
            formatted += '-' + stripped.substring(5, 7);
        }
        
        if (input.value !== formatted) {
            input.value = formatted;
        }
        val = formatted;
        
        autocompleteList.innerHTML = '';
        detalleInput.value = '';
        
        if (!val) {
            autocompleteList.classList.add('hidden');
            imgContainer.classList.add('hidden');
            imgContainer.classList.remove('flex');
            previewPieza.style.opacity = '0';
            return;
        }

        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');
        const matches = depositoItemsCache.filter(item => {
            const codigo = item.codigo.toUpperCase();
            const desc = (item.descripcion || '').toUpperCase();
            const codigoAlfanumerico = codigo.replace(/[^A-Z0-9]/g, '');
            return codigo.includes(val) || desc.includes(val) || (valAlfanumerico.length > 0 && codigoAlfanumerico.includes(valAlfanumerico));
        });

        if (matches.length > 0) {
            autocompleteList.classList.remove('hidden');
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0";
                div.innerHTML = `
                    <span class="text-sm font-bold text-slate-800 dark:text-white whitespace-nowrap">${item.codigo}</span>
                    <span class="text-[9px] text-slate-500 font-medium uppercase tracking-widest text-right leading-tight ml-4 flex-1 break-words">${item.descripcion}</span>
                `;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent input from losing focus immediately so this registers first
                    input.value = item.codigo;
                    detalleInput.value = item.descripcion;
                    autocompleteList.classList.add('hidden');
                    
                    previewPieza.src = `../assets/items/${item.codigo}.webp`;
                    previewPieza.style.opacity = '0';
                    imgContainer.classList.remove('hidden');
                    imgContainer.classList.add('flex');

                    const cantInput = document.getElementById('cantidad-pieza');
                    if (cantInput) cantInput.value = 1;
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.classList.add('hidden');
            detalleInput.value = "Ítem no encontrado en base maestra.";
        }
    });

    // Validar si pegan directamente o escriben sin guiones
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
                 input.value = exactMatch.codigo; // Auto-formatea insertando guiones correctos
                 detalleInput.value = exactMatch.descripcion;
                 
                 previewPieza.src = `../assets/items/${exactMatch.codigo}.webp`;
                 previewPieza.style.opacity = '0';
                 imgContainer.classList.remove('hidden');
                 imgContainer.classList.add('flex');
            } else {
                 imgContainer.classList.add('hidden');
                 imgContainer.classList.remove('flex');
            }
        } else {
            imgContainer.classList.add('hidden');
            imgContainer.classList.remove('flex');
        }
    });

    // Modal Logic
    if (imgContainer) {
        imgContainer.addEventListener('click', () => {
            const img = document.getElementById('preview-pieza');
            if (img && img.style.opacity !== '0') {
                enlargedImage.src = img.src;
                imageModal.classList.remove('hidden');
                setTimeout(() => imageModal.classList.remove('opacity-0'), 10);
            }
        });
    }

    if (closeImageModalObj) {
        closeImageModalObj.onclick = () => {
            imageModal.classList.add('opacity-0');
            setTimeout(() => imageModal.classList.add('hidden'), 300);
        };
    }
    
    if (imageModal) {
        imageModal.onclick = (e) => {
            if (e.target === imageModal) closeImageModalObj.onclick();
        };
    }
};

const setupLastMovementListener = () => {
    const q = query(collection(db, 'deposito_movimientos'), orderBy('timestamp', 'desc'), limit(1));
    
    onSnapshot(q, (snap) => {
        const lmTipoCant = document.getElementById('lm-tipo-cant');
        const lmCodigo = document.getElementById('lm-codigo');
        const lmDesc = document.getElementById('lm-desc');

        if (snap.empty) {
            lmTipoCant.innerHTML = `<span class="size-2 rounded-full bg-slate-300"></span> Sin movimientos registrados`;
            lmCodigo.textContent = '--';
            lmDesc.textContent = '--';
            return;
        }

        const data = snap.docs[0].data();
        const esIngreso = data.tipo === 'Ingreso';
        
        const badgeColor = esIngreso ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border border-rose-500/20';
        const icon = esIngreso ? 'arrow_downward' : 'arrow_upward';

        lmTipoCant.innerHTML = `<span class="flex items-center gap-1 font-black uppercase text-xs tracking-widest px-2 py-0.5 rounded-md ${badgeColor}"><span class="material-symbols-outlined text-[14px]">${icon}</span> ${data.tipo}: ${data.cantidad} UDS</span>`;
        lmCodigo.textContent = data.codigo;
        lmDesc.textContent = data.descripcion || 'Sin detalle';
    });
};

const showToast = () => {
    const toast = document.getElementById('toast-notification');
    toast.classList.remove('opacity-0', 'translate-x-12', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-12', 'pointer-events-none');
    }, 3000);
};

const initForm = () => {
    const form = document.getElementById('movimiento-form');
    const statusMsg = document.getElementById('status-msg');
    const btnRegistrar = document.getElementById('btn-registrar');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('tipo-movimiento').value;
        const codigo = document.getElementById('codigo-pieza').value.trim().toUpperCase();
        const descripcion = document.getElementById('detalle-pieza').value.trim();
        const cantidad = parseInt(document.getElementById('cantidad-pieza').value, 10);

        if (!codigo || isNaN(cantidad) || cantidad <= 0) {
            alert('Campos inválidos.');
            return;
        }

        btnRegistrar.disabled = true;
        btnRegistrar.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> REGISTRANDO...';
        
        try {
            // Guardar el registro de movimiento
            await addDoc(collection(db, 'deposito_movimientos'), {
                tipo,
                codigo,
                descripcion,
                cantidad,
                timestamp: serverTimestamp(),
                usuarioNombre: currentUser?.userData?.name || currentUser?.user?.email || 'Desconocido',
                usuario: currentUser?.user?.email || 'Desconocido',
                userId: currentUser?.user?.uid || 'Anónimo'
            });

            // Actualizar stock total en el Catálogo
            try {
                const itemRef = doc(db, 'deposito_catalogo', codigo);
                const itemSnap = await getDoc(itemRef);
                
                if (itemSnap.exists()) {
                    const currentStock = itemSnap.data().stock || 0;
                    const val = tipo === 'Ingreso' ? cantidad : -cantidad;
                    const stockResultante = currentStock + val;
                    
                    await setDoc(itemRef, { stock: stockResultante }, { merge: true });
                } else {
                    // Si el item sale de la nada (no catalogado formalmente pero ingresado manual)
                    // lo creamos con stock inicial
                    const val = tipo === 'Ingreso' ? cantidad : -cantidad;
                    await setDoc(itemRef, {
                        codigo: codigo,
                        descripcion: descripcion,
                        stock: val
                    }, { merge: true });
                }
            } catch (err) {
                console.error("No se pudo actualizar el stock total del ítem: ", err);
            }

            form.reset();
            document.getElementById('detalle-pieza').value = '';
            document.getElementById('cantidad-pieza').value = '';
            
            const imgC = document.getElementById('img-container');
            if (imgC) {
                imgC.classList.add('hidden');
                imgC.classList.remove('flex');
            }
            
            showToast();
        } catch (error) {
            console.error("Error guardando movimiento: ", error);
            statusMsg.textContent = "Error al conectar. Verifica tu internet.";
            statusMsg.classList.remove('hidden');
            statusMsg.classList.add('text-rose-500', 'bg-rose-50', 'border-rose-200');
        } finally {
            btnRegistrar.disabled = false;
            btnRegistrar.innerHTML = '<span class="material-symbols-outlined text-[20px]">how_to_reg</span> Registrar Movimiento';
        }
    });
};

const initDescSearch = () => {
    const searchInput = document.getElementById('desc-search-input');
    const searchResults = document.getElementById('desc-search-results');

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase().trim();
        searchResults.innerHTML = '';
        
        if (!val) {
            searchResults.innerHTML = `
                <div class="p-6 text-center text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-widest flex flex-col items-center gap-2">
                    <span class="material-symbols-outlined text-3xl">manage_search</span>
                    Escribe para buscar...
                </div>
            `;
            return;
        }

        const matches = depositoItemsCache.filter(item => {
            const desc = (item.descripcion || '').toUpperCase();
            return desc.includes(val);
        });

        if (matches.length > 0) {
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = "px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0 flex justify-between items-center gap-4 cursor-pointer group";
                div.innerHTML = `
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-tight break-words flex-1 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">${item.descripcion}</span>
                    <span class="text-xs font-black text-villalba-blue bg-villalba-blue/10 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm border border-villalba-blue/20 tracking-widest">${item.codigo}</span>
                `;
                // If clicked, we can optionally fill the main input
                div.addEventListener('click', () => {
                    const mainInput = document.getElementById('codigo-pieza');
                    if (mainInput) {
                        mainInput.value = item.codigo;
                        // Trigger the input event to auto-fill the description and load image
                        const event = new Event('input', { bubbles: true });
                        mainInput.dispatchEvent(event);
                        // Also trigger blur to close the main autocomplete
                        mainInput.dispatchEvent(new Event('blur'));

                        // Set quantity to 1
                        const cantInput = document.getElementById('cantidad-pieza');
                        if (cantInput) cantInput.value = 1;
                    }
                });
                searchResults.appendChild(div);
            });
        } else {
            searchResults.innerHTML = `
                <div class="p-6 text-center text-amber-500 text-[10px] uppercase font-bold tracking-widest flex flex-col items-center gap-2">
                    <span class="material-symbols-outlined text-3xl mb-1">search_off</span>
                    No se encontró ninguna pieza con esa descripción.
                </div>
            `;
        }
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        currentUser = await requireDepositoAuth(['operario', 'supervisor']);
        initAutocomplete();
        initDescSearch();
        initForm();
        setupLastMovementListener();
    } catch (e) {
        console.error("Autenticación fallida o carga abortada", e);
    }
});
