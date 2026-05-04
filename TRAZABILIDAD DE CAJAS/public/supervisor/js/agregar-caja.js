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
    const showNotification = (message, type = 'success') => {
        const toast = document.getElementById('notification-toast');
        const icon = document.getElementById('toast-icon');
        const msg = document.getElementById('toast-message');
        if (!toast || !icon || !msg) return;

        const toastContent = toast.querySelector('.toast-content');
        if (!toastContent) return;

        clearTimeout(notificationTimeout);
        msg.textContent = message;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check_circle';
        if (type === 'error') iconName = 'error';
        if (type === 'warning') iconName = 'warning';
        icon.textContent = iconName;
        
        toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300';
        
        if (type === 'success') {
            toastContent.className += ' bg-emerald-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-emerald-500/30 dark:text-emerald-400';
        } else if (type === 'error') {
            toastContent.className += ' bg-rose-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-rose-500/30 dark:text-rose-400';
        } else if (type === 'warning') {
            toastContent.className += ' bg-amber-500 text-slate-800 dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-amber-500/30 dark:text-amber-400';
        } else {
            toastContent.className += ' bg-slate-800 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-white/10 dark:text-slate-200';
        }

        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-full transition-all duration-500';
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        notificationTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 3000);
    };
    const forceUppercase = (event) => {
        const input = event.target;
        const originalSelectionStart = input.selectionStart;
        const originalSelectionEnd = input.selectionEnd;
        input.value = input.value.toUpperCase();
        input.setSelectionRange(originalSelectionStart, originalSelectionEnd);
    };

    const handleKeyboardChange = (event) => {
        const input = event.target;
        if (input.value.length >= 2) {
            input.setAttribute('inputmode', 'numeric');
        } else {
            input.setAttribute('inputmode', 'text');
        }
    };

    let lastDuplicateState = false;
    const validateInputsAndCount = () => {
        const itemInputs = Array.from(itemsContainer.querySelectorAll('.item-serial-input'));
        let filledCount = 0;
        const valueMap = new Map();
        let hasDuplicate = false;

        itemInputs.forEach(input => {
            input.classList.remove('focus:ring-emerald-500/50', 'focus:border-emerald-500', 'border-amber-500', 'focus:ring-amber-500/50');
            input.classList.add('focus:ring-emerald-500/50', 'focus:border-emerald-500');
            const warningIcon = input.parentElement.querySelector('.duplicate-warning');
            if (warningIcon) warningIcon.remove();
        });

        itemInputs.forEach(input => {
            const val = input.value.trim().toUpperCase();
            if (val && val !== 'REEMPLAZAR') {
                filledCount++;
                if (valueMap.has(val)) {
                    hasDuplicate = true;
                    // Mark current
                    input.classList.remove('focus:ring-emerald-500/50', 'focus:border-emerald-500', 'border-slate-200', 'dark:border-white/10');
                    input.classList.add('border-amber-500', 'focus:ring-amber-500/50');
                    const warningSpan = document.createElement('span');
                    warningSpan.className = 'duplicate-warning material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 text-[20px] pointer-events-none';
                    warningSpan.textContent = 'warning';
                    warningSpan.title = "Número de serie repetido";
                    input.parentElement.style.position = 'relative';
                    input.parentElement.appendChild(warningSpan);
                    
                    // Mark previous
                    const firstInput = valueMap.get(val);
                    if (firstInput) {
                        firstInput.classList.remove('focus:ring-emerald-500/50', 'focus:border-emerald-500', 'border-slate-200', 'dark:border-white/10');
                        firstInput.classList.add('border-amber-500', 'focus:ring-amber-500/50');
                        if (!firstInput.parentElement.querySelector('.duplicate-warning')) {
                            const warningSpan2 = document.createElement('span');
                            warningSpan2.className = 'duplicate-warning material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 text-[20px] pointer-events-none';
                            warningSpan2.textContent = 'warning';
                            warningSpan2.title = "Número de serie repetido";
                            firstInput.parentElement.style.position = 'relative';
                            firstInput.parentElement.appendChild(warningSpan2);
                        }
                    }
                } else {
                    valueMap.set(val, input);
                    input.classList.add('border-slate-200', 'dark:border-white/10');
                }
            } else if (!val || val === 'REEMPLAZAR') {
                input.classList.add('border-slate-200', 'dark:border-white/10');
            }
        });

        const itemsCountDisplay = document.getElementById('items-count-display');
        if (itemsCountDisplay) {
            itemsCountDisplay.textContent = `Items llenados: ${filledCount}`;
            if (filledCount > 0) {
                itemsCountDisplay.classList.add('text-emerald-500', 'dark:text-emerald-400');
                itemsCountDisplay.classList.remove('text-slate-400', 'dark:text-slate-500');
            } else {
                itemsCountDisplay.classList.remove('text-emerald-500', 'dark:text-emerald-400');
                itemsCountDisplay.classList.add('text-slate-400', 'dark:text-slate-500');
            }
        }

        if (hasDuplicate && !lastDuplicateState) {
            showNotification("Cuidado, número de serie repetido", "warning");
        }
        lastDuplicateState = hasDuplicate;
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
            cajaSerialInput.addEventListener('input', (e) => {
                forceUppercase(e);
                handleKeyboardChange(e);
            });
        }

        if (itemsContainer) {
            itemsContainer.addEventListener('input', (event) => {
                if (event.target.matches('.item-serial-input, .manual-code-input')) {
                    forceUppercase(event);
                }
                if (event.target.matches('.item-serial-input')) {
                    handleKeyboardChange(event);
                    validateInputsAndCount();
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
                const schemaData = schemaDocSnap.data();
                // Se leen los nombres de los campos del documento como los ítems.
                const itemNames = Object.keys(schemaData).sort((a, b) => a.split(';')[0].localeCompare(b.split(';')[0], undefined, { numeric: true }));

                // Si no hay campos, el esquema está vacío.
                if (itemNames.length === 0) {
                    itemsContainer.innerHTML = "<p>Error: El esquema para este modelo no contiene ningún ítem.</p>";
                    saveCajaBtn.disabled = true;
                    addItemBtn.disabled = true;
                    return;
                }
                buildCodeToDescMap(itemNames);
                itemsContainer.innerHTML = '';
                itemNames.forEach(name => renderStaticItemRow(name));
                // applyEnterNavigation(); // Ya no es necesario llamarlo aquí
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
        formGroup.className = 'bg-white dark:bg-slate-800/40 rounded-2xl p-4 lg:p-5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-villalba-blue/40 hover:-translate-y-1 dark:hover:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 group transition-all duration-300 shadow-sm hover:shadow-xl relative overflow-hidden static-item-row';
        formGroup.dataset.itemName = itemName; 
        formGroup.innerHTML = `
            <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[120px_1fr_150px] gap-4 items-center relative z-10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 shrink-0 rounded-xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue transition-colors group-hover:bg-villalba-blue group-hover:text-white">
                        <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                    </div>
                    <span class="text-xs font-black tracking-widest text-slate-500 uppercase group-hover:text-villalba-blue transition-colors">${itemCode || 'S/C'}</span>
                </div>
                
                <h3 class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight uppercase break-words" title="${description || ''}">${description || ''}</h3>
                
                <div class="flex items-center pr-2">
                    <input type="text" class="item-serial-input w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" placeholder="N° Serie">
                </div>
            </div>
            
            <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end relative z-10">
                <button type="button" class="btn-remove-item w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors border border-rose-100 dark:border-rose-500/20 shadow-sm" title="Quitar de la lista">
                    <span class="material-symbols-outlined text-[20px] pointer-events-none">close</span>
                </button>
            </div>
            <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        `;
        itemsContainer.appendChild(formGroup);
        formGroup.querySelector('.btn-remove-item').addEventListener('click', () => { 
            formGroup.remove(); 
            validateInputsAndCount();
        });
    };
 
    const addDynamicItemRow = () => {
        if (document.querySelector('.dynamic-item-row-new')) {
            showNotification("Ya estás agregando un ítem nuevo.", "error");
            return;
        }
        const newRow = document.createElement('div');
        newRow.className = 'form-group dynamic-item-row-new bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 lg:p-5 border-2 border-dashed border-villalba-blue/40 dark:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 transition-all duration-300 relative overflow-hidden';
        newRow.innerHTML = `
            <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[140px_1fr_150px] gap-4 items-center">
                <div class="flex items-center">
                    <input type="text" class="manual-code-input w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-villalba-blue/50 focus:border-villalba-blue transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" placeholder="Código">
                </div>
                
                <h3 class="item-desc-display font-medium text-slate-600 dark:text-slate-400 text-sm leading-tight uppercase break-words">Esperando código...</h3>
                
                <div class="flex items-center pr-2">
                    <input type="text" class="item-serial-input w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" placeholder="N° Serie">
                </div>
            </div>
            
            <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end gap-2 dynamic-item-actions">
                <button type="button" class="btn-remove-item cancel-add-btn w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm" title="Cancelar">
                    <span class="material-symbols-outlined text-[20px] pointer-events-none">close</span>
                </button>
                <button type="button" class="btn-save-item save-add-btn w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm" title="Confirmar">
                    <span class="material-symbols-outlined text-[20px] pointer-events-none">check</span>
                </button>
            </div>
        `;
        itemsContainer.appendChild(newRow);
        
        const codeInput = newRow.querySelector('.manual-code-input');
        codeInput.focus();
        codeInput.addEventListener('input', () => {
            const desc = codeToDescMap.get(codeInput.value.trim());
            newRow.querySelector('.item-desc-display').textContent = desc ? `Descripción: ${desc}` : 'El código no tiene descripción asignada.';
        });

        newRow.querySelector('.cancel-add-btn').addEventListener('click', () => {
            newRow.remove();
            validateInputsAndCount();
        });
        newRow.querySelector('.save-add-btn').addEventListener('click', () => saveDynamicItem(newRow));
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
        
        rowElement.className = 'bg-white dark:bg-slate-800/40 rounded-2xl p-4 lg:p-5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-villalba-blue/40 hover:-translate-y-1 dark:hover:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 group transition-all duration-300 shadow-sm hover:shadow-xl relative overflow-hidden static-item-row';
        rowElement.dataset.itemName = itemName;
        rowElement.innerHTML = `
            <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[120px_1fr_150px] gap-4 items-center relative z-10">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 shrink-0 rounded-xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue transition-colors group-hover:bg-villalba-blue group-hover:text-white">
                        <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                    </div>
                    <span class="text-xs font-black tracking-widest text-slate-500 uppercase group-hover:text-villalba-blue transition-colors">${itemCode}</span>
                </div>
                
                <h3 class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight uppercase break-words" title="${description}">${description}</h3>
                
                <div class="flex items-center pr-2">
                    <input type="text" class="item-serial-input w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" value="${itemSerial}" placeholder="N° Serie">
                </div>
            </div>
            
            <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end relative z-10">
                <button type="button" class="btn-remove-item w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors border border-rose-100 dark:border-rose-500/20 shadow-sm" title="Quitar de la lista">
                    <span class="material-symbols-outlined text-[20px] pointer-events-none">close</span>
                </button>
            </div>
            <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        `;
        rowElement.querySelector('.btn-remove-item').addEventListener('click', () => {
            rowElement.remove();
            validateInputsAndCount();
        });
    };

    // Usar delegación de eventos para la navegación con 'Enter'
    document.body.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;

        const activeElement = document.activeElement;
        if (!activeElement.matches('#cajaSerialInput, .item-serial-input, .manual-code-input')) {
            return;
        }

        event.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('#cajaSerialInput, .item-serial-input, .manual-code-input'));
        const currentIndex = allInputs.indexOf(activeElement);

        const nextInput = allInputs[currentIndex + 1];
        if (nextInput) {
            nextInput.focus();
        } else {
            saveCajaBtn.focus();
        }
    });

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
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = '../login.html'));
});
