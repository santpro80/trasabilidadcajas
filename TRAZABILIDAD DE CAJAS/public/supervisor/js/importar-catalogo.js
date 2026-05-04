import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc
} from './firebase-config.js';

const csvFileInput = document.getElementById('csvFileInput');
const uploadCsvBtn = document.getElementById('uploadCsvBtn');
const messageDiv = document.getElementById('message');
const loadingSpinner = document.getElementById('loading-spinner');
const userDisplayName = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');

const showMessage = (msg, type = 'info') => {
    if (messageDiv) {
        messageDiv.innerHTML = msg;
        messageDiv.className = `message-area ${type}`;
        messageDiv.style.display = 'block';
    }
};

const clearMessage = () => {
    if (messageDiv) {
        messageDiv.innerHTML = '';
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
    showMessage('Procesando el archivo del Catálogo...', 'info');

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            console.log("PapaParse Finalizó", results);
            
            if (results.errors.length > 0 && (!results.data || results.data.length === 0)) {
                showMessage(`Error al leer el CSV: ${results.errors[0].message}<br>Asegúrate de que estás subiendo un CSV delimitado correctamente.`, 'error');
                showLoading(false);
                return;
            }

            if (!results.data || results.data.length === 0) {
                showMessage('El archivo CSV está completamente vacío o es ilegible.', 'error');
                showLoading(false);
                return;
            }

            let successfulUploads = 0;
            let failedUploads = 0;
            let skippedUploads = 0;

            // Procesar fila por fila a firestore.
            for (let i = 0; i < results.data.length; i++) {
                const row = results.data[i];
                const codigoRaw = row['codigo'] || row['Codigo'] || row['código'] || row['Código'] || '';
                const descripcionRaw = row['descripcion'] || row['Descripcion'] || row['descripción'] || '';
                const estadoRaw = row['estado'] || row['Estado'] || '';

                const codigo = String(codigoRaw).trim();
                const descripcion = String(descripcionRaw).trim();
                const estado = String(estadoRaw).trim();

                if (!codigo) {
                    skippedUploads++;
                    continue; // Ignorar filas sin codigo real
                }

                try {
                    // Usamos el codigo mismo como ID del documento para que nunca se dupliquen items
                    const docRef = doc(db, "catalogo_items", codigo);
                    await setDoc(docRef, {
                        codigo: codigo,
                        descripcion: descripcion,
                        estado: estado,
                        // Se deja espacio para futuras extensiones (familia, etc)
                    }, { merge: true });
                    successfulUploads++;
                } catch (error) {
                    console.error(`Error al subir item ${codigo}:`, error);
                    failedUploads++;
                }
            }

            if (successfulUploads > 0) {
                showMessage(`¡Catálogo importado exitosamente!<br>
                             ✔️ ${successfulUploads} ítems procesados/actualizados.<br>
                             ${skippedUploads > 0 ? `⏭️ ${skippedUploads} saltados (sin código).<br>` : ''}
                             ${failedUploads > 0 ? `❌ ${failedUploads} errores de red.` : ''}`, 'success');
            } else {
                showMessage('No se detectaron ítems válidos para importar. Revisa las cabeceras "codigo, descripcion, estado".', 'error');
            }
            showLoading(false);
            csvFileInput.value = '';
        },
        error: (err) => {
            showMessage(`Error crítico de formato al leer el archivo: ${err.message}`, 'error');
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
            window.location.href = '../login.html';
        }
    });

    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', () => {
            if (csvFileInput && csvFileInput.files.length > 0) {
                processAndUploadCsv(csvFileInput.files[0]);
            } else {
                showMessage('Falta seleccionar un archivo local CSV separado por comas.', 'error');
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
