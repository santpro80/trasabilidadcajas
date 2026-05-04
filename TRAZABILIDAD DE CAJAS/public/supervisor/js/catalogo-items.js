import { db, collection, getDocs, onAuthStateChanged, auth, getDoc, doc, signOut, query, orderBy, limit, startAfter } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const tbody = document.getElementById('items-tbody');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    
    // Filtros
    const searchInput = document.getElementById('searchInput');
    const filterState = document.getElementById('filterState');
    const filterFamily = document.getElementById('filterFamily');

    // Procesamiento de Imágenes
    const imageProcessorInput = document.getElementById('imageProcessorInput');
    const webpCanvas = document.getElementById('webpCanvas');
    let currentProcessingCode = null;

    let allItems = [];

    // Verificación de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
        
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDisplayNameElement) {
            userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }

        loadCatalog();
    });

    const formatCode = (rawCode) => {
        if (!rawCode) return '-';
        let code = String(rawCode).trim();
        // Si el código tiene exactamente 7 dígitos y no tiene guiones, lo formateamos a 2-3-2
        if (/^\d{7}$/.test(code)) {
            return `${code.substring(0, 2)}-${code.substring(2, 5)}-${code.substring(5, 7)}`;
        }
        return code;
    };

    let isFetching = false;
    let allLoaded = false;
    let renderLimit = 50;

    const loadCatalog = async () => {
        if (isFetching || allLoaded) return;
        isFetching = true;
        
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';

        try {
            const catalogRef = collection(db, "catalogo_items");
            const q = query(catalogRef, orderBy("codigo", "asc"));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                emptyState.style.display = 'flex';
            } else {
                allItems = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    codigo_format: formatCode(doc.data().codigo)
                }));
                
                allLoaded = true;
                populateFamilyFilter(allItems);
                applyFilters(true);
            }
        } catch (error) {
            console.error("Error al cargar el catálogo:", error);
            emptyState.style.display = 'flex';
        } finally {
            isFetching = false;
            loadingState.style.display = 'none';
        }
    };

    const populateFamilyFilter = (items) => {
        const families = [...new Set(items.map(i => i.familia).filter(f => f))].sort();
        filterFamily.innerHTML = '<option value="">FAMILIA (TODAS)</option>';
        families.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.toLowerCase();
            opt.textContent = f;
            filterFamily.appendChild(opt);
        });
    };

    const getBadgeStyle = (estado) => {
        const estadoNorm = (estado || '').toLowerCase();
        // A revisar: Amarillo apagado
        if (estadoNorm.includes('revisar')) return "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400";
        // Presente: Verde opaco claro
        if (estadoNorm === 'presente') return "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400";
        // No aprobada: Azul oscuro letras blancas
        if (estadoNorm.includes('no aprobada')) return "bg-[#1e3a8a] text-white";
        // Descripcion repetida: Gris neutro oscuro
        if (estadoNorm.includes('repetida')) return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
        // Fuera de uso: Celeste claro opaco
        if (estadoNorm.includes('fuera de uso')) return "bg-sky-100/80 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
        
        // Default
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    };

    // Configuramos el modal y visor 3D genéricos una sola vez
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const modal3d = document.getElementById('modal-3d');
    const modalCaption = document.getElementById('modal-caption');

    let currentScale = 1;
    let is3dActive = false;

    const openModal = () => {
        currentScale = 1;
        modalImage.style.transform = `scale(1)`;
        if (is3dActive && modal3d.cameraOrbit) {
            modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
            if(typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
        }

        imageModal.classList.remove('hidden');
        void imageModal.offsetWidth; // Reflow
        imageModal.classList.add('opacity-100');
        
        const zControls = document.getElementById('zoom-controls');
        const zControlsMob = document.getElementById('zoom-controls-mobile');
        if(zControls) zControls.classList.remove('opacity-0');
        if(zControlsMob) zControlsMob.classList.remove('opacity-0');
    };

    modal3d?.addEventListener('error', (e) => {
         modalCaption.textContent = `Error: Archivo 3D no encontrado para ${modalCaption.textContent.split(': ')[1]}`;
         modal3d.classList.add('hidden');
    });

    let currentFilteredItems = [];

    const scrollContainer = document.getElementById('scroll-container');
    const virtualStretcher = document.getElementById('virtual-stretcher');

    let ticking = false;

    const renderRows = () => {
        if (currentFilteredItems.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }
        emptyState.style.display = 'none';

        const itemsToRender = currentFilteredItems.slice(0, renderLimit);
        tbody.innerHTML = itemsToRender.map(item => {
            const badgeStyle = getBadgeStyle(item.estado);
            const imgPath = `../assets/items/${item.codigo_format}.webp`;
            
            return `
                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-200 dark:border-white/5">
                    <td class="py-2 px-4 text-center">
                        <div class="relative w-[72px] h-[72px] mx-auto rounded-lg border border-slate-200 dark:border-slate-300 bg-slate-100 dark:bg-slate-200 overflow-hidden shadow-inner flex items-center justify-center">
                            <span class="material-symbols-outlined text-[24px] text-slate-300 dark:text-slate-400 absolute z-0">image</span>
                            <img src="${imgPath}" alt="${item.codigo_format}" 
                                class="w-[90%] h-[90%] object-contain relative z-10 transition-transform group-hover:scale-105"
                                loading="lazy"
                                onerror="this.style.opacity='0'"
                                onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                            
                            <div class="absolute inset-0 z-20 flex flex-col md:flex-row items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm bg-white/70 dark:bg-slate-900/70 p-1">
                                <button class="view-3d-btn p-1 md:p-1.5 rounded-md bg-purple-500/90 hover:bg-purple-600 dark:bg-purple-500/80 dark:hover:bg-purple-500 text-white shadow-sm transition-colors" data-code="${item.codigo_format}" title="Ver modelo 3D">
                                    <span class="material-symbols-outlined text-[18px] md:text-[20px]">3d_rotation</span>
                                </button>
                                <button class="add-img-btn p-1 md:p-1.5 rounded-md bg-villalba-blue/90 hover:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-sm transition-colors" data-code="${item.codigo_format}" title="Cambiar foto">
                                    <span class="material-symbols-outlined text-[18px] md:text-[20px]">upload</span>
                                </button>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight whitespace-nowrap block">${item.codigo_format}</span>
                    </td>
                    <td class="py-3 px-4">
                        <p class="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed max-w-[400px] md:max-w-none whitespace-normal line-clamp-2">
                            ${item.descripcion || '-'}
                        </p>
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded border border-transparent dark:border-white/5 text-[9.5px] font-black uppercase tracking-widest ${badgeStyle}">
                            ${item.estado || 'SIN ESTADO'}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-[10.5px] font-black tracking-widest text-slate-500 shadow-sm">
                            ${item.familia || 'N/A'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Re-asignar listeners
        tbody.querySelectorAll('.add-img-btn').forEach(btn => {
            btn.onclick = () => {
                currentProcessingCode = btn.dataset.code;
                imageProcessorInput.click();
            };
        });

        tbody.querySelectorAll('.view-3d-btn').forEach(btn => {
            btn.onclick = () => {
                is3dActive = true;
                const code = btn.dataset.code;
                const glbPath = `../assets/3d/${code}.glb`;
                modalImage.classList.add('hidden');
                modal3d.classList.remove('hidden');
                if (modal3d.getAttribute('src') !== glbPath) modal3d.src = glbPath;
                modalCaption.textContent = `Modelo 3D - Código: ${code}`;
                openModal();
            };
        });
    };
    let lastScrollHeight = 0;
    
    const handleScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                
                // Evitar que cargue si no hay suficiente contenido para scrollear o si no se ha llegado al final real
                if (scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 100) {
                    if (renderLimit < currentFilteredItems.length && scrollHeight !== lastScrollHeight) {
                        lastScrollHeight = scrollHeight;
                        renderLimit += 50;
                        renderRows();
                    }
                }
                ticking = false;
            });
            ticking = true;
        }
    };

    const updateVirtualLayout = (items, shouldReset = false) => {
        currentFilteredItems = items || [];
        virtualStretcher.style.display = 'none'; 
        
        if (shouldReset) {
            renderLimit = 50;
            scrollContainer.scrollTop = 0;
            lastScrollHeight = 0;
        }
        renderRows();
    };

    scrollContainer.addEventListener('scroll', handleScroll);

    // LOGICA DE CONVERSIÓN DE IMAGEN PARA LOCAL ASSETS
    imageProcessorInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !currentProcessingCode) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const ctx = webpCanvas.getContext('2d');
                // Mantener proporciones, max 800px ancho
                const maxW = 400; 
                const scale = Math.min(maxW / img.width, 1);
                webpCanvas.width = img.width * scale;
                webpCanvas.height = img.height * scale;
                
                // Limpiar el canvas totalmente para transparencia
                ctx.clearRect(0, 0, webpCanvas.width, webpCanvas.height);
                ctx.drawImage(img, 0, 0, webpCanvas.width, webpCanvas.height);

                const webpDataUrl = webpCanvas.toDataURL('image/webp', 0.85); // 85% calidad compresión

                // Forzar descarga al navegador
                const a = document.createElement('a');
                a.href = webpDataUrl;
                a.download = `${currentProcessingCode}.webp`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                alert(`Imagen convertida y guardada en 'Descargas' como ${currentProcessingCode}.webp\n\nInstrucción:\nMás tarde, mueva este archivo a la carpeta public/assets/items/ de su proyecto.`);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
        
        // reset input
        imageProcessorInput.value = '';
    });

    function applyFilters() { // No recibir el evento como shouldReset para no romper la logica
        const term = searchInput.value.toLowerCase();
        const estFilter = filterState.value.toLowerCase();
        const famFilter = filterFamily.value.toLowerCase();

        const filtered = allItems.filter(item => {
            const codigo = (item.codigo_format || '').toLowerCase();
            const desc = (item.descripcion || '').toLowerCase();
            
            const codigoAlfanumerico = codigo.replace(/[^a-z0-9]/g, '');
            const termAlfanumerico = term.replace(/[^a-z0-9]/g, '');
            
            const fam = (item.familia || '').toLowerCase();
            const est = (item.estado || '').toLowerCase();

            const matchesSearch = codigo.includes(term) || desc.includes(term) || (termAlfanumerico.length > 0 && codigoAlfanumerico.includes(termAlfanumerico));
            const matchesState = estFilter === '' || est === estFilter;
            const matchesFamily = famFilter === '' || fam === famFilter;

            return matchesSearch && matchesState && matchesFamily;
        });

        updateVirtualLayout(filtered, true);
    };

    searchInput.addEventListener('input', applyFilters);
    filterState.addEventListener('change', applyFilters);
    filterFamily.addEventListener('change', applyFilters);

    // Lógica de Zoom
    const zControls = document.getElementById('zoom-controls');
    const zControlsMob = document.getElementById('zoom-controls-mobile');
    
    const handleZoom = (direction) => {
        if (is3dActive) {
            if (typeof modal3d.zoom === 'function') {
                // positive delta zooms in for model-viewer actually
                modal3d.zoom(direction === 'in' ? 3 : -3);
            }
        } else {
            currentScale = direction === 'in' ? currentScale + 0.35 : Math.max(0.35, currentScale - 0.35);
            modalImage.style.transform = `scale(${currentScale})`;
            modalImage.style.transition = 'transform 0.3s ease-out';
        }
    };

    const resetZoom = () => {
        if (is3dActive) {
            modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
            if(typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
        } else {
            currentScale = 1;
            modalImage.style.transform = `scale(1)`;
        }
    };

    ['zoom-in', 'zoom-in-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); handleZoom('in'); });
    });
    ['zoom-out', 'zoom-out-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); handleZoom('out'); });
    });
    ['zoom-reset', 'zoom-reset-mob'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); resetZoom(); });
    });

    // Modal de imagen/3D cerrar
    const closeModal = () => {
        imageModal.classList.remove('opacity-100');
        if(zControls) zControls.classList.add('opacity-0');
        if(zControlsMob) zControlsMob.classList.add('opacity-0');
        
        setTimeout(() => {
            imageModal.classList.add('hidden');
            modalImage.style.transform = `scale(1)`;
            if (is3dActive && modal3d.cameraOrbit) {
                modal3d.setAttribute('camera-orbit', '0deg 90deg auto');
                if(typeof modal3d.jumpCameraToGoal === 'function') modal3d.jumpCameraToGoal();
            }
            is3dActive = false;
        }, 300);
    };

    document.getElementById('close-image-modal')?.addEventListener('click', closeModal);
    imageModal?.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            closeModal();
        }
    });

    // Cerrar sesión
    logoutBtn?.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = '../login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});
