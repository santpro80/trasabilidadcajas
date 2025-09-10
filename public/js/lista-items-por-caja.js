import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot,
    registrarHistorial, collection, query, where, getDocs, serverTimestamp
} from './firebase-config.js';

function sanitizeFieldName(name) { return name.replace(/\//g, '_slash_').replace(/\./g, '_dot_').replace(/,/g, '_comma_'); }
function unSanitizeFieldName(name) { return name.replace(/_comma_/g, ',').replace(/_dot_/g, '.').replace(/_slash_/g, '/'); }

let notificationTimeout;
const showNotification = (message, type = 'success') => {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    clearTimeout(notificationTimeout);
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type);
    notificationTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const menuBtn = document.getElementById('menu-btn');
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
    const prestamoModal = document.getElementById('prestamoModal');
    const prestamoInput = document.getElementById('prestamo-input');
    const cancelPrestamoBtn = document.getElementById('cancel-prestamo-btn');
    const confirmPrestamoBtn = document.getElementById('confirm-prestamo-btn');

    let allLoadedItemsData = {};
    let currentSelectedSerialNumber = '';
    let modelName = '';
    let currentEditingItem = { originalName: '', oldSerial: '' };
    let itemToDelete = null;
    let codeToDescMap = new Map();
    let unsubscribeFromItems = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'login.html'; return; }
        if (userDisplayNameElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }
        initializePage();
    });

    const initializePage = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        currentSelectedSerialNumber = urlParams.get('selectedSerialNumber');
        modelName = urlParams.get('modelName');
        if (!currentSelectedSerialNumber || !modelName) { 
            if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = 'Error: Faltan parámetros';
            showState(errorState);
            return; 
        }
        if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = `Items para Caja: ${currentSelectedSerialNumber}`;
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
            console.error("Error en inicialización:", error);
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
            listItem.className = 'list-item';
            const [itemCode, description] = originalItemName.split(';');
            const serialDisplay = (itemValue === 'REEMPLAZAR') ? `<span style="color: #dc3545; font-weight: bold;">${itemValue}</span>` : itemValue;
            listItem.innerHTML = `
                <div class="item-main-details-container">
                    <div class="item-detail-group"><span class="item-label">Código:</span><span class="item-value-text">${itemCode || ''}</span></div>
                    <div class="item-detail-group"><span class="item-label">Descripción:</span><span class="item-value-text">${description || ''}</span></div>
                    <div class="item-detail-group"><span class="item-label">N° de Serie:</span><span class="item-value-text">${serialDisplay}</span></div>
                </div>
                <button class="btn-delete-item" title="Eliminar ítem"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
            listItem.querySelector('.item-main-details-container').addEventListener('click', () => openEditModal(originalItemName, itemValue));
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
        newRow.className = 'list-item dynamic-item-row';
        newRow.innerHTML = `
            <div class="item-main-details-container" style="cursor: default;">
                <input type="text" class="manual-code-input" placeholder="Ingresar código de producto..." style="width: 100%; margin-bottom: 10px; padding: 8px;">
                <div class="item-desc-display" style="font-family: monospace; margin-bottom: 10px; min-height: 1.2em;"></div>
                <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem" style="width: 100%; padding: 8px;">
                <div class="modal-actions" style="justify-content: flex-end;">
                    <button class="btn-modal btn-secondary cancel-add-btn">Cancelar</button>
                    <button class="btn-modal btn-primary save-add-btn">Guardar Ítem</button>
                </div>
            </div>`;
        itemsList.prepend(newRow);
        showState(itemsList);
        const codeInput = newRow.querySelector('.manual-code-input');
        codeInput.focus();
        codeInput.addEventListener('input', () => {
            const desc = codeToDescMap.get(codeInput.value.trim());
            const descDisplay = newRow.querySelector('.item-desc-display');
            descDisplay.textContent = desc ? `Descripción: ${desc}` : 'El código no tiene descripción asignada.';
        });
        newRow.querySelector('.cancel-add-btn').addEventListener('click', () => newRow.remove());
        newRow.querySelector('.save-add-btn').addEventListener('click', () => saveNewItem(newRow));
    };

    const saveNewItem = async (rowElement) => {
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
        if (newSerialNumberInput) newSerialNumberInput.value = (currentSerial === 'REEMPLAZAR') ? '0' : currentSerial;
        if (editSerialModal) editSerialModal.style.display = 'flex';
    };

    const openDeleteModal = (sanitized, original) => {
        itemToDelete = { sanitized, original };
        if (deleteModalText) deleteModalText.textContent = `¿Seguro que deseas eliminar "${original}"?`;
        if (deleteConfirmModal) deleteConfirmModal.style.display = 'flex';
    };

    confirmEditBtn?.addEventListener('click', async () => {
        let newSerial = newSerialNumberInput.value.trim();
        if (newSerial === '0') { newSerial = 'REEMPLAZAR'; }
        if (!newSerial) { showNotification("El número de serie no puede estar vacío.", "error"); return; }
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizeFieldName(currentEditingItem.originalName)]: newSerial });
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

    const generarPDF = (tipo, prestamoNum = null) => {
        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') { showNotification("Error: Faltan librerías para PDF.", "error"); return; }
        const template = document.getElementById('pdf-template');
        if (!template) { showNotification("Error: Falta la plantilla para el PDF.", "error"); return; }
        showNotification('Generando PDF...', 'info');
        const pdfTitle = document.getElementById('pdf-report-title');
        const pdfBoxSerial = document.getElementById('pdf-box-serial');
        const pdfTipo = document.getElementById('pdf-tipo');
        const pdfUsuario = document.getElementById('pdf-usuario');
        const pdfPrestamo = document.getElementById('pdf-prestamo-num');
        const tableBody = document.getElementById('pdf-table-body');

        const userDisplayNameElement = document.getElementById('user-display-name');
        const userName = userDisplayNameElement ? userDisplayNameElement.textContent : 'Desconocido';
        
        if(pdfTitle) pdfTitle.textContent = `REPORTE ${new Date().toLocaleString('es-AR')}`;
        if(pdfBoxSerial) pdfBoxSerial.textContent = `Caja: ${currentSelectedSerialNumber}`;
        if(pdfTipo) pdfTipo.textContent = `Tipo: ${tipo.toUpperCase()}`;
        if(pdfUsuario) pdfUsuario.textContent = `Usuario: ${userName}`;
        if(pdfPrestamo) {
            if (prestamoNum) {
                pdfPrestamo.textContent = `N° de Préstamo: ${prestamoNum}`;
                pdfPrestamo.style.display = 'block';
            } else {
                pdfPrestamo.style.display = 'none';
            }
        }
        if(tableBody) {
            tableBody.innerHTML = '';
            const sortedKeys = Object.keys(allLoadedItemsData).sort();
            sortedKeys.forEach(sanitizedName => {
                const [codigo, desc] = unSanitizeFieldName(sanitizedName).split(';');
                const serie = allLoadedItemsData[sanitizedName];
                tableBody.innerHTML += `<tr><td>${codigo||''}</td><td>${desc||''}</td><td>${serie||''}</td></tr>`;
            });
        }
        html2canvas(template, { scale: 2, useCORS: true }).then(canvas => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, pdfWidth - 20, pdfHeight > 277 ? 277 : pdfHeight);
            pdf.save(`Reporte_Caja_${currentSelectedSerialNumber}.pdf`);
        }).catch(err => { showNotification('Error al generar la imagen para el PDF.', 'error'); });
        if (tipoReporteModal) tipoReporteModal.style.display = 'none';
        if (prestamoModal) prestamoModal.style.display = 'none';
        if (prestamoInput) prestamoInput.value = '';
    };

    if (searchInput) searchInput.addEventListener('input', () => renderFilteredItems(allLoadedItemsData, searchInput.value));
    if (addItemBtn) addItemBtn.addEventListener('click', addNewItemRow);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => { if (tipoReporteModal) tipoReporteModal.style.display = 'flex'; });
    if (btnEntrada) btnEntrada.addEventListener('click', () => { if(tipoReporteModal) tipoReporteModal.style.display = 'none'; generarPDF('Entrada'); });
    if (btnSalida) btnSalida.addEventListener('click', () => { if (tipoReporteModal) tipoReporteModal.style.display = 'none'; if (prestamoModal) prestamoModal.style.display = 'flex'; if (prestamoInput) prestamoInput.focus(); });
    if (confirmPrestamoBtn) confirmPrestamoBtn.addEventListener('click', () => { const num = prestamoInput.value.trim(); if (num) generarPDF('Salida', num); else showNotification("Por favor, ingresa un número de préstamo.", "error"); });
    if (cancelPrestamoBtn) cancelPrestamoBtn.addEventListener('click', () => { if (prestamoModal) prestamoModal.style.display = 'none'; });
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => { if (editSerialModal) editSerialModal.style.display = 'none'; });
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => { if (deleteConfirmModal) deleteConfirmModal.style.display = 'none'; });
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => { if (unsubscribeFromItems) unsubscribeFromItems(); window.location.href = 'login.html'; }));
    if (menuBtn) menuBtn.addEventListener('click', () => { window.location.href = 'menu.html'; });
});
