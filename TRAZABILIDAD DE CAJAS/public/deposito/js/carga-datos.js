import { db, doc, getDoc, getDocs, collection, query, serverTimestamp, addDoc, setDoc, onSnapshot, orderBy, limit, requireDepositoAuth } from './firebase-config-deposito.js';

let depositoItemsCache = [];
let stagedMovements = [];
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
            isFetching = true;
            input.disabled = true;
            input.placeholder = "Cargando ítems...";
            console.log("Iniciando fetchListaItems...");
            
            const CACHE_KEY = 'villalba_items_cache';
            const CACHE_EXPIRY = 1000 * 60 * 60 * 2; // 2 horas
            const cached = localStorage.getItem(CACHE_KEY);
            
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY && data && data.length > 0) {
                    console.log(`Cargando ${data.length} ítems desde caché local.`);
                    depositoItemsCache = data;
                    input.disabled = false;
                    input.placeholder = "Ej: 4211800";
                    isFetching = false;
                    
                    if (input.value) input.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
            }

            console.log("Descargando ítems desde Firestore (Master Document)...");
            const masterRef = doc(db, 'system', 'master_catalog');
            const snap = await getDoc(masterRef);
            
            depositoItemsCache = [];
            if (snap.exists()) {
                const masterData = snap.data().items || [];
                console.log(`Se descargaron ${masterData.length} ítems del Master Document.`);
                depositoItemsCache = masterData;
            } else {
                console.warn("Master Document no encontrado.");
            }
            
            if (depositoItemsCache.length > 0) {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: depositoItemsCache
                }));
            } else {
                console.warn("El catálogo de Firestore está vacío, no se guardará en caché.");
                localStorage.removeItem(CACHE_KEY);
            }

            input.disabled = false;
            input.placeholder = "Ej: 4211800";
            isFetching = false;
            
            // Si el input ya tiene valor, forzamos un evento input para buscar
            if (input.value) input.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (e) {
            console.error("No se pudo cargar la lista de ítems", e);
            input.disabled = false;
            input.placeholder = "Error al cargar base maestra";
            const detalleInput = document.getElementById('detalle-pieza');
            if (detalleInput) detalleInput.value = "ERROR: No se pudo conectar con la base maestra.";
            isFetching = false;
        }
    };
    
    // Retornamos la función para poder llamarla más tarde
    return fetchListaItems;

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

        if (depositoItemsCache.length === 0) {
            if (isFetching) {
                detalleInput.value = "Cargando base maestra, por favor espera...";
            } else {
                detalleInput.value = "La base maestra de ítems está vacía.";
            }
            return;
        }

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
                    if (cantInput) {
                        cantInput.value = 1;
                        cantInput.focus();
                        cantInput.select();
                    }
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

