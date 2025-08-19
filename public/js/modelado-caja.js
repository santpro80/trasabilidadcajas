// public/js/modelado-caja.js

import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const modelNameDisplay = document.getElementById('model-name-display');
    const modelFieldsList = document.getElementById('modelFieldsList');
    const userDisplayName = document.getElementById('user-display-name');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
    // Elementos para gestionar los estados de la UI
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');

    // --- Lógica de Autenticación ---
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        if (userDisplayName) {
            userDisplayName.textContent = user.displayName || user.email;
        }
        loadModelDetails();
    });

    // --- Función para mostrar el estado correcto (Cargando, Lista, Error) ---
    const showState = (stateElement) => {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (modelFieldsList) modelFieldsList.style.display = 'none';
        
        if (stateElement) {
            // Usamos 'flex' para la lista para que los items se apilen verticalmente
            stateElement.style.display = (stateElement === modelFieldsList) ? 'flex' : 'block';
        }
    };

    // --- Función para Cargar y Mostrar los Detalles del Modelo ---
    const loadModelDetails = async () => {
        showState(loadingState); // Mostrar "Cargando..."
        const urlParams = new URLSearchParams(window.location.search);
        const zonaName = urlParams.get('zonaName');

        if (!zonaName) {
            modelNameDisplay.textContent = "Error: Zona no especificada";
            showState(errorState);
            return;
        }
        
        modelNameDisplay.textContent = `Modelos para: ${zonaName}`;

        try {
            const docRef = doc(db, "Cajas", zonaName);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const modelNames = Object.keys(data).sort();
                
                modelFieldsList.innerHTML = '';

                if (modelNames.length === 0) {
                    showState(emptyState); // No hay modelos en esta zona
                    return;
                }

                modelNames.forEach(modelName => {
                    const listItem = document.createElement('li');
                    listItem.className = 'list-item';
                    listItem.textContent = modelName;

                    listItem.addEventListener('click', () => {
                        window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
                    });

                    modelFieldsList.appendChild(listItem);
                });

                showState(modelFieldsList); // Mostrar la lista de modelos cargada
            } else {
                showState(emptyState); // La zona no existe o no tiene modelos
            }
        } catch (error) {
            console.error("Error al cargar los modelos:", error);
            showState(errorState); // Mostrar mensaje de error
        }
    };

    // --- Lógica de Navegación ---
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'modelos-de-cajas.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }
});
