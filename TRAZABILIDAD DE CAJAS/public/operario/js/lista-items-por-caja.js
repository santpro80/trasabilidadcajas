import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot,
    registrarHistorial, appCheck,
    registrarMovimientoCaja, sanitizeFieldName, unSanitizeFieldName, registrarConsumoItem,
    collection, query, where, getDocs
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const boxSerialNumberDisplay = document.getElementById('box-serial-number-display');
    const itemsList = document.getElementById('itemsList');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('searchInput');
    const addItemBtn = document.getElementById('add-item-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const editSerialModal = document.getElementById('editSerialModal');
    const modalItemCodeDescription = document.getElementById('modalItemCodeDescription');
    const newSerialNumberInput = document.getElementById('newSerialNumberInput');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteModalText = document.getElementById('delete-modal-text');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const tipoReporteModal = document.getElementById('tipoReporteModal');
    const btnEntrada = document.getElementById('btn-entrada');
    const btnSalida = document.getElementById('btn-salida');
    const cancelReportBtn = document.getElementById('cancel-report-btn');
    const prestamoModal = document.getElementById('prestamoModal');
    const prestamoInput = document.getElementById('prestamo-input');
    const cancelPrestamoBtn = document.getElementById('cancel-prestamo-btn');
    const confirmPrestamoBtn = document.getElementById('confirm-prestamo-btn');
    const observationModal = document.getElementById('observationModal');
    const noObservationBtn = document.getElementById('no-observation-btn');
    const yesObservationBtn = document.getElementById('yes-observation-btn');

    let allLoadedItemsData = {};
    let currentSelectedSerialNumber = '';
    let modelName = '';
    let zonaName = '';
    let currentEditingItem = { originalName: '', oldSerial: '' };
    let itemToDelete = null;
    let codeToDescMap = new Map();
    let unsubscribeFromItems = null;
    let currentSelectedItem = null; 
    let reportType = ''; 
    let currentUserSector = '';
    let notificationTimeout;

    const formatCode = (rawCode) => {
        if (!rawCode) return '';
        let code = String(rawCode).trim();
        if (/^\d{7}$/.test(code)) {
            return `${code.substring(0, 2)}-${code.substring(2, 5)}-${code.substring(5, 7)}`;
        }
        return code;
    };

    const showNotification = (message, type = 'success') => {
        const toast = document.getElementById('notification-toast');
        const icon = document.getElementById('toast-icon');
        const msg = document.getElementById('toast-message');
        if (!toast || !icon || !msg) return;

        const toastContent = toast.querySelector('.toast-content');
        if (!toastContent) return;

        clearTimeout(notificationTimeout);
        msg.textContent = message;
        icon.textContent = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
        
        toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300';
        
        if (type === 'success') {
            toastContent.className += ' bg-emerald-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-emerald-500/30 dark:text-emerald-400';
        } else if (type === 'error') {
            toastContent.className += ' bg-rose-500 text-white dark:bg-slate-900/90 dark:backdrop-blur-md dark:border dark:border-rose-500/30 dark:text-rose-400';
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

    onAuthStateChanged(auth, async (user) => {
        if (!user) { 
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = '../login.html'; 
            return; 
        }
        if (userDisplayNameElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userDisplayNameElement.textContent = userData.name;
                currentUserSector = userData.sector || '';
            } else {
                userDisplayNameElement.textContent = user.email;
            }
        }
        initializePage();
    });

    const initializePage = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        currentSelectedSerialNumber = urlParams.get('selectedSerialNumber');
        modelName = urlParams.get('modelName');
        zonaName = urlParams.get('zonaName') || '';
        
        if (!currentSelectedSerialNumber || !modelName) { 
            showState(errorState);
            return; 
        }
        
        if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = currentSelectedSerialNumber;
        
        try {
            const schemaDocRef = doc(db, "esquemas_modelos", modelName);
            const schemaDocSnap = await getDoc(schemaDocRef);
            if (schemaDocSnap.exists()) {
                buildSchemaMap(Object.keys(schemaDocSnap.data()));
            }

            if (unsubscribeFromItems) unsubscribeFromItems();
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            
            unsubscribeFromItems = onSnapshot(itemDocRef, (itemDocSnap) => {
                allLoadedItemsData = itemDocSnap.exists() ? itemDocSnap.data() : {};
                renderFilteredItems(allLoadedItemsData, searchInput ? searchInput.value : '');
            });
        } catch (error) {
            console.error(error);
            showState(errorState);
        }
    };

    const buildSchemaMap = (itemNames) => {
        codeToDescMap.clear();
        itemNames.forEach(itemName => {
            const [code, description] = itemName.split(';');
            if (code && description) {
                codeToDescMap.set(code.trim(), description.trim());
            }
        });
    };

    const showState = (stateElement) => {
        const allStates = [loadingState, errorState, emptyState, itemsList];
        allStates.forEach(el => { if (el) el.style.display = 'none' });
        if (stateElement) {
            stateElement.style.display = (stateElement === itemsList || stateElement === emptyState) ? 'flex' : 'block';
        }
    };

    const renderFilteredItems = (itemsData, searchTerm) => {
        if (!itemsList) return;
        const dynamicRows = Array.from(itemsList.querySelectorAll('.dynamic-item-row'));
        itemsList.innerHTML = '';
        dynamicRows.forEach(row => itemsList.appendChild(row));
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredKeys = Object.keys(itemsData).filter(key => {
            const itemValue = itemsData[key];
            const originalKey = unSanitizeFieldName(key);
            return originalKey.toLowerCase().includes(lowerCaseSearchTerm) || String(itemValue).toLowerCase().includes(lowerCaseSearchTerm);
        });
        showState(itemsList);
        if (filteredKeys.length === 0 && dynamicRows.length === 0) {
            showState(emptyState);
            return;
        }
        filteredKeys.sort().forEach(sanitizedName => {
            const itemValue = itemsData[sanitizedName];
            const originalItemName = unSanitizeFieldName(sanitizedName);
            const listItem = document.createElement('li');
            listItem.className = 'bg-white dark:bg-slate-800/40 rounded-2xl p-4 lg:p-5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-villalba-blue/40 hover:-translate-y-1 dark:hover:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 group transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl relative overflow-hidden';
            let [itemCode, description] = originalItemName.split(';');
            itemCode = formatCode(itemCode);
            const isReemplazar = (String(itemValue).toUpperCase() === 'REEMPLAZAR');
            const serialDisplay = isReemplazar ? `<span class="text-rose-500 font-black">${itemValue}</span>` : `<span class="font-mono font-black">${itemValue}</span>`;
            
            const badgeClass = isReemplazar 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400" 
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400";
            
            listItem.innerHTML = `
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-300 shadow-inner relative transition-transform group-hover:scale-105 cursor-pointer">
                            <span class="material-symbols-outlined text-[28px] md:text-[32px] text-slate-300 dark:text-slate-400 absolute z-0 pointer-events-none">inventory_2</span>
                            <img src="../assets/items/${itemCode}.webp" alt="${itemCode}" class="item-img-clickable w-[95%] h-[95%] object-contain relative z-10 transition-transform pointer-events-auto" onerror="this.style.opacity='0'" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                        </div>
                        <span class="text-[13px] md:text-[14px] whitespace-nowrap md:w-auto font-black tracking-widest text-slate-500 uppercase group-hover:text-villalba-blue transition-colors">${itemCode || 'S/C'}</span>
                    </div>
                    
                    <h3 class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight uppercase break-words" title="${description || 'Sin Descripción'}">${description || 'Sin Descripción'}</h3>
                    
                    <div class="flex items-center md:justify-end pr-2">
                        <span class="text-[13px] font-black px-4 py-2 rounded-xl ${badgeClass} tracking-widest whitespace-nowrap shadow-sm">SN: ${serialDisplay}</span>
                    </div>
                </div>
                
                <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end">
                    <button class="btn-delete-item w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors border border-rose-100 dark:border-rose-500/20 shadow-sm" title="Eliminar ítem">
                        <span class="material-symbols-outlined text-[20px] pointer-events-none">delete</span>
                    </button>
                </div>`;
            
            listItem.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-item')) return;
                
                if (e.target.closest('.item-img-clickable')) {
                    const img = e.target.closest('.item-img-clickable');
                    const imageModal = document.getElementById('imageModal');
                    const enlargedImage = document.getElementById('enlargedImage');
                    if (imageModal && enlargedImage && img.style.opacity !== '0') {
                        enlargedImage.src = img.src;
                        imageModal.style.display = 'flex';
                    }
                    return;
                }

                if (currentSelectedItem) {
                    currentSelectedItem.classList.remove('selected');
                }
                currentSelectedItem = listItem;
                listItem.classList.add('selected');
                openEditModal(originalItemName, itemValue);
            });

            listItem.querySelector('.btn-delete-item').addEventListener('click', (e) => {
                e.stopPropagation(); 
                openDeleteModal(sanitizedName, originalItemName);
            });
            itemsList.appendChild(listItem);
        });
    };
    
    const addNewItemRow = () => {
        if (!itemsList || document.querySelector('.dynamic-item-row')) return;
        const newRow = document.createElement('li');
        newRow.className = 'bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 lg:p-5 border-2 border-dashed border-villalba-blue/40 dark:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 transition-all duration-300 relative overflow-hidden dynamic-item-row mb-4';
        newRow.innerHTML = `
            <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[140px_1fr_150px] gap-4 items-center relative z-10">
                <div class="flex items-center">
                    <input type="text" class="manual-code-input w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-villalba-blue/50 focus:border-villalba-blue transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" placeholder="Código...">
                </div>
                
                <h3 class="item-desc-display font-medium text-slate-600 dark:text-slate-400 text-sm leading-tight uppercase break-words">Esperando código...</h3>
                
                <div class="flex items-center pr-2">
                    <input type="text" class="item-serial-input w-full bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400" placeholder="N° Serie">
                </div>
            </div>
            
            <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end gap-2 relative z-10">
                <button type="button" class="btn-remove-item cancel-add-btn px-4 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold text-xs uppercase tracking-widest" title="Cancelar">
                    Cancelar
                </button>
                <button type="button" class="btn-save-item save-add-btn px-4 h-10 rounded-xl bg-villalba-blue text-white flex items-center justify-center hover:bg-villalba-blue/90 transition-colors shadow-sm font-bold text-xs uppercase tracking-widest" title="Confirmar">
                    Guardar
                </button>
            </div>
        `;
        itemsList.prepend(newRow);
        showState(itemsList);
        const codeInput = newRow.querySelector('.manual-code-input');
        codeInput.focus();
        codeInput.addEventListener('input', () => {
            const rawVal = codeInput.value.trim();
            const valWithoutDash = rawVal.replace(/-/g, '');
            const desc = codeToDescMap.get(rawVal) || codeToDescMap.get(valWithoutDash);
            const descDisplay = newRow.querySelector('.item-desc-display');
            descDisplay.textContent = desc ? `Descripción: ${desc}` : 'El código no tiene descripción asignada.';
        });
        const itemSerialInput = newRow.querySelector('.item-serial-input');
        itemSerialInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 6);
            if (e.target.value.length >= 2) {
                e.target.setAttribute('inputmode', 'numeric');
            } else {
                e.target.setAttribute('inputmode', 'text');
            }
        });
        newRow.querySelector('.cancel-add-btn').addEventListener('click', () => newRow.remove());
        newRow.querySelector('.save-add-btn').addEventListener('click', () => saveNewItem(newRow));
    };

    const saveNewItem = async (rowElement) => {
        const codeInput = rowElement.querySelector('.manual-code-input');
        const serialInput = rowElement.querySelector('.item-serial-input');
        let itemCode = codeInput.value.trim();
        const itemSerial = serialInput.value.trim();
        const valWithoutDash = itemCode.replace(/-/g, '');
        let description = codeToDescMap.get(itemCode) || codeToDescMap.get(valWithoutDash);
        
        if (!codeToDescMap.has(itemCode) && codeToDescMap.has(valWithoutDash)) {
            itemCode = valWithoutDash;
        }

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
        const sanitizedFieldName = sanitizeFieldName(itemName);

        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizedFieldName]: itemSerial }, { merge: true });
            
            registrarHistorial('AGREGAR ÍTEM', {
                cajaSerie: currentSelectedSerialNumber,
                itemDescripcion: itemName,
                valorNuevo: itemSerial,
                mensaje: `Se agregó el ítem "${itemName}" con N° de Serie "${itemSerial}" a la caja "${currentSelectedSerialNumber}".`
            });

            showNotification("Ítem agregado con éxito.", "success");
            rowElement.remove();
        } catch (error) {
            showNotification("Error al guardar el nuevo ítem.", "error");
            console.error(error);
        }
    };

    const openEditModal = (originalName, currentSerial) => {
        currentEditingItem = { originalName, oldSerial: currentSerial };
        if (modalItemCodeDescription) modalItemCodeDescription.textContent = originalName;
        if (newSerialNumberInput) {
            newSerialNumberInput.value = (currentSerial === 'REEMPLAZAR') ? '0' : currentSerial;
            newSerialNumberInput.setAttribute('inputmode', newSerialNumberInput.value.length >= 2 ? 'numeric' : 'text');
        }
        if (editSerialModal) editSerialModal.style.display = 'flex';
    };

    const openDeleteModal = (sanitized, original) => {
        itemToDelete = { sanitized, original };
        if (deleteModalText) deleteModalText.textContent = `¿Seguro que deseas eliminar "${original}"?`;
        if (deleteConfirmModal) deleteConfirmModal.style.display = 'flex';
    };

    if (newSerialNumberInput) {
        newSerialNumberInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 6);
            if (e.target.value.length >= 2) {
                e.target.setAttribute('inputmode', 'numeric');
            } else {
                e.target.setAttribute('inputmode', 'text');
            }
        });
    }

    confirmEditBtn?.addEventListener('click', async () => {
        let newSerial = newSerialNumberInput.value.trim();
        if (newSerial === '0') { newSerial = 'REEMPLAZAR'; }
        if (!newSerial) { showNotification("El número de serie no puede estar vacío.", "error"); return; }
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizeFieldName(currentEditingItem.originalName)]: newSerial });

            if (newSerial === 'REEMPLAZAR') {
                await registrarConsumoItem(modelName, currentEditingItem.originalName);
            }

            const detallesParaHistorial = {
                cajaSerie: currentSelectedSerialNumber, itemDescripcion: currentEditingItem.originalName,
                valorAnterior: currentEditingItem.oldSerial, valorNuevo: newSerial,
                mensaje: `Cambió N° de Serie de "${currentEditingItem.oldSerial}" a "${newSerial}" para el ítem "${currentEditingItem.originalName}" en caja "${currentSelectedSerialNumber}".`
            };
            registrarHistorial('MODIFICACIÓN DE ÍTEM', detallesParaHistorial);
            showNotification('Ítem actualizado con éxito.', 'success');
        } catch (error) {
            showNotification('Error al actualizar.', 'error');
            console.error("Error al editar ítem:", error);
        } finally {
            if (editSerialModal) editSerialModal.style.display = 'none';
        }
    });

    confirmDeleteBtn?.addEventListener('click', async () => {
        if (!itemToDelete) return;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [itemToDelete.sanitized]: deleteField() });
            const detallesParaHistorial = {
                cajaSerie: currentSelectedSerialNumber, itemDescripcion: itemToDelete.original,
                mensaje: `Se eliminó el ítem "${itemToDelete.original}" de la caja "${currentSelectedSerialNumber}".`
            };
            registrarHistorial('ELIMINACIÓN DE ÍTEM', detallesParaHistorial);
            showNotification('Ítem eliminado con éxito.', 'success');
        } catch (error) {
            showNotification('Error al eliminar el ítem.', 'error');
            console.error("Error al eliminar ítem:", error);
        } finally {
            if (deleteConfirmModal) deleteConfirmModal.style.display = 'none';
        }
    });

    const generarPDF = async (tipo, prestamoNum = null) => {
        if (!currentSelectedSerialNumber) {
            showNotification("Error: No se ha seleccionado un número de serie de caja.", "error");
            return;
        }
        if (typeof window.jspdf === 'undefined') { 
            showNotification("Error: Faltan librerías para PDF (jsPDF).", "error"); 
            return; 
        }

        showNotification('Generando PDF...', 'info');

        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const userName = userDisplayNameElement ? userDisplayNameElement.textContent : 'Operario';

            pdf.setFontSize(18);
            pdf.text(`Reporte de ${tipo}`, 15, 20);

            pdf.setFontSize(11);
            pdf.text(`Caja (Modelo): ${modelName}`, 15, 30);
            pdf.text(`N° Serie Caja: ${currentSelectedSerialNumber}`, 15, 35);
            pdf.text(`Usuario: ${userName}`, 15, 40);
            if (tipo === 'Salida' && prestamoNum) {
                pdf.text(`N° de Préstamo: ${prestamoNum}`, 15, 45);
            }
            pdf.text(`Fecha: ${new Date().toLocaleString('es-AR', { hour12: false })}`, 15, 50);

            const head = [['Código', 'Descripción', 'N° Serie']];
            const body = Object.keys(allLoadedItemsData).sort().map(sanitizedName => {
                let [codigo, desc] = unSanitizeFieldName(sanitizedName).split(';');
                codigo = formatCode(codigo);
                const serie = allLoadedItemsData[sanitizedName] || '';
                return [codigo || '', desc || '', serie];
            });

            pdf.autoTable({
                head: head,
                body: body,
                startY: 60,
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] },
            });

            let fileName;
            if (tipo === 'Salida') {
                const sectorPrefix = currentUserSector ? `${currentUserSector} - ` : '';
                fileName = `${sectorPrefix}${prestamoNum} - ${modelName} ${currentSelectedSerialNumber}.pdf`;
            } else {
                try {
                    const q = query(
                        collection(db, "movimientos_cajas"),
                        where("cajaSerie", "==", currentSelectedSerialNumber),
                        where("tipo", "==", "Entrada")
                    );
                    const snapshot = await getDocs(q);
                    const count = snapshot.size + 1;
                    fileName = count > 1 
                        ? `${modelName} ${currentSelectedSerialNumber} (${count}).pdf`
                        : `${modelName} ${currentSelectedSerialNumber}.pdf`;
                } catch (error) {
                    fileName = `${modelName} ${currentSelectedSerialNumber}.pdf`;
                }
            }
            const pdfBlob = pdf.output('blob');

            const oneDriveFolderPath = `01-CAJAS-SEGUIMIENTO/04-registro-de-${tipo.toLowerCase()}-de-cajas`;
            
            await uploadToOneDrive(fileName, pdfBlob, oneDriveFolderPath);
            
            await registrarMovimientoCaja(tipo, currentSelectedSerialNumber, modelName, prestamoNum);
            
            showNotification("¡Reporte generado y subido correctamente!", "success");
            
            setTimeout(() => {
                window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
            }, 1500);

        } catch (error) {
            console.error(error);
            showNotification("Error al generar o subir el reporte.", "error");
        } finally {
            if (tipoReporteModal) tipoReporteModal.style.display = 'none';
            if (prestamoModal) prestamoModal.style.display = 'none';
        }
    };

    if (searchInput) searchInput.addEventListener('input', () => renderFilteredItems(allLoadedItemsData, searchInput.value));
    if (addItemBtn) addItemBtn.addEventListener('click', addNewItemRow);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => { if (tipoReporteModal) tipoReporteModal.style.display = 'flex'; });
    
    if (btnEntrada) btnEntrada.addEventListener('click', () => {
        reportType = 'Entrada';
        if (tipoReporteModal) tipoReporteModal.style.display = 'none';
        if (observationModal) observationModal.style.display = 'flex';
    });

    if (btnSalida) btnSalida.addEventListener('click', () => {
        reportType = 'Salida';
        if (tipoReporteModal) tipoReporteModal.style.display = 'none';
        if (observationModal) observationModal.style.display = 'flex';
    });

    if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => { tipoReporteModal.style.display = 'none'; });

    if (noObservationBtn) noObservationBtn.addEventListener('click', () => {
        if (observationModal) observationModal.style.display = 'none';
        if (reportType === 'Entrada') {
            generarPDF('Entrada');
        } else if (reportType === 'Salida') {
            if (prestamoModal) prestamoModal.style.display = 'flex';
            if (prestamoInput) prestamoInput.focus();
        }
    });

    if (yesObservationBtn) yesObservationBtn.addEventListener('click', () => {
        if (observationModal) observationModal.style.display = 'none';
        const url = `reportar-problema.html?serial=${encodeURIComponent(currentSelectedSerialNumber)}&modelo=${encodeURIComponent(modelName)}`;
        window.location.href = url;
    });

    if (prestamoInput) {
        prestamoInput.setAttribute('inputmode', 'numeric');
        prestamoInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }

    if (confirmPrestamoBtn) confirmPrestamoBtn.addEventListener('click', () => { const num = prestamoInput.value.trim(); if (num) generarPDF('Salida', num); else showNotification("Por favor, ingresa un número de préstamo.", "error"); });
    if (cancelPrestamoBtn) cancelPrestamoBtn.addEventListener('click', () => { if (prestamoModal) prestamoModal.style.display = 'none'; });
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => editSerialModal.style.display = 'none');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = 'none');

    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = document.getElementById('closeImageModal');
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', () => imageModal.style.display = 'none');
    if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) imageModal.style.display = 'none'; });
    
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => { if (unsubscribeFromItems) unsubscribeFromItems(); window.location.href = '../login.html'; }));
});
