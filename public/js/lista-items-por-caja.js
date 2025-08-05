// public/js/lista-items-por-caja.js

// Importa las instancias de Firebase desde el archivo de configuración centralizado
import { app, auth, db } from './firebase-config.js'; 
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"; 

// DOM elements
const userDisplayNameElement = document.getElementById('user-display-name'); 
const userEmailDisplay = document.getElementById('user-email'); 
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const boxSerialNumberDisplay = document.getElementById('box-serial-number-display');
const itemsList = document.getElementById('itemsList');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state');
const retryBtn = document.getElementById('retry-btn');
const searchInput = document.getElementById('searchInput'); // Elemento de búsqueda

// Modal elements
const editSerialModal = document.getElementById('editSerialModal');
const modalItemCodeDescription = document.getElementById('modalItemCodeDescription'); // Ahora mostrará el código/descripción del ítem
const newSerialNumberInput = document.getElementById('newSerialNumberInput'); // Input para el nuevo N° de Serie del ítem
const cancelEditBtn = document.getElementById('cancelEditBtn');
const confirmEditBtn = document.getElementById('confirmEditBtn');
const modalMessage = document.getElementById('modalMessage');
const modalSpinner = document.getElementById('modalSpinner');

let allLoadedItemsData = {}; // Variable para almacenar todos los ítems cargados sin filtrar
let currentSelectedSerialNumber = ''; // El ID del documento principal en 'Items' (ej. AX2002)
let currentEditingItem = null; // Para almacenar el ítem completo que se está editando

console.log("lista-items-por-caja.js: Script loaded.");

