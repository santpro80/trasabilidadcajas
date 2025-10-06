// public/js/importar-esquema.js

import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    setDoc,
    collection,
    getDocs,
    getDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const zonasSelect = document.getElementById('zonasSelect');
    const modelosSelect = document.getElementById('modelosSelect');
    const schemaFileInput = document.getElementById('schemaFileInput');
    const uploadSchemaBtn = document.getElementById('uploadSchemaBtn');
    const messageDiv = document.getElementById('message');
    const loadingSpinner = document.getElementById('loading-spinner');
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');

    // --- Funciones de UI ---
    const showMessage = (msg, type = 'info') => {
        if (messageDiv) {
            messageDiv.textContent = msg;
            messageDiv.className = `message-area ${type}`;
            messageDiv.style.display = 'block';
        }
    };

    const showLoading = (show) => {
        if (loadingSpinner) loadingSpinner.style.display = show ? 'block' : 'none';
        if (uploadSchemaBtn) uploadSchemaBtn.disabled = show;
        if (show && messageDiv) messageDiv.style.display = 'none';
    };

    // --- Lógica de Autenticación y Carga Inicial ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (userDisplayName) userDisplayName.textContent = user.displayName || user.email;
            loadZonasCorporales();
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- Cargar las Zonas Corporales ---
    const loadZonasCorporales = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "Cajas"));
            zonasSelect.innerHTML = '<option value="">-- Selecciona una zona --</option>';
            
            const zonas = [];
            querySnapshot.forEach((doc) => {
                zonas.push(doc.id);
            });

            zonas.sort().forEach(zonaId => {
                const option = document.createElement('option');
                option.value = zonaId;
                option.textContent = zonaId.toUpperCase();
                zonasSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error cargando zonas corporales: ", error);
            showMessage("Error al cargar las zonas.", "error");
        }
    };

    // --- Cargar Modelos de Caja cuando se selecciona una Zona ---
    zonasSelect.addEventListener('change', async () => {
        const selectedZona = zonasSelect.value;
        modelosSelect.innerHTML = '<option value="">Cargando modelos...</option>';
        modelosSelect.disabled = true;

        if (!selectedZona) {
            modelosSelect.innerHTML = '<option value="">Primero selecciona una zona corporal</option>';
            return;
        }

        try {
            const docRef = doc(db, "Cajas", selectedZona);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                modelosSelect.innerHTML = '<option value="">-- Selecciona un modelo --</option>';
                const data = docSnap.data();
                const models = Object.keys(data);

                models.sort().forEach(modelId => {
                    const option = document.createElement('option');
                    option.value = modelId;
                    option.textContent = modelId.toUpperCase();
                    modelosSelect.appendChild(option);
                });
                modelosSelect.disabled = false;
            } else {
                modelosSelect.innerHTML = '<option value="">No hay modelos para esta zona</option>';
            }
        } catch (error) {
            console.error("Error cargando modelos: ", error);
            showMessage("Error al cargar los modelos de caja.", "error");
        }
    });
    
    // --- Lógica de Navegación ---
    backBtn.addEventListener('click', () => window.location.href = 'redir-import.html');
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    });
    
    // --- Lógica Principal de Subida de Esquema ---
    uploadSchemaBtn.addEventListener('click', () => {
        const selectedModel = modelosSelect.value;
        const file = schemaFileInput.files[0];

        if (!selectedModel) {
            showMessage('Por favor, selecciona un modelo de la lista.', 'error');
            return;
        }
        if (!file) {
            showMessage('Por favor, selecciona un archivo CSV con el esquema.', 'error');
            return;
        }
        
        processAndUploadSchema(selectedModel, file);
    });

    const processAndUploadSchema = (modelName, file) => {
        showLoading(true);

        // === CORRECCIÓN: Sanitizar el nombre del modelo para Firestore ===
        const sanitizedModelName = modelName.replace(/\//g, '_');
        // =================================================================

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            complete: async (results) => {
                if (results.errors.length > 0) {
                    showMessage(`Error al leer el CSV: ${results.errors[0].message}`, 'error');
                    showLoading(false);
                    return;
                }

                const schemaToSave = {};
                let itemCount = 0;

                for (const row of results.data) {
                    const codigo = row[0]?.trim();
                    const descripcion = row[1]?.trim();

                    if (codigo && descripcion) {
                        const fieldName = `${codigo};${descripcion}`;
                        schemaToSave[fieldName] = "";
                        itemCount++;
                    }
                }

                if (itemCount === 0) {
                    showMessage('El archivo CSV no contiene ítems válidos.', 'error');
                    showLoading(false);
                    return;
                }

                try {
                    // Usar el nombre sanitizado para la referencia del documento
                    const esquemaDocRef = doc(db, "esquemas_modelos", sanitizedModelName);
                    
                    await setDoc(esquemaDocRef, schemaToSave);
                    // Mostrar el nombre original en el mensaje de éxito
                    showMessage(`Esquema del modelo "${modelName.toUpperCase()}" guardado con ${itemCount} ítems.`, 'success');
                } catch (error) {
                    console.error(`Error al subir el esquema para ${modelName}:`, error);
                    showMessage(`Error al guardar en la base de datos: ${error.message}`, 'error');
                } finally {
                    if(schemaFileInput) schemaFileInput.value = '';
                    showLoading(false);
                }
            }
        });
    };
});