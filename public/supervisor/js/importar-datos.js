import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc
} from './firebase-config.js';
function sanitizeFieldName(name) {
    return name.replace(/\//g, '_slash_').replace(/\./g, '_dot_').replace(/,/g, '_comma_');
}

const csvFileInput = document.getElementById('csvFileInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const messageDiv = document.getElementById('message');
const loadingSpinner = document.getElementById('loading-spinner');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');

const showMessage = (msg, type = 'info') => {
    if (messageDiv) {
        messageDiv.textContent = msg;
        messageDiv.className = `message-area ${type}`;
        messageDiv.style.display = 'block';
    }
};

const clearMessage = () => {
    if (messageDiv) {
        messageDiv.textContent = '';
        messageDiv.className = 'message-area';
        messageDiv.style.display = 'none';
    }
};

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

            const itemsByBox = new Map();

            results.data.forEach(row => {
                const boxSerialNumber = row['boxSerialNumber']?.trim();
                const itemCode = row['itemCode']?.trim();
                const description = row['description']?.trim();
                const serialNumber = row['serialNumber']?.trim();

                if (!boxSerialNumber || !itemCode || !description || !serialNumber) {
                    return;
                }

                if (!itemsByBox.has(boxSerialNumber)) {
                    itemsByBox.set(boxSerialNumber, {});
                }

                const boxItems = itemsByBox.get(boxSerialNumber);
                const originalFieldName = `${itemCode};${description}`;
                
                const sanitizedName = sanitizeFieldName(originalFieldName);
                boxItems[sanitizedName] = serialNumber;
            });

            let successfulUploads = 0;
            let failedUploads = 0;

            for (const [boxId, items] of itemsByBox.entries()) {
                try {
                    const docRef = doc(db, "Items", boxId);
                    await setDoc(docRef, items, { merge: true });
                    successfulUploads++;
                } catch (error) {
                    console.error(`Error al subir datos para la caja ${boxId}:`, error);
                    failedUploads++;
                }
            }

            if (successfulUploads > 0) {
                showMessage(`Importación completada: ${successfulUploads} cajas actualizadas/creadas. ${failedUploads > 0 ? `${failedUploads} fallaron.` : ''}`, 'success');
            } else {
                showMessage(`No se pudo importar ningún dato. ${failedUploads > 0 ? `${failedUploads} fallaron.` : 'Verifica el formato del CSV.'}`, 'error');
            }
            showLoading(false);
            csvFileInput.value = '';
        },
        error: (err) => {
            showMessage(`Error crítico al leer el archivo: ${err.message}`, 'error');
            showLoading(false);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDisplayName) {
                userDisplayName.textContent = userDocSnap.data().name || user.email;
            } else if (userDisplayName) {
                userDisplayName.textContent = user.email;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', () => {
            if (csvFileInput && csvFileInput.files.length > 0) {
                processAndUploadCsv(csvFileInput.files[0]);
            } else {
                showMessage('Por favor, selecciona un archivo CSV primero.', 'error');
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'redir-import.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = '../login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }
});