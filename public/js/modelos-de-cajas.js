// public/js/modelos-de-cajas.js

import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    collection,
    getDocs
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const modelosList = document.getElementById('modelos-list');
    const userDisplayElement = document.getElementById('user-email'); 
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');

    // --- Lógica de Autenticación ---
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        if (userDisplayElement) {
            userDisplayElement.textContent = user.displayName || user.email;
        }
        loadZonas(); 
    });

    // --- Función para mostrar el estado correcto (Cargando, Lista, Error) ---
    const showState = (stateElement) => {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (modelosList) modelosList.style.display = 'none';
        
        if (stateElement) {
            stateElement.style.display = 'block';
        }
    };

    // --- Función para Cargar y Mostrar las Zonas ---
    const loadZonas = async () => {
        showState(loadingState); // Mostrar "Cargando..."
        try {
            const querySnapshot = await getDocs(collection(db, "Cajas"));
            modelosList.innerHTML = ''; 

            if (querySnapshot.empty) {
                showState(emptyState); // Mostrar mensaje de que no hay modelos
                return;
            }

            querySnapshot.forEach((doc) => {
                const zonaName = doc.id;
                const listItem = document.createElement('li');
                listItem.className = 'list-item';
                listItem.textContent = zonaName;

                // Al hacer clic, enviamos el nombre de la zona como parámetro 'zonaName'
                listItem.addEventListener('click', () => {
                    window.location.href = `modelado-caja.html?zonaName=${encodeURIComponent(zonaName)}`;
                });

                modelosList.appendChild(listItem);
            });

            showState(modelosList); // Mostrar la lista de modelos cargada

        } catch (error) {
            console.error("Error al cargar las zonas:", error);
            showState(errorState); // Mostrar mensaje de error
        }
    };

    // --- Lógica de Navegación ---
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }
});