const renderStagedItems = () => {
    const stagedSection = document.getElementById('staged-section');
    const stagedTbody = document.getElementById('staged-tbody');
    const stagedCount = document.getElementById('staged-count');

    if (stagedMovements.length === 0) {
        stagedSection.classList.add('hidden');
        return;
    }

    stagedSection.classList.remove('hidden');
    const totalUnidades = stagedMovements.reduce((acc, m) => acc + (m.cantidad || 0), 0);
    stagedCount.textContent = `${stagedMovements.length} ÍTEMS | ${totalUnidades} UNIDADES`;

    stagedTbody.innerHTML = stagedMovements.map((m, index) => {
        const esIngreso = m.tipo === 'Ingreso';
        const color = esIngreso ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        
        return `
            <tr class="hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors">
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase border ${color}">${m.tipo}</span>
                </td>
                <td class="py-3 px-4 text-xs font-black text-villalba-blue dark:text-blue-400 tracking-widest">${m.codigo}</td>
                <td class="py-3 px-4 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase truncate max-w-[150px] md:max-w-xs" title="${m.descripcion}">${m.descripcion}</td>
                <td class="py-3 px-4 text-center text-xs font-black text-slate-800 dark:text-white">${m.cantidad}</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="removeStagedItem(${index})" class="size-7 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

const saveStagedToLocal = () => {
    localStorage.setItem('deposito_staged_movements', JSON.stringify(stagedMovements));
};

const loadStagedFromLocal = () => {
    const cached = localStorage.getItem('deposito_staged_movements');
    if (cached) {
        try {
            stagedMovements = JSON.parse(cached);
            renderStagedItems();
        } catch (e) {
            console.error("Error al cargar movimientos cacheados", e);
            stagedMovements = [];
        }
    }
};

window.removeStagedItem = (index) => {
    stagedMovements.splice(index, 1);
    saveStagedToLocal();
    renderStagedItems();
};

const initForm = () => {
    const form = document.getElementById('movimiento-form');
    const statusMsg = document.getElementById('status-msg');
    const btnConfirmar = document.getElementById('btn-confirmar-todos');
    const inputs = form.querySelectorAll('input');

    // Manejar ENTER en los inputs
    inputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                form.requestSubmit();
            }
        });
    });

    // Añadir a la lista (STAGING)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const tipo = document.getElementById('tipo-movimiento').value;
        const codigo = document.getElementById('codigo-pieza').value.trim().toUpperCase();
        const descripcion = document.getElementById('detalle-pieza').value.trim();
        const cantidad = parseInt(document.getElementById('cantidad-pieza').value, 10);

        if (!codigo || isNaN(cantidad) || cantidad <= 0) {
            alert('Por favor, completa código y cantidad válida.');
            return;
        }

        // Añadir al array de pendientes
        stagedMovements.push({ tipo, codigo, descripcion, cantidad });
        saveStagedToLocal();
        
        // Reset parcial: Mantener el TIPO DE MOVIMIENTO
        const currentTipo = document.getElementById('tipo-movimiento').value;
        form.reset();
        document.getElementById('tipo-movimiento').value = currentTipo;
        
        document.getElementById('detalle-pieza').value = '';
        document.getElementById('cantidad-pieza').value = '';
        const imgC = document.getElementById('img-container');
        if (imgC) { imgC.classList.add('hidden'); imgC.classList.remove('flex'); }

        renderStagedItems();
        document.getElementById('codigo-pieza').focus();
    });

    // Confirmación final (BATCH)
    btnConfirmar.addEventListener('click', async () => {
        if (stagedMovements.length === 0) return;

        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> REGISTRANDO TODO...';
        
        try {
            for (const mov of stagedMovements) {
                // 1. Guardar Movimiento
                await addDoc(collection(db, 'deposito_movimientos'), {
                    ...mov,
                    timestamp: serverTimestamp(),
                    usuarioNombre: currentUser?.userData?.name || currentUser?.user?.email || 'Desconocido',
                    usuario: currentUser?.user?.email || 'Desconocido',
                    userId: currentUser?.user?.uid || 'Anónimo'
                });

                // 2. Actualizar Stock Catálogo Individual
                const itemRef = doc(db, 'deposito_catalogo', mov.codigo);
                const itemSnap = await getDoc(itemRef);
                const val = mov.tipo === 'Ingreso' ? mov.cantidad : -mov.cantidad;
                
                if (itemSnap.exists()) {
                    const currentStock = itemSnap.data().stock || 0;
                    await setDoc(itemRef, { stock: currentStock + val }, { merge: true });
                } else {
                    await setDoc(itemRef, {
                        codigo: mov.codigo,
                        descripcion: mov.descripcion,
                        stock: val
                    }, { merge: true });
                }
            }

            // 3. Actualizar Master Document para mantener stock sincronizado en 1 escritura
            try {
                const masterRef = doc(db, 'system', 'master_catalog');
                const masterSnap = await getDoc(masterRef);
                let masterItems = masterSnap.exists() ? (masterSnap.data().items || []) : [];
                
                stagedMovements.forEach(mov => {
                    const val = mov.tipo === 'Ingreso' ? mov.cantidad : -mov.cantidad;
                    const idx = masterItems.findIndex(i => i.codigo === mov.codigo);
                    if (idx >= 0) {
                        masterItems[idx].stock = (masterItems[idx].stock || 0) + val;
                    } else {
                        masterItems.push({ codigo: mov.codigo, descripcion: mov.descripcion, stock: val });
                    }
                });
                
                await setDoc(masterRef, { items: masterItems });
                // Limpiar caché local para forzar actualización del master
                localStorage.removeItem('villalba_items_cache');
            } catch (e) {
                console.error("Error actualizando Master Document", e);
            }

            // Limpiar todo al finalizar éxito
            stagedMovements = [];
            saveStagedToLocal();
            renderStagedItems();
            showToast();
        } catch (error) {
            console.error("Error en registro masivo: ", error);
            statusMsg.textContent = "Error al conectar. Verifica tu internet.";
            statusMsg.classList.remove('hidden');
            statusMsg.classList.add('text-rose-500', 'bg-rose-50', 'border-rose-200');
        } finally {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<span class="material-symbols-outlined text-[20px]">how_to_reg</span> Confirmar Todos los Movimientos';
        }
    });
};

const initDescSearch = () => {
    const searchInput = document.getElementById('desc-search-input');
    const searchResults = document.getElementById('desc-search-results');

    if (!searchInput || !searchResults) return;

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Si hay resultados, podríamos elegir el primero, 
            // pero por ahora solo pasamos el foco al formulario
            document.getElementById('codigo-pieza').focus();
        }
    });

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

                        // Set quantity to 1 and FOCUS
                        const cantInput = document.getElementById('cantidad-pieza');
                        if (cantInput) {
                            cantInput.value = 1;
                            cantInput.focus();
                            cantInput.select();
                        }
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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar UI de inmediato (No bloqueante)
    const fetchListaItems = initAutocomplete();
    initDescSearch();
    initForm();
    loadStagedFromLocal();

    // 2. Manejar Auth en segundo plano
    requireDepositoAuth(['operario', 'supervisor'])
        .then(authData => {
            currentUser = authData;
            const nameSpan = document.getElementById('user-display-name');
            if (nameSpan) nameSpan.textContent = authData.userData.name || authData.user.email;

            // 3. Ejecutar queries de Firestore DESPUÉS de que auth se resuelva
            fetchListaItems();
            setupLastMovementListener();
        })
        .catch(e => {
            console.error("Autenticación fallida o carga abortada", e);
        });
});
