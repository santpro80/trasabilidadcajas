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
        if (!toast) return;
        clearTimeout(notificationTimeout);
        toast.textContent = message;
        toast.className = 'show';
        toast.classList.add(type === 'success' ? 'success' : 'error');
        notificationTimeout = setTimeout(() => {
            toast.classList.remove('show');
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
        } catch (error) {
            console.error("Error al obtener rol del usuario:", error);
            loadSerialNumbers();
        }
    });
    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, serialNumbersList].forEach(el => el.style.display = 'none');
        if (stateElement) { stateElement.style.display = 'block'; }
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

        // 1. Agrupar por primera letra
        const groups = {};
        serials.forEach(serial => {
            const letter = serial.charAt(0).toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(serial);
        });

        // 2. Configurar estilos para columnas (Flexbox)
        serialNumbersList.style.display = 'flex';
        serialNumbersList.style.flexWrap = 'wrap';
        serialNumbersList.style.gap = '20px';
        serialNumbersList.style.alignItems = 'flex-start';

        const sortedKeys = Object.keys(groups).sort();

        // 3. Renderizar cada columna
        sortedKeys.forEach(key => {
            const groupSerials = groups[key].sort(); // Orden alfabético/numérico automático

            const columnLi = document.createElement('li');
            columnLi.style.listStyle = 'none';
            columnLi.style.flex = '1 1 300px'; // Ancho flexible
            columnLi.style.padding = '10px';
            
            const title = document.createElement('h3');
            title.textContent = `Serie ${key}`;
            title.style.textAlign = 'center';
            title.style.marginBottom = '15px';
            columnLi.appendChild(title);

            const subList = document.createElement('ul');
            subList.style.listStyle = 'none';
            subList.style.padding = '0';
            subList.style.display = 'flex';
            subList.style.flexDirection = 'column';
            subList.style.gap = '10px';

            groupSerials.forEach(serial => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.style.width = '100%';
                
                let buttonsContainer = document.createElement('div');
                buttonsContainer.className = 'action-buttons-container';

                if (userRole === 'supervisor') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-delete-caja';
                    deleteBtn.title = 'Eliminar caja';
                    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openDeleteModal(serial);
                    });
                    buttonsContainer.appendChild(deleteBtn);
                }
                
                const serialContainer = document.createElement('div');
                serialContainer.className = 'serial-container';
                serialContainer.innerHTML = `<span class="serial-text">${serial.toUpperCase()}</span>`;
                serialContainer.addEventListener('click', () => {
                    const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
                    window.location.href = url;
                });

                li.appendChild(serialContainer);
                li.appendChild(buttonsContainer);
                subList.appendChild(li);
            });
            columnLi.appendChild(subList);
            serialNumbersList.appendChild(columnLi);
        });
        showState(serialNumbersList);
        serialNumbersList.style.display = 'flex'; // Forzar flex después de showState
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
        deleteModalText.textContent = `¿Estás seguro de que deseas eliminar la caja "${serial.toUpperCase()}" y todos sus ítems? Esta acción es permanente.`;
        deleteConfirmModal.style.display = 'flex';
    };
    const closeDeleteModal = () => {
        deleteConfirmModal.style.display = 'none';
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