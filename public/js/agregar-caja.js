import { db, auth, onAuthStateChanged, signOut, doc, getDoc, setDoc, updateDoc, registrarHistorial, sanitizeFieldName, addDoc, collection, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const formTitle = document.getElementById('form-title');
    const itemsContainer = document.getElementById('items-container');
    const saveCajaBtn = document.getElementById('save-caja-btn');
    const addItemBtn = document.getElementById('add-item-btn');
    const messageDiv = document.getElementById('message');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
    
    let modelName = '', zonaName = '';
    let codeToDescMap = new Map();

    let notificationTimeout;
    const showNotification = (message, type = 'error') => {
        if(messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.color = type === 'error' ? 'red' : 'green';
            clearTimeout(notificationTimeout);
            notificationTimeout = setTimeout(() => { messageDiv.textContent = ''; }, 3000);
        }
    };
    const forceUppercase = (event) => {
        const input = event.target;
        const originalSelectionStart = input.selectionStart;
        const originalSelectionEnd = input.selectionEnd;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(originalSelectionStart, originalSelectionEnd);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html'; return;
        }
        if (userDisplayName) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayName.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }

        const cajaSerialInput = document.getElementById('cajaSerialInput');
        if (cajaSerialInput) {
            cajaSerialInput.addEventListener('input', forceUppercase);
        }

        if (itemsContainer) {
            itemsContainer.addEventListener('input', (event) => {
                if (event.target.matches('.item-serial-input, .manual-code-input')) {
                    forceUppercase(event);
                }
            });
        }

        loadSchemaAndBuildForm();
    });

    const loadSchemaAndBuildForm = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        modelName = urlParams.get('modelName');
        zonaName = urlParams.get('zonaName');
        if (!modelName || !zonaName) { 
            formTitle.textContent = "Error: Faltan datos del modelo o zona";
            return;
        }
        formTitle.textContent = `Agregar Caja para: ${modelName}`;
        try {
            const schemaDocRef = doc(db, "esquemas_modelos", modelName);
            const schemaDocSnap = await getDoc(schemaDocRef);
            if (schemaDocSnap.exists()) {
                const itemNames = Object.keys(schemaDocSnap.data()).sort((a, b) => a.split(';')[0].localeCompare(b.split(';')[0], undefined, { numeric: true }));
                buildCodeToDescMap(itemNames);
                itemsContainer.innerHTML = '';
                itemNames.forEach(name => renderStaticItemRow(name));
                applyEnterNavigation();
            } else {
                itemsContainer.innerHTML = "<p>Error: No se encontró el esquema para este modelo de caja.</p>";
                saveCajaBtn.disabled = true;
                addItemBtn.disabled = true;
            }
        } catch (error) { 
            console.error("Error al cargar el esquema:", error);
            itemsContainer.innerHTML = "<p>Ocurrió un error al cargar el esquema.</p>";
        }
    };
    
    const buildCodeToDescMap = (itemNames) => {
        codeToDescMap.clear();
        itemNames.forEach(itemName => {
            const [code, description] = itemName.split(';');
            if (code && description) {
                codeToDescMap.set(code.trim(), description.trim());
            }
        });
    };

    const renderStaticItemRow = (itemName) => {
        const [itemCode, description] = itemName.split(';');
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group static-item-row';
        formGroup.dataset.itemName = itemName; 
        formGroup.innerHTML = `
            <div class="item-details">
                <label><span style="font-weight: bold;">Código: ${itemCode}</span><br><span style="font-style: italic;">${description || ''}</span></label>
                <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem">
            </div>
            <button type="button" class="btn-remove-item" title="Quitar de la lista">X</button>
        `;
        itemsContainer.appendChild(formGroup);
        formGroup.querySelector('.btn-remove-item').addEventListener('click', () => { 
            formGroup.remove(); 
            applyEnterNavigation(); 
        });
    };
 
    const addDynamicItemRow = () => {
        if (document.querySelector('.dynamic-item-row-new')) {
            showNotification("Ya estás agregando un ítem nuevo.", "error");
            return;
        }
        const newRow = document.createElement('div');
        newRow.className = 'form-group dynamic-item-row-new';
        newRow.innerHTML = `
            <div class="item-details">
                <input type="text" class="manual-code-input" placeholder="Ingresar código de producto..." style="margin-bottom: 10px;">
                <div class="item-desc-display" style="font-family: monospace; margin-bottom: 10px; min-height: 1.2em;"></div>
                <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem">
            </div>
            <div class="dynamic-item-actions">
                <button type="button" class="btn-remove-item cancel-add-btn">X</button>
                <button type="button" class="btn-save-item save-add-btn">✓</button>
            </div>
        `;
        itemsContainer.appendChild(newRow);
        
        const codeInput = newRow.querySelector('.manual-code-input');
        codeInput.focus();
        codeInput.addEventListener('input', () => {
            const desc = codeToDescMap.get(codeInput.value.trim());
            newRow.querySelector('.item-desc-display').textContent = desc ? `Descripción: ${desc}` : 'El código no tiene descripción asignada.';
        });

        newRow.querySelector('.cancel-add-btn').addEventListener('click', () => newRow.remove());
        newRow.querySelector('.save-add-btn').addEventListener('click', () => saveDynamicItem(newRow));
        applyEnterNavigation();
    };

    const saveDynamicItem = (rowElement) => {
        const codeInput = rowElement.querySelector('.manual-code-input');
        const serialInput = rowElement.querySelector('.item-serial-input');
        const itemCode = codeInput.value.trim();
        const itemSerial = serialInput.value.trim();
        let description = codeToDescMap.get(itemCode);

        if (!itemCode || !itemSerial) {
            showNotification("Código y N° de Serie son obligatorios.", "error");
            return;
        }

        if (!description) {
            description = prompt("Este código no tiene descripción. Por favor, ingresa una descripción:");
            if (!description || !description.trim()) {
                showNotification("La descripción es obligatoria para un código nuevo.", "error");
                return;
            }
            description = description.trim();
        }

        const itemName = `${itemCode};${description}`;
        
        rowElement.className = 'form-group static-item-row';
        rowElement.dataset.itemName = itemName;
        rowElement.innerHTML = `
            <div class="item-details">
                <label><span style="font-weight: bold;">Código: ${itemCode}</span><br><span style="font-style: italic;">${description}</span></label>
                <input type="text" class="item-serial-input" value="${itemSerial}" placeholder="N° de Serie del Ítem">
            </div>
            <button type="button" class="btn-remove-item" title="Quitar de la lista">X</button>
        `;
        rowElement.querySelector('.btn-remove-item').addEventListener('click', () => rowElement.remove());
        applyEnterNavigation();
    };

    const applyEnterNavigation = () => {
        const allInputs = document.querySelectorAll('#cajaSerialInput, .item-serial-input, .manual-code-input');
        allInputs.forEach((input, index) => {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const nextInput = allInputs[index + 1];
                    if (nextInput) { nextInput.focus(); }
                    else { saveCajaBtn.focus(); }
                }
            });
        });
    };

    saveCajaBtn.addEventListener('click', async () => {
        showNotification('Guardando caja...', 'info');
        
        const newCajaSerial = document.getElementById('cajaSerialInput').value.trim();
        if (!newCajaSerial) { 
            showNotification("El N° de Serie de la caja es obligatorio.", "error");
            return;
        }

        const itemsData = {};
        const itemRows = itemsContainer.querySelectorAll('.static-item-row');
        let allFieldsFilled = true;

        itemRows.forEach(row => {
            const itemName = row.dataset.itemName;
            const serialInput = row.querySelector('.item-serial-input');
            const itemSerial = serialInput ? serialInput.value.trim() : null;

            if (!itemSerial) {
                allFieldsFilled = false;
            }
            if (itemName && itemSerial) {
                itemsData[sanitizeFieldName(itemName)] = itemSerial;
            }
        });

        if (!allFieldsFilled) {
            showNotification("Por favor, rellena el N° de Serie de todos los ítems.", "error");
            return;
        }
        if (Object.keys(itemsData).length === 0) {
            showNotification("La caja debe tener al menos un ítem.", "error");
            return;
        }

        try {
            const existingBox = await getDoc(doc(db, "Items", newCajaSerial));
            if (existingBox.exists()) {
                showNotification(`Error: La caja con N° de Serie "${newCajaSerial}" ya existe.`, "error");
                return;
            }

            const finalDocData = {
                ...itemsData,
                modelo: modelName 
            };

            await setDoc(doc(db, "Items", newCajaSerial), finalDocData);

            const zonaDocRef = doc(db, "Cajas", zonaName);
            const zonaDocSnap = await getDoc(zonaDocRef);
            if (zonaDocSnap.exists()) {
                const serials = (zonaDocSnap.data()[modelName] || "").split(',').filter(Boolean);
                if (!serials.includes(newCajaSerial)) {
                    serials.push(newCajaSerial);
                    await updateDoc(zonaDocRef, { [modelName]: serials.join(',') });
                }
            }

            const tracingStartTime = localStorage.getItem('tracingStartTime');
            const tracingModelName = localStorage.getItem('tracingModelName');
            if (tracingStartTime && tracingModelName) {
                const endTime = Date.now();
                const durationMs = endTime - parseInt(tracingStartTime, 10);
                await saveTracingTime(tracingModelName, durationMs);
                localStorage.removeItem('tracingStartTime');
                localStorage.removeItem('tracingModelName');
                localStorage.removeItem('tracingZonaName');
            }

            const numItems = Object.keys(itemsData).length;
            registrarHistorial('CREACIÓN DE CAJA', {
                cajaSerie: newCajaSerial,
                modelo: modelName,
                zona: zonaName,
                numItems: numItems,
                mensaje: `Se creó la nueva caja "${newCajaSerial}" (Modelo: ${modelName}) con ${numItems} ítems.`
            });

            showNotification("¡Caja guardada con éxito!", "success");
            setTimeout(() => { 
                window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
            }, 2000);

        } catch (error) {
            console.error("Error al guardar la caja:", error);
            showNotification("Error al guardar la caja: " + error.message, "error");
        }
    });

    const saveTracingTime = async (model, duration) => {
        try {
            await addDoc(collection(db, "tracingTimes"), {
                modelName: model,
                durationMs: duration,
                timestamp: serverTimestamp()
            });
            console.log(`Tiempo de trazado guardado para ${model}: ${duration}ms`);
        } catch (error) {
            console.error("Error al guardar el tiempo de trazado:", error);
            showNotification(`Error al guardar tiempo: ${error.message}`, 'error');
        }
    };

    addItemBtn.addEventListener('click', addDynamicItemRow);
    backBtn.addEventListener('click', () => window.history.back());
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));
});
