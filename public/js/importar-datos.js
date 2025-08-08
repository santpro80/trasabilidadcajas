// ==========================================================================
//      importar-datos.js - VERSIÓN COMPLETA Y CORREGIDA
// ==========================================================================

// 1. IMPORTACIÓN CENTRALIZADA
// Se importa todo lo necesario desde firebase-config.js para evitar conflictos.
import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc
} from './firebase-config.js';


// 2. ELEMENTOS DEL DOM
const csvFileInput = document.getElementById('csvFileInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const messageDiv = document.getElementById('message');
const loadingSpinner = document.getElementById('loading-spinner');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');


// 3. FUNCIONES AUXILIARES (showMessage, showLoading, etc.)

// Muestra mensajes de estado al usuario
const showMessage = (msg, type = 'info') => {
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message-area ${type}`;
        messageDiv.style.display = 'block';
    }
};

// Limpia los mensajes
const clearMessage = () => {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message-area';
        messageDiv.style.display = 'none';
    }
};

// Muestra u oculta el spinner de carga y deshabilita botones
const showLoading = (show) => {
    if (loadingSpinner) {
        loadingSpinner.style.display = show ? 'block' : 'none';
    }
    if (uploadCsvBtn) {
        uploadCsvBtn.disabled = show;
    }
    if (show) {
        clearMessage();
    }
};


// 4. LÓGICA PRINCIPAL PARA PROCESAR Y SUBIR EL CSV

const processAndUploadCsv = async (file) => {
    showLoading(true);
    showMessage('Procesando archivo CSV...', 'info');

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            if (results.errors.length > 0) {
                showMessage(`Error al leer el CSV: ${results.errors[0].message}`, 'error');
                showLoading(false);
                return;
            }

            if (!results.data || results.data.length === 0) {
                showMessage('El archivo CSV está vacío o no contiene datos válidos.', 'error');
                showLoading(false);
                return;
            }

            // Agrupa todos los ítems por su `boxSerialNumber`
            const itemsByBox = new Map();

            results.data.forEach(row => {
                const boxSerialNumber = row['boxSerialNumber']?.trim();
                const itemCode = row['itemCode']?.trim();
                const description = row['description']?.trim();
                const serialNumber = row['serialNumber']?.trim();

                if (!boxSerialNumber || !itemCode || !description || !serialNumber) {
                    return; // Ignora las filas que no tengan todos los datos necesarios
                }

                if (!itemsByBox.has(boxSerialNumber)) {
                    itemsByBox.set(boxSerialNumber, {});
                }

                const boxItems = itemsByBox.get(boxSerialNumber);
                const fieldName = `${itemCode} ${description}`;
                
                // Asigna el número de serie directamente al campo.
                // Esto crea la estructura que el resto de tu app espera.
                boxItems[fieldName] = serialNumber;
            });


            let successfulUploads = 0;
            let failedUploads = 0;

            // Itera sobre cada caja y sube sus ítems a Firestore
            for (const [boxId, items] of itemsByBox.entries()) {
                try {
                    const docRef = doc(db, "Items", boxId);
                    // Usa `setDoc` con `{ merge: true }` para añadir/actualizar los ítems
                    // sin borrar otros que ya existieran en esa caja.
                    await setDoc(docRef, items, { merge: true });
                    successfulUploads++;
                } catch (error) {
                    console.error(`Error al subir datos para la caja ${boxId}:`, error);
                    failedUploads++;
                }
            }

            // Muestra el resultado final al usuario
            if (successfulUploads > 0) {
                showMessage(`Importación completada: ${successfulUploads} cajas actualizadas/creadas. ${failedUploads > 0 ? `${failedUploads} fallaron.` : ''}`, 'success');
            } else {
                showMessage(`No se pudo importar ningún dato. ${failedUploads > 0 ? `${failedUploads} fallaron.` : 'Verifica el formato del CSV.'}`, 'error');
            }
            showLoading(false);
            csvFileInput.value = ''; // Limpia el input de archivo
        },
        error: (err) => {
            showMessage(`Error crítico al leer el archivo: ${err.message}`, 'error');
            showLoading(false);
        }
    });
};


// 5. EVENTO PRINCIPAL QUE EJECUTA TODO CUANDO LA PÁGINA CARGA

document.addEventListener('DOMContentLoaded', () => {
    // Verificación de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Si tienes una colección 'users', puedes obtener el nombre
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDisplayName) {
                userDisplayName.textContent = userDocSnap.data().name || user.email;
            } else if (userDisplayName) {
                userDisplayName.textContent = user.email;
            }
        } else {
            // Si no hay usuario, redirigir al login
            window.location.href = 'login.html';
        }
    });

    // Event listener para el botón de subir CSV
    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', () => {
            if (csvFileInput && csvFileInput.files.length > 0) {
                processAndUploadCsv(csvFileInput.files[0]);
            } else {
                showMessage('Por favor, selecciona un archivo CSV primero.', 'error');
            }
        });
    }

    // Event listener para el botón de volver
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    // Event listener para el botón de cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }
});