// public/js/numeros-de-serie.js

import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, deleteDoc, updateDoc,
    registrarHistorial, // <-- Importamos la nueva función
    registrarMovimientoCaja
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // ... (la declaración de elementos del DOM no cambia)
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

    // New elements for entry confirmation modal
    const confirmEntryModal = document.getElementById('confirmEntryModal');
    const confirmEntryModalText = document.getElementById('confirm-entry-modal-text');
    const cancelEntryBtn = document.getElementById('cancel-entry-btn');
    const confirmEntryBtn = document.getElementById('confirm-entry-btn');

    let currentModelName = '';
    let currentZonaName = '';
    let serialToDelete = null;
    let serialToConfirmEntry = null; // New variable to store serial for entry confirmation
    let userRole = 'operario'; 

    // ... (La función showNotification no cambia)
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
        // ... (Esta función no cambia)
        if (!user) { window.location.href = 'login.html'; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                userRole = userDocSnap.data().role || 'operario';
            }
            if (userDisplayName) { userDisplayName.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email; }
            
            if (userRole === 'supervisor') {
                if(addCajaBtn) addCajaBtn.style.display = 'block';
            }

            loadSerialNumbers();
        } catch (error) {
            console.error("Error al obtener rol del usuario:", error);
            loadSerialNumbers();
        }
    });

    // ... (La función showState y loadSerialNumbers no cambian)
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
                    const serials = serialsString.split(',').map(s => s.trim()).filter(Boolean);
                    if (serials.length === 0) { showState(emptyState); return; }

                    serials.forEach(serial => {
                        const li = document.createElement('li');
                        li.className = 'list-item';
                        
                        let buttonsContainer = document.createElement('div');
                        buttonsContainer.className = 'action-buttons-container';

                        // Botón de Registrar Entrada (visible para todos)
                        const registrarBtn = document.createElement('button');
                        registrarBtn.className = 'btn-register-entry';
                        registrarBtn.title = 'Registrar Entrada Simple';
                        registrarBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`;
                        registrarBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            openConfirmEntryModal(serial);
                        });
                        buttonsContainer.appendChild(registrarBtn);

                        // Botón de Eliminar (solo para supervisores)
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
                        serialNumbersList.appendChild(li);
                    });
                    showState(serialNumbersList);
                } else { showState(emptyState); }
            } else { showState(emptyState); }
        } catch (error) {
            console.error("Error cargando números de serie:", error);
            showState(errorState);
        }
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
        window.location.href = 'login.html';
    });
});