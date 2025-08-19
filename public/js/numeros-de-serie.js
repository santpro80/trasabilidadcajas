// public/js/numeros-de-serie.js

import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, deleteDoc, updateDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const modelNameDisplay = document.getElementById('model-name-display');
    const serialNumbersList = document.getElementById('serialNumbersList');
    const addCajaBtn = document.getElementById('add-caja-btn');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
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
    let userRole = 'operario'; // Rol por defecto por seguridad

    let notificationTimeout;
    const showNotification = (message, type = 'success') => { /* ... (código sin cambios) ... */ };

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'login.html'; return; }
        
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if(userDocSnap.exists()) {
                userRole = userDocSnap.data().role || 'operario';
            }
            if (userDisplayName) { userDisplayName.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email; }
            
            // --- APLICAR RESTRICCIONES DE ROL ---
            if (userRole !== 'supervisor') {
                addCajaBtn.style.display = 'none'; // Ocultar botón de agregar caja
            }

            loadSerialNumbers();
        } catch (error) {
            console.error("Error al obtener rol del usuario:", error);
            loadSerialNumbers(); // Cargar la vista de operario incluso si hay error
        }
    });

    const showState = (stateElement) => { /* ... (código sin cambios) ... */ };

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
                        
                        // --- LÓGICA PARA MOSTRAR BOTÓN DE BORRADO SOLO A SUPERVISORES ---
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
                        
                        // Adjuntar listener de borrado solo si el botón existe
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
    
    // --- Lógica del modal de borrado (sin cambios) ---
    const openDeleteModal = (serial) => { /* ... */ };
    const closeDeleteModal = () => { /* ... */ };
    const deleteCaja = async () => { /* ... */ };
    
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', deleteCaja);
    addCajaBtn.addEventListener('click', () => { /* ... */ });
    backBtn.addEventListener('click', () => { /* ... */ });
    logoutBtn.addEventListener('click', async () => { /* ... */ });
});