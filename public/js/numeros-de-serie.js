// public/js/numeros-de-serie.js

import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, deleteDoc, updateDoc,
    registrarHistorial // <-- Importamos la nueva función
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

    let currentModelName = '';
    let currentZonaName = '';
    let serialToDelete = null;
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
        modelNameDisplay.textContent = `Números de Serie para: ${currentModelName}`;

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
                        
                        let deleteButtonHtml = '';
                        if (userRole === 'supervisor') {
                            deleteButtonHtml = `
                                <div class="delete-container">
                                    <button class="btn-delete-caja" title="Eliminar caja">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            `;
                        }
                        
                        li.innerHTML = `
                            <div class="serial-container">
                                <span class="serial-text">${serial}</span>
                            </div>
                            ${deleteButtonHtml}
                        `;
                        
                        li.querySelector('.serial-container').addEventListener('click', () => {
                            const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelName=${encodeURIComponent(currentModelName)}&zonaName=${encodeURIComponent(currentZonaName)}`;
                            window.location.href = url;
                        });
                        
                        const deleteButton = li.querySelector('.btn-delete-caja');
                        if (deleteButton) {
                            deleteButton.addEventListener('click', () => {
                                openDeleteModal(serial);
                            });
                        }

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
            // Borramos el documento de ítems
            const itemDocRef = doc(db, "Items", serialToDelete);
            await deleteDoc(itemDocRef);

            // Actualizamos la lista de series en el documento de la zona
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
            
            // --- REGISTRO DE HISTORIAL ---
            registrarHistorial('ELIMINACIÓN DE CAJA', {
                cajaSerie: serialToDelete,
                modelo: currentModelName,
                mensaje: `Se eliminó la caja "${serialToDelete}" (Modelo: ${currentModelName}) y todos sus ítems.`
            });

            showNotification(`Caja "${serialToDelete}" eliminada con éxito.`, 'success');
            
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
    
    // ... (El resto de funciones y listeners como openDeleteModal, closeDeleteModal, etc., no cambian)
    const openDeleteModal = (serial) => {
        serialToDelete = serial;
        deleteModalText.textContent = `¿Estás seguro de que deseas eliminar la caja "${serial}" y todos sus ítems? Esta acción es permanente.`;
        deleteConfirmModal.style.display = 'flex';
    };
    const closeDeleteModal = () => {
        deleteConfirmModal.style.display = 'none';
        serialToDelete = null;
    };
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', deleteCaja);
    addCajaBtn.addEventListener('click', () => {
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