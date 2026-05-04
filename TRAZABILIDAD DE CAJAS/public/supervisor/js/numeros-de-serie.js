import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, deleteDoc, updateDoc,
    registrarHistorial, 
    registrarMovimientoCaja
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelNameDisplay = document.getElementById('model-name-display');
    const serialNumbersList = document.getElementById('serialNumbersList');
    const addCajaBtn = document.getElementById('add-caja-btn');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
    const menuBtn = document.getElementById('menu-btn');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteModalText = document.getElementById('delete-modal-text');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const modalSpinner = document.getElementById('modal-spinner');
    const serialSearchInput = document.getElementById('search-input');
    const confirmEntryModal = document.getElementById('confirmEntryModal');
    const confirmEntryModalText = document.getElementById('confirm-entry-modal-text');
    const cancelEntryBtn = document.getElementById('cancel-entry-btn');
    const confirmEntryBtn = document.getElementById('confirm-entry-btn');

    // Inyectar estilos para animación hover (efecto visual suave)
    const style = document.createElement('style');
    style.textContent = `
        .list-item {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .list-item:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
    `;
    document.head.appendChild(style);

    let currentModelName = '';
    let currentZonaName = '';
    let serialToDelete = null;
    let serialToConfirmEntry = null;
    let allSerials = [];
    let userRole = 'operario'; 
    let notificationTimeout;
    const showNotification = (message, type = 'success') => {
        const toast = document.getElementById('notification-toast');
        const icon = document.getElementById('toast-icon');
        const msg = document.getElementById('toast-message');
        if (!toast || !icon || !msg) return;

        const toastContent = toast.querySelector('.toast-content');
        if (!toastContent) return;

        clearTimeout(notificationTimeout);
        msg.textContent = message;
        icon.textContent = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
        
        // Setup inner content styling specifically for Light/Dark differences
        toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300';
        
        if (type === 'success') {
            toastContent.className += ' bg-emerald-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-emerald-500/30 dark:text-emerald-400';
        } else if (type === 'error') {
            toastContent.className += ' bg-rose-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-rose-500/30 dark:text-rose-400';
        } else {
            toastContent.className += ' bg-slate-800 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-white/10 dark:text-slate-200';
        }

        // Setup outer wrapper just for positioning
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-full transition-all duration-500';
        
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        notificationTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 3000);
    };

    onAuthStateChanged(auth, async (user) => {

        if (!user) { window.location.href = 'login.html'; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                userRole = userDocSnap.data().role || 'operario';
            }
            if (userDisplayName) { userDisplayName.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email; }
            
            if (userRole === 'supervisor' || userRole === 'operario') {
                if(addCajaBtn) addCajaBtn.style.display = 'block';
            }

            loadSerialNumbers();
            
            const pendingNotification = sessionStorage.getItem('reportNotification');
            if (pendingNotification) {
                try {
                    const data = JSON.parse(pendingNotification);
                    setTimeout(() => {
                        showNotification(data.message, data.type);
                    }, 500);
                } catch(e) {}
                sessionStorage.removeItem('reportNotification');
            }

        } catch (error) {
            console.error("Error al obtener rol del usuario:", error);
            loadSerialNumbers();
        }
    });
    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, serialNumbersList].forEach(el => {
            if (el) el.classList.add('hidden');
        });
        if (stateElement) {
            stateElement.classList.remove('hidden');
            if (stateElement === serialNumbersList) {
                stateElement.classList.add('flex');
            }
        }
    };

    const loadSerialNumbers = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        currentModelName = urlParams.get('modelName');
        currentZonaName = urlParams.get('zonaName');

        if (!currentModelName || !currentZonaName) {
            modelNameDisplay.textContent = "Error: Faltan datos";
            showState(errorState); return;
        }
        modelNameDisplay.textContent = `Números de Serie para: ${currentModelName.toUpperCase()}`;

        try {
            const zonaDocRef = doc(db, "Cajas", currentZonaName);
            const zonaDocSnap = await getDoc(zonaDocRef);
            serialNumbersList.innerHTML = '';

            if (zonaDocSnap.exists()) {
                const serialsString = zonaDocSnap.data()[currentModelName];
                if (serialsString && typeof serialsString === 'string') {
                    allSerials = serialsString.split(',').map(s => s.trim()).filter(Boolean);
                    renderSerialNumbers(allSerials);
                } else { showState(emptyState); }
            } else { showState(emptyState); }
        } catch (error) {
            console.error("Error cargando números de serie:", error);
            showState(errorState);
        }
    };

    const renderSerialNumbers = (serials) => {
        serialNumbersList.innerHTML = '';
        if (serials.length === 0) {
            showState(emptyState);
            return;
        }

        const groups = {};
        serials.forEach(serial => {
            const letter = serial.charAt(0).toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(serial);
        });

        serialNumbersList.className = 'flex flex-col gap-6 w-full';

        const sortedKeys = Object.keys(groups).sort();

        sortedKeys.forEach(key => {
            const groupSerials = groups[key].sort();

            const groupContainer = document.createElement('div');
            groupContainer.className = 'flex flex-col gap-4';
            
            const title = document.createElement('h3');
            title.className = 'text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 px-2';
            title.textContent = `Serie ${key}`;
            groupContainer.appendChild(title);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'flex flex-col gap-2';

            groupSerials.forEach(serial => {
                const item = document.createElement('div');
                item.className = 'group flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm hover:shadow-md cursor-pointer';
                
                item.innerHTML = `
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-villalba-blue/5 dark:bg-villalba-blue/10 flex items-center justify-center text-villalba-blue">
                            <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                        </div>
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-tight truncate">${serial}</span>
                    </div>
                `;

                if (userRole === 'supervisor') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/10 ml-2';
                    deleteBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete</span>';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        openDeleteModal(serial);
                    };
                    item.appendChild(deleteBtn);
                }

                item.onclick = () => {
                    const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
                    window.location.href = url;
                };

                itemsContainer.appendChild(item);
            });

            groupContainer.appendChild(itemsContainer);
            serialNumbersList.appendChild(groupContainer);
        });

        showState(serialNumbersList);
    };

    const deleteCaja = async () => {
        if (!serialToDelete) return;
        
        modalSpinner.style.display = 'block';
        confirmDeleteBtn.disabled = true;
        cancelDeleteBtn.disabled = true;

        try {
            const itemDocRef = doc(db, "Items", serialToDelete);
            await deleteDoc(itemDocRef);

            const zonaDocRef = doc(db, "Cajas", currentZonaName);
            const zonaDocSnap = await getDoc(zonaDocRef);
            if (zonaDocSnap.exists()) {
                const zonaData = zonaDocSnap.data();
                const serialsString = zonaData[currentModelName] || "";
                const serialsArray = serialsString.split(',').map(s => s.trim()).filter(Boolean);
                const updatedSerialsArray = serialsArray.filter(s => s !== serialToDelete);
                await updateDoc(zonaDocRef, {
                    [currentModelName]: updatedSerialsArray.join(',')
                });
            }
            
            registrarHistorial('ELIMINACIÓN DE CAJA', {
                cajaSerie: serialToDelete,
                modelo: currentModelName,
                mensaje: `Se eliminó la caja "${serialToDelete.toUpperCase()}" (Modelo: ${currentModelName.toUpperCase()}) y todos sus ítems.`
            });

            showNotification(`Caja "${serialToDelete.toUpperCase()}" eliminada con éxito.`, 'success');
            
            closeDeleteModal();
            loadSerialNumbers();

        } catch (error) {
            console.error("Error al eliminar la caja:", error);
            showNotification("Ocurrió un error al eliminar la caja.", 'error');
        } finally {
            modalSpinner.style.display = 'none';
            confirmDeleteBtn.disabled = false;
            cancelDeleteBtn.disabled = false;
        }
    };
    
    const openConfirmEntryModal = (serial) => {
        serialToConfirmEntry = serial;
        confirmEntryModalText.textContent = `¿Estás seguro de que deseas registrar una entrada para la caja "${serial.toUpperCase()}"?`;
        confirmEntryModal.style.display = 'flex';
    };

    const closeConfirmEntryModal = () => {
        confirmEntryModal.style.display = 'none';
        serialToConfirmEntry = null;
    };

    const openDeleteModal = (serial) => {
        serialToDelete = serial;
        deleteModalText.textContent = `¿Estás seguro de que deseas eliminar la caja "${serial.toUpperCase()}"? Esta acción es permanente.`;
        if (deleteConfirmModal) {
            deleteConfirmModal.classList.remove('hidden');
            deleteConfirmModal.classList.add('flex');
        }
    };
    const closeDeleteModal = () => {
        if (deleteConfirmModal) {
            deleteConfirmModal.classList.add('hidden');
            deleteConfirmModal.classList.remove('flex');
        }
        serialToDelete = null;
    };
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', deleteCaja);

    if (serialSearchInput) {
        serialSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredSerials = allSerials.filter(serial => serial.toLowerCase().includes(searchTerm));
            renderSerialNumbers(filteredSerials);
        });
    }

    cancelEntryBtn.addEventListener('click', closeConfirmEntryModal);
    confirmEntryBtn.addEventListener('click', async () => {
        if (!serialToConfirmEntry) return;

        try {
            showNotification(`Registrando entrada para ${serialToConfirmEntry.toUpperCase()}...`, 'info');
            await registrarMovimientoCaja('Entrada', serialToConfirmEntry, currentModelName);
            showNotification(`Entrada de caja "${serialToConfirmEntry.toUpperCase()}" registrada.`, 'success');
        } catch (error) {
            showNotification(`Error al registrar entrada para "${serialToConfirmEntry.toUpperCase()}".`, 'error');
            console.error("Error al registrar entrada:", error);
        } finally {
            closeConfirmEntryModal();
        }
    });
console.log('Hello, world!');
    addCajaBtn.addEventListener('click', () => {
        localStorage.setItem('tracingStartTime', Date.now());
        localStorage.setItem('tracingModelName', currentModelName);
        localStorage.setItem('tracingZonaName', currentZonaName);
        window.location.href = `agregar-caja.html?modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
    });
    backBtn.addEventListener('click', () => {
        window.location.href = `modelado-caja.html?zonaName=${encodeURIComponent(currentZonaName)}`;
    });

    menuBtn.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = '../login.html';
    });
});