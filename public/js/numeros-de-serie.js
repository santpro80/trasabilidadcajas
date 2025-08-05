// public/js/numeros-de-serie.js

// Importa las instancias de Firebase desde el archivo de configuración centralizado
import { app, auth, db } from './firebase-config.js'; 
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; 

// DOM elements
const userDisplayNameElement = document.getElementById('user-display-name'); 
const userEmailDisplay = document.getElementById('user-email'); 
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const modelNameDisplay = document.getElementById('model-name-display'); 
const serialNumbersList = document.getElementById('serialNumbersList');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const retryBtn = document.getElementById('retry-btn'); // Correct ID for the retry button in HTML

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
            serialNumbersList.style.flexDirection = 'column'; 
        }
    }
    console.log(`  -> Display style for ${stateElement ? stateElement.id : 'null'} set to: ${stateElement ? stateElement.style.display : 'none'}`);
};

// Function to load and display serial numbers for a specific field within a model
const loadSerialNumbersForField = async () => {
    console.log("loadSerialNumbersForField started.");
    showState(loadingState); 

    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('modelId'); 
    const fieldName = urlParams.get('fieldName'); 

    console.log(`URL parameters: modelId="${modelId}", fieldName="${fieldName}"`);

    if (!modelId || !fieldName) {
        console.error("Faltan parámetros 'modelId' o 'fieldName' en la URL.");
        if (modelNameDisplay) modelNameDisplay.textContent = 'Error de URL';
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = 'Error: No se especificó el ID del modelo o el nombre del campo. Por favor, <button id="retry-btn" class="btn-link">intenta de nuevo</button>.'; 
        // The listener for this button is attached at the end of DOMContentLoaded
        return;
    }

    if (modelNameDisplay) modelNameDisplay.textContent = `Números de Serie para: ${decodeURIComponent(fieldName)}`;

    try {
        const docRef = doc(db, "Cajas", decodeURIComponent(modelId));
        const docSnap = await getDoc(docRef);

        serialNumbersList.innerHTML = ''; 

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Model data fetched:", data);

            // Asumiendo que data[fieldName] es una cadena de números de serie separados por coma
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
                        
                        // Pasar modelId, fieldName, y selectedSerialNumber a lista-items-por-caja.html
                        listItem.addEventListener('click', () => {
                            const currentUrl = window.location.href; 
                            console.log(`Navigating to lista-items-por-caja.html with selectedSerialNumber=${serial}, modelId=${modelId}, fieldName=${fieldName} and referer=${encodeURIComponent(currentUrl)}`);
                            window.location.href = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelId=${encodeURIComponent(modelId)}&fieldName=${encodeURIComponent(fieldName)}&referer=${encodeURIComponent(currentUrl)}`;
                        });

                        if (serialNumbersList) serialNumbersList.appendChild(listItem);
                    });
                    showState(serialNumbersList); 
                } else {
                    console.log(`Field "${fieldName}" exists but has no serial numbers.`);
                    showState(emptyState);
                    if (emptyState) emptyState.querySelector('p').textContent = `El campo "${decodeURIComponent(fieldName)}" no tiene números de serie registrados.`;
                }
            } else {
                console.log(`Field "${fieldName}" está vacío o no es una cadena de texto.`);
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
        if (errorState) errorState.querySelector('p').innerHTML = `Error al cargar los números de serie: ${error.message}. Por favor, <button id="retry-btn" class="btn-link">intenta de nuevo</button>.`;
        // The listener for this button is attached at the end of DOMContentLoaded
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired for numeros-de-serie.js");
    onAuthStateChanged(auth, async (user) => { 
        console.log("onAuthStateChanged triggered for numeros-de-serie.js. User:", user ? user.email : 'null');
        if (user) {
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
                        userDisplayNameElement.textContent = user.email; 
                    }
                }
            } catch (error) {
                console.error("Error al obtener el nombre del usuario en numeros-de-serie.js:", error);
                if (userDisplayNameElement) {
                    userDisplayNameElement.textContent = user.email; 
                }
            }

            if (userEmailDisplay) userEmailDisplay.textContent = user.email; 
            loadSerialNumbersForField(); 
        } else {
            console.log("No user authenticated, redirecting to login.html from numeros-de-serie.js");
            window.location.href = 'login.html'; 
        }
    });

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

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("Back button clicked from numeros-de-serie.js.");
            const urlParams = new URLSearchParams(window.location.search);
            const modelId = urlParams.get('modelId'); 

            if (modelId) {
                console.log(`Redirecting to modelado-caja.html?modelId=${modelId}`);
                window.location.href = `modelado-caja.html?modelId=${encodeURIComponent(modelId)}`;
            } else {
                console.log("modelId not found in URL, falling back to modelos-de-cajas.html");
                window.location.href = 'modelos-de-cajas.html'; 
            }
        });
    }

    // Adjuntar el listener para el botón de reintento aquí, una vez que el DOM esté cargado
    if (retryBtn) {
        retryBtn.addEventListener('click', loadSerialNumbersForField);
    }
});