// Función para sanitizar los nombres de los campos de Firestore
// Reemplaza caracteres no válidos con guiones bajos.
function sanitizeFieldName(name) {
    // Firestore permite la mayoría de los caracteres Unicode en los nombres de los campos,
    // pero evita '.', '..', '/', '[', ']', '*', '~'
    // Para simplificar, reemplazaremos los caracteres que podrían causar problemas o ser confusos.
    let sanitized = name.replace(/\//g, '_'); // Reemplaza '/' con '_'
    sanitized = sanitized.replace(/\./g, '_'); // Reemplaza '.' con '_'
    sanitized = sanitized.replace(/\[/g, '_'); // Reemplaza '[' con '_'
    sanitized = sanitized.replace(/\]/g, '_'); // Reemplaza ']' con '_'
    sanitized = sanitized.replace(/\*/g, '_'); // Reemplaza '*' con '_'
    sanitized = sanitized.replace(/~/g, '_'); // Reemplaza '~' con '_'
    return sanitized;
}

// Function to show messages in modal
const showModalMessage = (msg, type = 'info') => {
    if (modalMessage) {
        modalMessage.textContent = msg;
        modalMessage.className = `message-area ${type}`;
        modalMessage.style.display = 'block';
    }
};

// Function to clear modal messages
const clearModalMessage = () => {
    if (modalMessage) {
        modalMessage.textContent = '';
        modalMessage.className = 'message-area';
        modalMessage.style.display = 'none';
    }
};

// Function to show/hide modal spinner
const showModalLoading = (show) => {
    if (modalSpinner) {
        modalSpinner.style.display = show ? 'block' : 'none';
    }
    if (confirmEditBtn) confirmEditBtn.disabled = show;
    if (cancelEditBtn) cancelEditBtn.disabled = show;
    if (newSerialNumberInput) newSerialNumberInput.disabled = show;
    if (show) clearModalMessage();
};

// Function to show/hide states
const showState = (stateElement) => {
    console.log(`showState called: attempting to show ${stateElement ? stateElement.id : 'null'}`);
    const elementsToControl = [loadingState, errorState, emptyState, itemsList];
    elementsToControl.forEach(el => {
        if (el) { 
            el.style.display = 'none';
        } else {
            console.warn(`Element with ID corresponding to ${el} is null. Cannot set display style.`);
        }
    });

    if (stateElement) {
        stateElement.style.display = (stateElement === itemsList) ? 'flex' : 'block';
        if (stateElement === itemsList) {
            itemsList.style.flexDirection = 'column'; 
        }
    }
    console.log(`  -> Display style for ${stateElement ? stateElement.id : 'null'} set to: ${stateElement ? stateElement.style.display : 'none'}`);
};

// Function to render items based on a filter
const renderFilteredItems = (itemsData, searchTerm = '') => {
    itemsList.innerHTML = ''; // Clear existing list items
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    let filteredItemKeys = Object.keys(itemsData);

    if (lowerCaseSearchTerm) {
        filteredItemKeys = filteredItemKeys.filter(itemFieldName => {
            const itemValue = itemsData[itemFieldName]; // Esto es el N° de Serie del ítem
            const firstSpaceIndex = itemFieldName.indexOf(' ');
            const itemCode = firstSpaceIndex !== -1 ? itemFieldName.substring(0, firstSpaceIndex) : itemFieldName;
            const description = firstSpaceIndex !== -1 ? itemFieldName.substring(firstSpaceIndex + 1) : '';

            // Check if search term is in code, description, or serial number
            return itemCode.toLowerCase().includes(lowerCaseSearchTerm) ||
                   description.toLowerCase().includes(lowerCaseSearchTerm) ||
                   itemValue.toLowerCase().includes(lowerCaseSearchTerm);
        });
    }

    // Sort the filtered items by itemCode
    filteredItemKeys.sort((a, b) => {
        const getCode = (fieldName) => {
            const firstSpaceIndex = fieldName.indexOf(' ');
            return firstSpaceIndex !== -1 ? fieldName.substring(0, firstSpaceIndex) : fieldName;
        };
        const codeA = getCode(a);
        const codeB = getCode(b);
        return codeA.localeCompare(codeB); // Alphabetic comparison of codes
    });

    if (filteredItemKeys.length > 0) {
        filteredItemKeys.forEach(itemFieldName => {
            const itemValue = itemsData[itemFieldName]; // Esto es el N° de Serie del ítem
            const listItem = document.createElement('li');
            listItem.classList.add('list-item');

            const firstSpaceIndex = itemFieldName.indexOf(' ');
            let itemCode = itemFieldName;
            let description = '';

            if (firstSpaceIndex !== -1) {
                itemCode = itemFieldName.substring(0, firstSpaceIndex);
                description = itemFieldName.substring(firstSpaceIndex + 1);
            }

            listItem.innerHTML = `
                <div class="item-detail-line">
                    <span class="item-label">Código:</span>
                    <span class="item-value-text">${itemCode}</span>
                </div>
                <div class="item-detail-line">
                    <span class="item-label">Descripción:</span>
                    <span class="item-value-text">${description}</span>
                </div>
                <div class="item-detail-line">
                    <span class="item-label">N° de Serie:</span>
                    <span class="item-value-text" data-field-name="${itemFieldName}">${itemValue}</span>
                </div>
            `;
            // Add click listener to open modal for editing
            listItem.addEventListener('click', () => {
                currentEditingItem = {
                    id: itemFieldName, // Este es el nombre del campo en Firestore (ej. "42-118-01 PLACA...")
                    itemCode: itemCode,
                    description: description,
                    serialNumber: itemValue, // El N° de Serie actual del ítem
                    serialNumberDocumentId: currentSelectedSerialNumber // El ID del documento padre en 'Items' (ej. AX2002)
                };
                if (modalItemCodeDescription) modalItemCodeDescription.textContent = `Ítem: ${itemCode} - ${description}`;
                if (newSerialNumberInput) newSerialNumberInput.value = itemValue; // Pre-llenar con el N° de Serie actual del ítem
                if (editSerialModal) editSerialModal.style.display = 'flex'; // Show the modal
                clearModalMessage(); // Clear any previous modal messages
            });

            itemsList.appendChild(listItem);
        });
        showState(itemsList);
    } else {
        showState(emptyState);
        if (emptyState) emptyState.querySelector('p').textContent = `No se encontraron ítems que coincidan con la búsqueda.`;
    }
};

// Function to load and display items for a specific boxSerialNumber
const loadItemsForSerialNumber = async () => {
    console.log("loadItemsForSerialNumber started.");
    showState(loadingState); // Show loading state

    const urlParams = new URLSearchParams(window.location.search);
    currentSelectedSerialNumber = urlParams.get('selectedSerialNumber'); // Obtener el número de serie principal

    console.log(`URL parameter: selectedSerialNumber="${currentSelectedSerialNumber}"`);

    if (!currentSelectedSerialNumber) {
        console.error("Error: 'selectedSerialNumber' parameter missing in URL.");
        if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = 'Error de URL';
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = 'Error: No se especificó el número de serie.';
        return;
    }

    // Título con el número de serie de la caja
    if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = `Items para Caja: ${decodeURIComponent(currentSelectedSerialNumber)}`;

    try {
        // Referencia al documento en la colección 'Items'
        const docRef = doc(db, "Items", decodeURIComponent(currentSelectedSerialNumber));
        const docSnap = await getDoc(docRef);

        const itemsData = {}; // Usaremos un objeto para almacenar los ítems por su nombre de campo

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log(`Data for serial number "${currentSelectedSerialNumber}" fetched:`, data);

            // Iterar sobre los campos del documento para obtener los ítems
            for (const itemKey in data) {
                if (Object.hasOwnProperty.call(data, itemKey)) {
                    // itemKey es el nombre del campo (ej. "42-118-01 PLACA 1/3 CIRCULO diam. 3,5mm. x 4 ORIFICIOS")
                    // data[itemKey] es el número de serie del ítem (ej. "BM1079")
                    itemsData[itemKey] = data[itemKey]; // Almacenar directamente
                }
            }
            allLoadedItemsData = itemsData; // Guardar todos los datos cargados
            console.log(`Found ${Object.keys(allLoadedItemsData).length} items for serial number "${currentSelectedSerialNumber}".`);
        } else {
            console.log(`No document found for serial number "${currentSelectedSerialNumber}" in 'Items' collection.`);
        }
        
        renderFilteredItems(allLoadedItemsData, searchInput.value); // Render with current search term
        
        if (Object.keys(allLoadedItemsData).length === 0) {
            showState(emptyState);
            if (emptyState) emptyState.querySelector('p').textContent = 'No hay ítems registrados para este número de serie.';
        }

    } catch (error) {
        console.error("Error al cargar los ítems para el número de serie:", error);
        showState(errorState);
        if (errorState) errorState.querySelector('p').innerHTML = `Error al cargar los ítems: ${error.message}. Por favor, <button id="retry-btn" class="btn-link">intenta de nuevo</button>.`;
    }
};

