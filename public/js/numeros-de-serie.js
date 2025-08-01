import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './firebase-config.js';

const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const modelNameDisplay = document.getElementById('model-name-display'); // Ahora mostrará el nombre del CAMPO
const serialNumbersList = document.getElementById('serialNumbersList');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const retryBtn = document.getElementById('retry-btn');
const userEmailDisplay = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');

console.log("numeros-de-serie.js: Script loaded.");

// Function to show/hide states
const showState = (stateElement) => {
    console.log(`showState called: attempting to show ${stateElement ? stateElement.id : 'null'}`);
    [loadingState, errorState, emptyState, serialNumbersList].forEach(el => {
        if (el) el.style.display = 'none';
    });
    if (stateElement) {
        stateElement.style.display = (stateElement === serialNumbersList) ? 'flex' : 'block';
        if (stateElement === serialNumbersList) {
            serialNumbersList.style.flexDirection = 'column'; // Asegurar que la lista se muestre como columna flex
        }
    }
    console.log(`  -> Display style for ${stateElement ? stateElement.id : 'null'} set to: ${stateElement ? stateElement.style.display : 'none'}`);
};

// Function to load and display serial numbers for a specific field within a model
const loadSerialNumbersForField = async () => {
    console.log("loadSerialNumbersForField started.");
    showState(loadingState); // Mostrar estado de carga

    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('modelId'); // Obtener el ID del modelo (ej. 'osteosintesis')
    const fieldName = urlParams.get('fieldName'); // Obtener el nombre del campo (ej. 'BLOQUEADO 3,5')

    console.log(`URL parameters: modelId="${modelId}", fieldName="${fieldName}"`);

    if (!modelId || !fieldName) {
        console.error("Faltan parámetros 'modelId' o 'fieldName' en la URL.");
        if (modelNameDisplay) modelNameDisplay.textContent = 'Error de URL';
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = 'Error: No se especificó el ID del modelo o el nombre del campo.';
        return;
    }

    // Actualizar el título principal con el nombre del campo
    if (modelNameDisplay) modelNameDisplay.textContent = `Números de Serie para: ${decodeURIComponent(fieldName)}`;

    try {
        const docRef = doc(db, "Cajas", decodeURIComponent(modelId));
        const docSnap = await getDoc(docRef);

        serialNumbersList.innerHTML = ''; // Limpiar lista

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Model data fetched:", data);

            // Obtener el valor del campo específico, que es una cadena de números de serie separados por coma
            const serialNumbersString = data[fieldName];
            
            if (serialNumbersString && typeof serialNumbersString === 'string' && serialNumbersString.trim() !== '') {
                const serials = serialNumbersString.split(',').map(s => s.trim()).filter(s => s !== '');
                
                if (serials.length > 0) {
                    console.log(`Found ${serials.length} serial numbers for field "${fieldName}".`);
                    
                    serials.forEach(serial => {
                        const listItem = document.createElement('li');
                        listItem.classList.add('list-item');
                        listItem.innerHTML = `
                            <div class="item-value-text">${serial}</div>
                        `;
                        
                        // MODIFICACIÓN CLAVE AQUÍ: Pasar la URL de numeros-de-serie.html como referer
                        listItem.addEventListener('click', () => {
                            const currentUrl = window.location.href; // URL completa de numeros-de-serie.html
                            console.log(`Navigating to lista-items-por-caja.html with selectedSerialNumber=${serial} and referer=${encodeURIComponent(currentUrl)}`);
                            window.location.href = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&referer=${encodeURIComponent(currentUrl)}`;
                        });

                        if (serialNumbersList) serialNumbersList.appendChild(listItem);
                    });
                    showState(serialNumbersList); // Mostrar la lista
                } else {
                    console.log(`Field "${fieldName}" exists but has no serial numbers.`);
                    showState(emptyState);
                    if (emptyState) emptyState.querySelector('p').textContent = `El campo "${decodeURIComponent(fieldName)}" no tiene números de serie registrados.`;
                }
            } else {
                console.log(`Field "${fieldName}" is empty or not a string.`);
                showState(emptyState);
                if (emptyState) emptyState.querySelector('p').textContent = `El campo "${decodeURIComponent(fieldName)}" no tiene números de serie registrados.`;
            }

        } else {
            console.error(`No se encontró el modelo con ID: "${modelId}" en la colección 'Cajas'.`);
            showState(emptyState);
            if (emptyState) emptyState.querySelector('p').textContent = `El modelo "${decodeURIComponent(modelId)}" no existe en la base de datos.`;
        }
    } catch (error) {
        console.error("Error al cargar los números de serie:", error);
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = `Error al cargar los números de serie: ${error.message}. Por favor, <button id="retry-btn-error" class="btn-link">intenta de nuevo</button>.`;
        document.getElementById('retry-btn-error')?.addEventListener('click', loadSerialNumbersForField);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired for numeros-de-serie.js");
    onAuthStateChanged(auth, (user) => {
        console.log("onAuthStateChanged triggered for numeros-de-serie.js. User:", user ? user.email : 'null');
        if (user) {
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            loadSerialNumbersForField(); // Cargar números de serie al autenticarse
        } else {
            console.log("No user authenticated, redirecting to login.html from numeros-de-serie.js");
            window.location.href = 'login.html'; // Redirigir si no hay usuario autenticado
        }
    });

    // Botón de cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("Logout button clicked from numeros-de-serie.js");
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }

    // Botón de volver
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("Back button clicked from numeros-de-serie.js.");
            const urlParams = new URLSearchParams(window.location.search);
            const modelId = urlParams.get('modelId'); // Necesitamos el modelId para volver a modelado-caja.html

            if (modelId) {
                console.log(`Redirecting to modelado-caja.html?modelId=${modelId}`);
                window.location.href = `modelado-caja.html?modelId=${encodeURIComponent(modelId)}`;
            } else {
                console.log("modelId not found in URL, falling back to modelos-de-cajas.html");
                window.location.href = 'modelos-de-cajas.html'; 
            }
        });
    }

    // Botón de reintento
    if (retryBtn) {
        retryBtn.addEventListener('click', loadSerialNumbersForField);
    }
});
