import { db, auth, onAuthStateChanged, signOut, doc, getDoc, setDoc, updateDoc, registrarHistorial } from './firebase-config.js';

function sanitizeFieldName(name) { return name.replace(/\//g, '_slash_').replace(/\./g, '_dot_').replace(/,/g, '_comma_'); }

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
    let placaTypes = new Set(), placaDiams = new Set(), placaOrificios = new Set();
    let schemaMap = new Map();
    let canUseDropdowns = false;

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'login.html'; return; }
        if (userDisplayName) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayName.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }
        loadSchemaAndBuildForm();
    });

    const buildSchemaMap = (itemNames) => {
        schemaMap.clear();
        itemNames.forEach(itemName => {
            const [code, description] = itemName.split(';');
            if (code && description) { schemaMap.set(description.trim(), code.trim()); }
        });
    };
    
    const parseSchemaForOptions = (itemNames) => {
        let successfulMatches = 0;
        placaTypes.clear(); placaDiams.clear(); placaOrificios.clear();
        itemNames.forEach(itemName => {
            const description = itemName.split(';')[1] || '';
            const match = description.match(/PLACA\s(.*?)\sdiam\.?\s(.*?)\sx\s(.*)/i);
            if (match) {
                placaTypes.add(match[1].trim());
                placaDiams.add(match[2].trim());
                placaOrificios.add(match[3].trim());
                successfulMatches++;
            }
        });
        return successfulMatches > 0;
    };
    
    const applyEnterNavigation = () => {
        const allInputs = document.querySelectorAll('#cajaSerialInput, .item-serial-input');
        allInputs.forEach((input, index) => {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const nextInput = allInputs[index + 1];
                    if (nextInput) { nextInput.focus(); }
                    else if(saveCajaBtn) { saveCajaBtn.focus(); }
                }
            });
        });
    };

    const renderItemRow = (itemName, isDynamic = false) => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        let itemHtml;

        if (isDynamic) {
            formGroup.classList.add('dynamic-item-row');
            if (canUseDropdowns) {
                const sortedTypes = [...placaTypes].sort((a, b) => a.localeCompare(b));
                const sortedDiams = [...placaDiams].sort((a, b) => a.localeCompare(b));
                const sortedOrificios = [...placaOrificios].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
                
                const typeOptions = sortedTypes.map(opt => `<option value="${opt}"></option>`).join('');
                const diamOptions = sortedDiams.map(opt => `<option value="${opt}"></option>`).join('');
                const orificioOptions = sortedOrificios.map(opt => `<option value="${opt}"></option>`).join('');
                
                itemHtml = `
                    <div class="item-details">
                        <label>Nuevo Ítem (Selecciona o escribe)</label>
                        <div class="dynamic-item-selectors">
                            <input type="text" class="item-part-type" list="type-options" placeholder="Tipo...">
                            <datalist id="type-options">${typeOptions}</datalist>
                            <input type="text" class="item-part-diam" list="diam-options" placeholder="Diámetro...">
                            <datalist id="diam-options">${diamOptions}</datalist>
                            <input type="text" class="item-part-orificio" list="orificio-options" placeholder="Orificios...">
                            <datalist id="orificio-options">${orificioOptions}</datalist>
                        </div>
                        <div class="item-code-display" style="display: none;"></div>
                        <input type="text" class="manual-code-input" placeholder="Ingresa el código nuevo" style="display: none;">
                        <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem" style="margin-top:10px;">
                    </div>`;
            } else {
                itemHtml = `
                    <div class="item-details">
                        <label>Nuevo Ítem Manual</label>
                        <input type="text" class="manual-code-input" placeholder="Ingresa el código nuevo">
                        <input type="text" class="manual-desc-input" placeholder="Ingresa la descripción nueva" style="margin-top:10px;">
                        <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem" style="margin-top:10px;">
                    </div>`;
            }
            itemHtml += `<button type="button" class="btn-remove-item">X</button>`;
            formGroup.dataset.isDynamic = true;
        } else {
            const [itemCode, description] = itemName.split(';');
            itemHtml = `
                <div class="item-details">
                    <label><span style="font-weight: bold;">Código: ${itemCode}</span><br><span style="font-style: italic;">${description || ''}</span></label>
                    <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem">
                </div>
                <button type="button" class="btn-remove-item">X</button>`;
            formGroup.dataset.itemName = itemName;
        }
        formGroup.innerHTML = itemHtml;
        itemsContainer.appendChild(formGroup);
        formGroup.querySelector('.btn-remove-item').addEventListener('click', () => { formGroup.remove(); applyEnterNavigation(); });
        
        if (isDynamic && canUseDropdowns) {
            formGroup.querySelectorAll('.dynamic-item-selectors input').forEach(input => {
                input.addEventListener('input', () => handleDropdownChange(formGroup));
            });
        }
    };
    
    const handleDropdownChange = (rowElement) => {
        const type = rowElement.querySelector('.item-part-type').value;
        const diam = rowElement.querySelector('.item-part-diam').value;
        const orificio = rowElement.querySelector('.item-part-orificio').value;
        const codeDisplay = rowElement.querySelector('.item-code-display');
        const manualInput = rowElement.querySelector('.manual-code-input');
        if (type && diam && orificio) {
            const description = `PLACA ${type} diam ${diam} x ${orificio}`;
            const foundCode = schemaMap.get(description);
            if (foundCode) {
                if(codeDisplay) {
                    codeDisplay.innerHTML = `<span class="label">Código Encontrado:</span> ${foundCode}`;
                    codeDisplay.style.display = 'block';
                }
                if(manualInput) {
                    manualInput.style.display = 'none';
                    manualInput.value = '';
                }
            } else {
                if(codeDisplay) codeDisplay.style.display = 'none';
                if(manualInput) manualInput.style.display = 'block';
            }
        }
    };

    const loadSchemaAndBuildForm = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        modelName = urlParams.get('modelName');
        zonaName = urlParams.get('zonaName');
        if (!modelName || !zonaName) { 
            if (formTitle) formTitle.textContent = "Error: Faltan datos del modelo o zona";
            return;
        }
        if (formTitle) formTitle.textContent = `Agregar Caja para: ${modelName}`;
        try {
            const schemaDocRef = doc(db, "esquemas_modelos", modelName);
            const schemaDocSnap = await getDoc(schemaDocRef);
            if (schemaDocSnap.exists()) {
                const itemNames = Object.keys(schemaDocSnap.data()).sort((a, b) => a.split(';')[0].localeCompare(b.split(';')[0], undefined, { numeric: true }));
                buildSchemaMap(itemNames);
                canUseDropdowns = parseSchemaForOptions(itemNames);
                if(itemsContainer) itemsContainer.innerHTML = '';
                itemNames.forEach(name => renderItemRow(name, false));
                applyEnterNavigation();
            } else {
                if(itemsContainer) itemsContainer.innerHTML = "<p>Error: No se encontró el esquema para este modelo de caja.</p>";
                if(saveCajaBtn) saveCajaBtn.disabled = true;
                if(addItemBtn) addItemBtn.disabled = true;
            }
        } catch (error) { 
            console.error("Error al cargar el esquema:", error);
            if(itemsContainer) itemsContainer.innerHTML = "<p>Ocurrió un error al cargar el esquema.</p>";
        }
    };

    if (saveCajaBtn) {
        saveCajaBtn.addEventListener('click', async () => {
            if(messageDiv) messageDiv.textContent = '';
            
            const newCajaSerialInput = document.getElementById('cajaSerialInput');
            if (!newCajaSerialInput) return;

            const newCajaSerial = newCajaSerialInput.value.trim();
            if (!newCajaSerial) { 
                if(messageDiv) {
                    messageDiv.textContent = "El N° de Serie de la caja es obligatorio.";
                    messageDiv.style.color = "red";
                }
                return;
            }

            const itemsData = {};
            const itemRows = itemsContainer.querySelectorAll('.form-group');
            let allFieldsFilled = true;
            let errorInDynamicRow = false;

            itemRows.forEach(row => {
                if (errorInDynamicRow || !allFieldsFilled) return;

                const serialInput = row.querySelector('.item-serial-input');
                if (!serialInput || !serialInput.value.trim()) {
                    allFieldsFilled = false;
                    return;
                }
                const itemSerial = serialInput.value.trim();
                let itemName = '';

                if (row.dataset.isDynamic) {
                    let itemCode, description;
                    if (canUseDropdowns) {
                        const type = row.querySelector('.item-part-type').value;
                        const diam = row.querySelector('.item-part-diam').value;
                        const orificio = row.querySelector('.item-part-orificio').value;
                        if (!type || !diam || !orificio) { errorInDynamicRow = true; return; }
                        description = `PLACA ${type} diam ${diam} x ${orificio}`;
                        itemCode = schemaMap.get(description);
                        if (!itemCode) {
                            itemCode = row.querySelector('.manual-code-input').value.trim();
                            if (!itemCode) { errorInDynamicRow = true; return; }
                        }
                    } else {
                        itemCode = row.querySelector('.manual-code-input').value.trim();
                        description = row.querySelector('.manual-desc-input').value.trim();
                        if (!itemCode || !description) { errorInDynamicRow = true; return; }
                    }
                    itemName = `${itemCode};${description}`;
                } else {
                    itemName = row.dataset.itemName;
                }
                if (itemName) itemsData[sanitizeFieldName(itemName)] = itemSerial;
            });

            if (!allFieldsFilled) {
                if(messageDiv) {
                    messageDiv.textContent = "Por favor, rellena el N° de Serie de todos los ítems.";
                    messageDiv.style.color = "red";
                }
                return;
            }
            if (errorInDynamicRow) {
                if(messageDiv) {
                    messageDiv.textContent = "Completa todas las opciones o campos manuales de los ítems nuevos.";
                    messageDiv.style.color = "red";
                }
                return;
            }

            try {
                await setDoc(doc(db, "Items", newCajaSerial), itemsData);

                const zonaDocRef = doc(db, "Cajas", zonaName);
                const zonaDocSnap = await getDoc(zonaDocRef);
                if (zonaDocSnap.exists()) {
                    const serials = (zonaDocSnap.data()[modelName] || "").split(',').filter(Boolean);
                    if (!serials.includes(newCajaSerial)) {
                        serials.push(newCajaSerial);
                        await updateDoc(zonaDocRef, { [modelName]: serials.join(',') });
                    }
                }

                registrarHistorial('CREACIÓN DE CAJA', {
                    cajaSerie: newCajaSerial,
                    modelo: modelName,
                    zona: zonaName,
                    numItems: Object.keys(itemsData).length,
                    mensaje: `Se creó la nueva caja "${newCajaSerial}" (Modelo: ${modelName}) con ${Object.keys(itemsData).length} ítems.`
                });

                if(messageDiv) {
                    messageDiv.textContent = "¡Caja guardada con éxito!";
                    messageDiv.style.color = "green";
                }
                setTimeout(() => { 
                    window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
                }, 2000);

            } catch (error) {
                console.error("Error al guardar la caja:", error);
                if(messageDiv) {
                    messageDiv.textContent = "Error al guardar la caja: " + error.message;
                    messageDiv.style.color = "red";
                }
            }
        });
    }

    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => { renderItemRow(null, true); applyEnterNavigation(); });
    }
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));
});