// Function to validate serial number (allow alphanumeric, hyphens, and commas)
const isValidSerialNumber = (serial) => {
    // Regex to allow alphanumeric characters, hyphens, and commas
    const regex = /^[a-zA-Z0-9,-]*$/;
    return regex.test(serial);
};

// Function to update the serial number in Firestore
const updateItemSerialNumber = async () => {
    if (!currentEditingItem) {
        console.error("No item selected for editing.");
        return;
    }

    showModalLoading(true);
    let newSerial = newSerialNumberInput.value.trim(); // Use 'let' because it might be reassigned

    // If the serial number is "0", change it to "REEMPLAZAR"
    if (newSerial === '0') {
        newSerial = 'REEMPLAZAR';
    }

    if (!newSerial) {
        showModalMessage('El número de serie no puede estar vacío.', 'error');
        showModalLoading(false);
        return;
    }

    // --- NUEVA VALIDACIÓN AQUÍ ---
    if (!isValidSerialNumber(newSerial)) {
        showModalMessage('El número de serie contiene caracteres no permitidos. Solo se permiten letras, números, guiones y comas.', 'error');
        showModalLoading(false);
        return;
    }
    // --- FIN NUEVA VALIDACIÓN ---

    try {
        // Referencia al documento del número de serie en la colección 'Items'
        const serialDocRef = doc(db, "Items", decodeURIComponent(currentEditingItem.serialNumberDocumentId));
        
        // MODIFICACIÓN CLAVE AQUÍ: Sanitizar el nombre del campo antes de usarlo
        // currentEditingItem.id es el nombre del campo en Firestore (ej. "42-118-01 PLACA...")
        const fieldToUpdate = sanitizeFieldName(currentEditingItem.id); 
        
        console.log("DEBUG: Intentando actualizar Firebase...");
        console.log("DEBUG: Documento a actualizar:", serialDocRef.path);
        console.log("DEBUG: Campo a actualizar (sanitizado):", fieldToUpdate);
        console.log("DEBUG: Nuevo valor del número de serie:", newSerial);

        // Crear un objeto con el campo a actualizar
        const updatePayload = {
            [fieldToUpdate]: newSerial
        };
        await updateDoc(serialDocRef, updatePayload);

        // Actualizar los datos locales y re-renderizar la lista
        // Es importante actualizar el 'allLoadedItemsData' con el nombre original del campo
        // para que la interfaz siga mostrando el nombre completo.
        allLoadedItemsData[currentEditingItem.id] = newSerial; 
        renderFilteredItems(allLoadedItemsData, searchInput.value);

        showModalMessage('Número de serie actualizado con éxito.', 'success');
        console.log(`Serial number for ${currentEditingItem.id} in document ${currentEditingItem.serialNumberDocumentId} updated to ${newSerial} in Firebase.`);
        
        // Close modal after a short delay to show success message
        setTimeout(() => {
            if (editSerialModal) editSerialModal.style.display = 'none';
            showModalLoading(false);
            clearModalMessage();
        }, 1500);

    } catch (error) {
        console.error("Error al actualizar el número de serie en Firebase:", error);
        showModalMessage(`Error al actualizar: ${error.message}`, 'error');
        showModalLoading(false);
    }
};


