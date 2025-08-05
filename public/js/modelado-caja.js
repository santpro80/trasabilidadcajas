// public/js/modelado-caja.js

// Importa las instancias de Firebase desde el archivo de configuración centralizado
import { app, auth, db } from './firebase-config.js'; 
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; // Actualizada la versión de Firebase SDK
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; // Actualizada la versión de Firebase SDK

// DOM elements
// CAMBIO: Usaremos user-display-name para el nombre del usuario
const userDisplayNameElement = document.getElementById('user-display-name'); 
const userEmailDisplay = document.getElementById('user-email'); // Mantener si aún se muestra el email
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const modelNameDisplay = document.getElementById('model-name-display');
const modelFieldsList = document.getElementById('modelFieldsList');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');

console.log("modelado-caja.js: Script loaded.");

// Function to show/hide states
const showState = (stateElement) => {
    console.log(`showState called: attempting to show ${stateElement ? stateElement.id : 'null'}`);
    const allControlledElements = [loadingState, errorState, emptyState, modelFieldsList];
    allControlledElements.forEach(el => {
        if (el) {
            el.style.display = 'none';
        }
    });

    if (stateElement) {
        stateElement.style.display = 'flex';
        if (stateElement === modelFieldsList) {
            modelFieldsList.style.flexDirection = 'column';
        }
    }
    console.log(`  -> Display style for ${stateElement ? stateElement.id : 'null'} set to: ${stateElement ? stateElement.style.display : 'none'}`);
};

// Function to load and display model details
const loadModelDetails = async () => {
    console.log("loadModelDetails started.");
    showState(loadingState); // Mostrar estado de carga

    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('modelId'); // Obtener el ID del modelo (que es el número de serie de la caja)

    console.log(`URL parameter: modelId="${modelId}"`);

    if (!modelId) {
        console.error("Falta el parámetro 'modelId' en la URL.");
        if (modelNameDisplay) modelNameDisplay.textContent = 'Error de URL';
        if (errorState) errorState.querySelector('p').textContent = 'Error: No se especificó el ID del modelo.';
        showState(errorState);
        return;
    }

    try {
        const docRef = doc(db, "Cajas", decodeURIComponent(modelId)); // Colección 'Cajas'
        const docSnap = await getDoc(docRef);

        modelFieldsList.innerHTML = ''; // Limpiar lista de campos

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Model data fetched:", data);

            // Actualizar el título principal con el ID del modelo
            if (modelNameDisplay) modelNameDisplay.textContent = `Detalles de Caja: ${decodeURIComponent(modelId)}`;

            const fieldNames = Object.keys(data);
            if (fieldNames.length > 0) {
                fieldNames.sort().forEach(fieldName => { // Ordenar campos alfabéticamente
                    const listItem = document.createElement('li');
                    listItem.classList.add('list-item'); // Usar la clase de estilo de lista

                    // Mostrar solo el nombre del campo
                    listItem.innerHTML = `
                        <div class="item-value-text">${fieldName}</div>
                    `;

                    // MODIFICACIÓN CLAVE AQUÍ: Navegar a numeros-de-serie.html
                    listItem.addEventListener('click', () => {
                        console.log(`Navigating to numeros-de-serie.html with modelId=${modelId} and fieldName=${fieldName}`);
                        window.location.href = `numeros-de-serie.html?modelId=${encodeURIComponent(modelId)}&fieldName=${encodeURIComponent(fieldName)}`;
                    });

                    if (modelFieldsList) modelFieldsList.appendChild(listItem);
                });
                showState(modelFieldsList); // Mostrar la lista de campos
            } else {
                console.log(`No fields found for model "${modelId}".`);
                showState(emptyState);
                if (emptyState) emptyState.querySelector('p').textContent = `El modelo "${decodeURIComponent(modelId)}" no tiene campos definidos.`;
            }

        } else {
            console.error(`No se encontró el modelo con ID: "${modelId}" en la colección 'Cajas'.`);
            showState(emptyState);
            if (emptyState) emptyState.querySelector('p').textContent = `El modelo "${decodeURIComponent(modelId)}" no existe en la base de datos.`;
        }
    } catch (error) {
        console.error("Error al cargar los detalles del modelo:", error);
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = `Error al cargar los detalles: ${error.message}. Por favor, <button id="retry-btn-error" class="btn-link">intenta de nuevo</button>.`;
        document.getElementById('retry-btn-error')?.addEventListener('click', loadModelDetails);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired for modelado-caja.js");
    onAuthStateChanged(auth, async (user) => { // Agregado 'async' para poder usar await
        console.log("onAuthStateChanged triggered for modelado-caja.js. User:", user ? user.email : 'null');
        if (user) {
            // CAMBIO: Obtener el nombre del usuario de Firestore para mostrarlo
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userDisplayNameElement) {
                        userDisplayNameElement.textContent = userData.name || user.email;
                    }
                } else {
                    if (userDisplayNameElement) {
                        userDisplayNameElement.textContent = user.email; // Fallback al email
                    }
                }
            } catch (error) {
                console.error("Error al obtener el nombre del usuario en modelado-caja.js:", error);
                if (userDisplayNameElement) {
                    userDisplayNameElement.textContent = user.email; // Fallback al email en caso de error
                }
            }
            // FIN CAMBIO

            if (userEmailDisplay) userEmailDisplay.textContent = user.email; // Mantener si aún se usa este ID
            loadModelDetails(); // Cargar detalles del modelo al autenticarse
        } else {
            console.log("No user authenticated, redirecting to login.html");
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("Logout button clicked.");
            try {
                await signOut(auth);
                console.log("User signed out, redirecting to login.html");
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }

    // Botón de volver
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("Back button clicked. Redirecting to modelos-de-cajas.html");
            window.location.href = 'modelos-de-cajas.html';
        });
    }

    // Botón de reintento en estado de error
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            console.log("Retry button clicked.");
            loadModelDetails();
        });
    }
});
