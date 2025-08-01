// ==========================================================================
// ESTE ES EL PRIMER CONSOLE.LOG DEL ARCHIVO. SI NO LO VES, EL SCRIPT NO SE CARGÓ.
// ==========================================================================
console.log("===================================================================");
console.log("DEBUG: importar-datos.js script file has been loaded. (Primera línea)");
console.log("===================================================================");


import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './firebase-config.js';

const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const csvFileInput = document.getElementById('csvFileInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const messageDiv = document.getElementById('message');
const loadingSpinner = document.getElementById('loading-spinner');
const userEmailDisplay = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');

console.log("DEBUG: importar-datos.js: Script initialized. DOM elements obtained.");

// Function to show messages to the user
const showMessage = (msg, type = 'info') => {
    console.log(`DEBUG: showMessage called: Message="${msg}", Type="${type}"`);
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message-area ${type}`; // Add class for styling (e.g., 'success', 'error', 'info')
        messageDiv.style.display = 'block';
        console.log(`DEBUG: Message div updated. Display style: ${messageDiv.style.display}`);
    } else {
        console.error("ERROR: messageDiv element not found.");
    }
};

// Function to clear messages
const clearMessage = () => {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message-area';
        messageDiv.style.display = 'none';
        console.log("DEBUG: Message div cleared.");
    }
};

// Function to show/hide loading spinner
const showLoading = (show) => {
    if (loadingSpinner) {
        loadingSpinner.style.display = show ? 'block' : 'none';
        console.log(`DEBUG: Loading spinner display: ${loadingSpinner.style.display}`);
    }
    if (uploadCsvBtn) {
        uploadCsvBtn.disabled = show; // Disable button while loading
        console.log(`DEBUG: Upload button disabled: ${uploadCsvBtn.disabled}`);
    }
    if (show) { // Clear messages only when loading starts
        clearMessage();
    }
};

// Function to process and upload CSV data
const processAndUploadCsv = async (file) => {
    console.log("DEBUG: processAndUploadCsv started.");
    showLoading(true);
    showMessage('Procesando archivo CSV...', 'info');

    Papa.parse(file, {
        header: true, // Treat the first row as headers
        skipEmptyLines: true,
        complete: async (results) => {
            console.log("DEBUG: CSV parsing complete. Data:", results.data);
            console.log("DEBUG: Errors:", results.errors);

            if (results.errors.length > 0) {
                showMessage(`Error al parsear CSV: ${results.errors[0].message}`, 'error');
                showLoading(false);
                return;
            }

            if (!results.data || results.data.length === 0) {
                showMessage('El archivo CSV está vacío o no contiene datos válidos.', 'error');
                showLoading(false);
                return;
            }

            // Group data by boxSerialNumber and then by combined itemCode+description
            const groupedData = new Map(); // Map<boxSerialNumber, Map<combinedFieldName, Set<serialNumber>>>

            results.data.forEach(row => {
                // Usar los nombres de las columnas en inglés, como en tu CSV actual
                const boxSerialNumber = row['boxSerialNumber']?.trim();
                const itemCode = row['itemCode']?.trim();
                const description = row['description']?.trim();
                const serialNumber = row['serialNumber']?.trim();

                if (!boxSerialNumber || !itemCode || !description || !serialNumber) {
                    console.warn("DEBUG: Skipping row due to missing data (check column headers in CSV):", row);
                    return; // Skip rows with missing essential data
                }

                const combinedFieldName = `${itemCode} ${description}`;

                if (!groupedData.has(boxSerialNumber)) {
                    groupedData.set(boxSerialNumber, new Map());
                }
                const boxFields = groupedData.get(boxSerialNumber);

                if (!boxFields.has(combinedFieldName)) {
                    boxFields.set(combinedFieldName, new Set());
                }
                boxFields.get(combinedFieldName).add(serialNumber);
            });

            console.log("DEBUG: Grouped data for Firestore upload:", groupedData);

            let successfulUploads = 0;
            let failedUploads = 0;

            for (const [boxId, fieldsMap] of groupedData.entries()) {
                try {
                    // Colección "Items"
                    const docRef = doc(db, "Items", boxId); 
                    const docSnap = await getDoc(docRef);
                    let existingData = {};

                    if (docSnap.exists()) {
                        existingData = docSnap.data();
                        console.log(`DEBUG: Document ${boxId} exists in 'Items' collection. Merging with existing data.`);
                    } else {
                        console.log(`DEBUG: Document ${boxId} does not exist in 'Items' collection. Creating new document.`);
                    }

                    const updatePayload = {};
                    for (const [fieldName, serialsSet] of fieldsMap.entries()) {
                        let currentSerials = new Set();
                        if (existingData[fieldName] && typeof existingData[fieldName] === 'string') {
                            existingData[fieldName].split(',').forEach(s => {
                                if (s.trim() !== '') currentSerials.add(s.trim());
                            });
                        }
                        
                        // Merge new serials with existing ones
                        serialsSet.forEach(s => currentSerials.add(s));

                        updatePayload[fieldName] = Array.from(currentSerials).join(',');
                    }

                    await setDoc(docRef, updatePayload, { merge: true }); // Use merge: true to update specific fields without overwriting others
                    successfulUploads++;
                    console.log(`DEBUG: Successfully uploaded/merged data for item: ${boxId}`);

                } catch (error) {
                    console.error(`ERROR: Error uploading data for item ${boxId}:`, error);
                    failedUploads++;
                }
            }

            if (successfulUploads > 0) {
                // --- CAMBIO CLAVE AQUÍ: "cajas" en lugar de "items" ---
                showMessage(`Importación completada: ${successfulUploads} cajas actualizadas/creadas. ${failedUploads > 0 ? `${failedUploads} fallaron.` : ''}`, 'success');
            } else {
                showMessage(`No se pudo importar ningún dato. ${failedUploads > 0 ? `${failedUploads} fallaron.` : 'El CSV podría no tener datos válidos.'}`, 'error');
            }
            showLoading(false);
        },
        error: (err) => {
            console.error("ERROR: PapaParse error:", err);
            showMessage(`Error al leer el archivo CSV: ${err.message}`, 'error');
            showLoading(false);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded fired for importar-datos.js");

    // Authentication check
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            console.log("DEBUG: User authenticated:", user.email);
        } else {
            console.log("DEBUG: No user authenticated, redirecting to login.html");
            window.location.href = 'login.html'; // Redirect if no authenticated user
        }
    });

    // Event listener for file input change
    if (csvFileInput) {
        csvFileInput.addEventListener('change', () => {
            console.log("DEBUG: csvFileInput change event fired.");
            if (csvFileInput.files.length > 0) {
                showMessage(`Archivo seleccionado: ${csvFileInput.files[0].name}`, 'info');
            } else {
                clearMessage(); // Clear message if no file is selected
            }
        });
    } else {
        console.error("ERROR: csvFileInput element not found!");
    }

    // Event listener for upload button click
    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', () => {
            console.log("DEBUG: uploadCsvBtn click event fired.");
            if (csvFileInput && csvFileInput.files.length > 0) {
                processAndUploadCsv(csvFileInput.files[0]);
            } else {
                showMessage('Por favor, selecciona un archivo CSV para subir.', 'error');
            }
        });
    } else {
        console.error("ERROR: uploadCsvBtn element not found!");
    }

    // Back button event listener
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("DEBUG: Back button clicked from importar-datos.js. Redirecting to menu.html");
            window.location.href = 'menu.html'; // Go back to the main menu
        });
    } else {
        console.error("ERROR: backBtn element not found!");
    }

    // Logout button event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("DEBUG: Logout button clicked from importar-datos.js");
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error logging out:', error);
            }
        });
    } else {
        console.error("ERROR: logoutBtn element not found!");
    }
});