document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired for lista-items-por-caja.js");
    
    onAuthStateChanged(auth, async (user) => { // Agregado async aquí
        console.log("onAuthStateChanged triggered for lista-items-por-caja.js. User:", user ? user.email : 'null');
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
                console.error("Error al obtener el nombre del usuario en lista-items-por-caja.js:", error);
                if (userDisplayNameElement) {
                    userDisplayNameElement.textContent = user.email; // Fallback al email en caso de error
                }
            }
            // FIN CAMBIO

            if (userEmailDisplay) userEmailDisplay.textContent = user.email; 
            loadItemsForSerialNumber(); // Load items upon authentication
        } else {
            console.log("No user authenticated, redirecting to login.html from lista-items-por-caja.js");
            window.location.href = 'login.html'; // Redirect if no authenticated user
        }
    });

    // Event listeners for search input (real-time filtering)
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderFilteredItems(allLoadedItemsData, searchInput.value);
        });
    }

    // Modal button event listeners
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            if (editSerialModal) editSerialModal.style.display = 'none';
            clearModalMessage();
        });
    }

    if (confirmEditBtn) {
        confirmEditBtn.addEventListener('click', updateItemSerialNumber);
    }

    // Logout button event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("Logout button clicked from lista-items-por-caja.js");
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error logging out:', error);
            }
        });
    }

    // Back button event listener
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("Back button clicked from lista-items-por-caja.js.");
            const urlParams = new URLSearchParams(window.location.search);
            const referer = urlParams.get('referer'); // Obtener el referer URL

            if (referer) {
                console.log(`Redirecting to referer: ${decodeURIComponent(referer)}`);
                window.location.href = decodeURIComponent(referer);
            } else {
                console.log("Referer not found in URL, falling back to modelos-de-cajas.html");
                window.location.href = 'modelos-de-cajas.html'; 
            }
        });
    }

    // Retry button event listener
    if (retryBtn) {
        retryBtn.addEventListener('click', loadItemsForSerialNumber);
    }
});
