// public/js/lista-items-por-caja.js

import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, updateDoc, deleteField
} from './firebase-config.js';

function sanitizeFieldName(name) {
    return name.replace(/\//g, '_slash_').replace(/\./g, '_dot_').replace(/,/g, '_comma_');
}

function unSanitizeFieldName(name) {
    return name.replace(/_comma_/g, ',').replace(/_dot_/g, '.').replace(/_slash_/g, '/');
}

let notificationTimeout;
const showNotification = (message, type = 'success') => {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    clearTimeout(notificationTimeout);
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type === 'success' ? 'success' : 'error');
    notificationTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
};

const showModalMessage = (msg, type = 'info') => {
    const modalMessage = document.getElementById('modalMessage');
    if (modalMessage) {
        modalMessage.textContent = msg;
        modalMessage.className = `message-area ${type}`;
        modalMessage.style.display = 'block';
    }
};

const clearModalMessage = () => {
    const modalMessage = document.getElementById('modalMessage');
    if (modalMessage) {
        modalMessage.textContent = '';
        modalMessage.className = 'message-area';
        modalMessage.style.display = 'none';
    }
};

const showModalLoading = (show) => {
    const modalSpinner = document.getElementById('modalSpinner');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const newSerialNumberInput = document.getElementById('newSerialNumberInput');

    if (modalSpinner) modalSpinner.style.display = show ? 'block' : 'none';
    if (confirmEditBtn) confirmEditBtn.disabled = show;
    if (cancelEditBtn) cancelEditBtn.disabled = show;
    if (newSerialNumberInput) newSerialNumberInput.disabled = show;
    if (show) clearModalMessage();
};

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
    const editSerialModal = document.getElementById('editSerialModal');
    const modalItemCodeDescription = document.getElementById('modalItemCodeDescription');
    const newSerialNumberInput = document.getElementById('newSerialNumberInput');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const confirmEditBtn = document.getElementById('confirmEditBtn');
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteModalText = document.getElementById('delete-modal-text');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const deleteModalSpinner = document.getElementById('delete-modal-spinner');
    
    let allLoadedItemsData = {};
    let currentSelectedSerialNumber = '';
    let modelName = '';
    let currentEditingItemOriginalName = null;
    let itemToDelete = null;
    let placaTypes = new Set();
    let placaDiams = new Set();
    let placaOrificios = new Set();
    let schemaMap = new Map();

    onAuthStateChanged(auth, (user) => {
        if (!user) { window.location.href = 'login.html'; return; }
        if (userDisplayNameElement) userDisplayNameElement.textContent = user.displayName || user.email;
        loadInitialData();
    });

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, itemsList].forEach(el => { if(el) el.style.display = 'none'});
        if (stateElement) { stateElement.style.display = 'block'; }
    };

    const loadInitialData = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        currentSelectedSerialNumber = urlParams.get('selectedSerialNumber');
        modelName = urlParams.get('modelName');
        if (!currentSelectedSerialNumber || !modelName) {
            boxSerialNumberDisplay.textContent = 'Error: Faltan parámetros en la URL';
            showState(errorState); return;
        }
        boxSerialNumberDisplay.textContent = `Items para Caja: ${currentSelectedSerialNumber}`;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            const schemaDocRef = doc(db, "esquemas_modelos", modelName);
            const [itemDocSnap, schemaDocSnap] = await Promise.all([getDoc(itemDocRef), getDoc(schemaDocRef)]);
            allLoadedItemsData = itemDocSnap.exists() ? itemDocSnap.data() : {};
            if (schemaDocSnap.exists()) {
                const itemNames = Object.keys(schemaDocSnap.data());
                buildSchemaMap(itemNames);
                parseSchemaForOptions(itemNames);
            }
            renderFilteredItems(allLoadedItemsData, '');
        } catch (error) {
            console.error("Error al cargar datos iniciales:", error);
            showState(errorState);
        }
    };

    const buildSchemaMap = (itemNames) => {
        schemaMap.clear();
        itemNames.forEach(itemName => {
            const [code, description] = itemName.split(';');
            if (code && description) { schemaMap.set(description.trim(), code.trim()); }
        });
    };

    const parseSchemaForOptions = (itemNames) => {
        itemNames.forEach(itemName => {
            const description = itemName.split(';')[1] || '';
            const match = description.match(/PLACA\s(.*?)\sdiam\s(.*?)\sx\s(.*)/i);
            if (match) {
                placaTypes.add(match[1].trim());
                placaDiams.add(match[2].trim());
                placaOrificios.add(match[3].trim());
            }
        });
    };

    const renderFilteredItems = (itemsData, searchTerm = '') => {
        const dynamicRows = Array.from(itemsList.querySelectorAll('.dynamic-item-row'));
        itemsList.innerHTML = '';
        dynamicRows.forEach(row => itemsList.appendChild(row));
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredKeys = Object.keys(itemsData).filter(key => {
            const itemValue = itemsData[key];
            const originalKey = unSanitizeFieldName(key);
            return originalKey.toLowerCase().includes(lowerCaseSearchTerm) || itemValue.toLowerCase().includes(lowerCaseSearchTerm);
        });
        if (filteredKeys.length === 0 && dynamicRows.length === 0) { showState(emptyState); return; }
        filteredKeys.sort().forEach(sanitizedItemFieldName => {
            const itemValue = itemsData[sanitizedItemFieldName];
            const originalItemName = unSanitizeFieldName(sanitizedItemFieldName);
            const listItem = document.createElement('li');
            listItem.className = 'list-item';
            const separatorIndex = originalItemName.indexOf(';');
            const itemCode = separatorIndex !== -1 ? originalItemName.substring(0, separatorIndex) : originalItemName;
            const description = separatorIndex !== -1 ? originalItemName.substring(separatorIndex + 1) : '';
            listItem.innerHTML = `
                <div class="item-main-details-container">
                    <div class="item-detail-group"><span class="item-label">Código:</span><span class="item-value-text">${itemCode}</span></div>
                    <div class="item-detail-group"><span class="item-label">Descripción:</span><span class="item-value-text">${description}</span></div>
                    <div class="item-detail-group"><span class="item-label">N° de Serie:</span><span class="item-value-text">${itemValue}</span></div>
                </div>
                <button class="btn-delete-item" title="Eliminar ítem"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            `;
            listItem.querySelector('.item-main-details-container').addEventListener('click', () => openEditModal(originalItemName, itemValue));
            listItem.querySelector('.btn-delete-item').addEventListener('click', (event) => { event.stopPropagation(); openDeleteModal(sanitizedItemFieldName, originalItemName); });
            itemsList.appendChild(listItem);
        });
        showState(itemsList);
    };

    const addNewItemRow = () => {
        const existingNewRow = document.querySelector('.dynamic-item-row');
        if (existingNewRow) { existingNewRow.querySelector('select').focus(); return; }
        const newRow = document.createElement('li');
        newRow.className = 'list-item dynamic-item-row';
        const sortedTypes = [...placaTypes].sort((a, b) => a.localeCompare(b));
        const sortedDiams = [...placaDiams].sort((a, b) => a.localeCompare(b));
        const sortedOrificios = [...placaOrificios].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        const typeOptions = sortedTypes.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        const diamOptions = sortedDiams.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        const orificioOptions = sortedOrificios.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        newRow.innerHTML = `
            <div class="item-main-details-container" style="cursor: default;">
                <div class="dynamic-item-selectors">
                    <select class="item-part-type"><option value="">Tipo...</option>${typeOptions}</select>
                    <select class="item-part-diam"><option value="">Diámetro...</option>${diamOptions}</select>
                    <select class="item-part-orificio"><option value="">Orificios...</option>${orificioOptions}</select>
                </div>
                <div class="item-code-display" style="display: none; margin-top: 10px; padding: 8px; background-color: #e9ecef; border-radius: 5px; font-family: monospace;"></div>
                <input type="text" class="manual-code-input" placeholder="Ingresa el código nuevo" style="display: none; margin-top: 10px; padding: 8px; width: 100%; box-sizing: border-box; border-radius: 5px; border: 1px solid #ccc;">
                <input type="text" class="item-serial-input" placeholder="N° de Serie del Ítem" style="margin-top: 10px; padding: 8px; width: 100%; box-sizing: border-box; border-radius: 5px; border: 1px solid #ccc;">
                <div class="dynamic-row-actions"><button class="btn-secondary">Cancelar</button><button class="btn-primary">Guardar Ítem</button></div>
            </div>
        `;
        itemsList.prepend(newRow);
        showState(itemsList);
        newRow.querySelectorAll('.dynamic-item-selectors select').forEach(select => {
            select.addEventListener('change', () => handleDropdownChange(newRow));
        });
        newRow.querySelector('.btn-secondary').addEventListener('click', () => newRow.remove());
        newRow.querySelector('.btn-primary').addEventListener('click', () => saveNewItem(newRow));
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
                codeDisplay.innerHTML = `<span style="font-weight: bold;">Código Encontrado:</span> ${foundCode}`;
                codeDisplay.style.display = 'block';
                manualInput.style.display = 'none';
            } else {
                codeDisplay.style.display = 'none';
                manualInput.style.display = 'block';
            }
        }
    };
    
    const saveNewItem = async (rowElement) => {
        const type = rowElement.querySelector('.item-part-type').value;
        const diam = rowElement.querySelector('.item-part-diam').value;
        const orificio = rowElement.querySelector('.item-part-orificio').value;
        const newSerial = rowElement.querySelector('.item-serial-input').value.trim();
        if (!type || !diam || !orificio || !newSerial) {
            showNotification('Por favor, completa todos los campos.', 'error'); return;
        }
        const description = `PLACA ${type} diam ${diam} x ${orificio}`;
        let itemCode = schemaMap.get(description);
        if (!itemCode) {
            itemCode = rowElement.querySelector('.manual-code-input').value.trim();
            if (!itemCode) {
                showNotification('La descripción es nueva. Por favor, ingresa un código.', 'error'); return;
            }
        }
        const itemName = `${itemCode};${description}`;
        const sanitizedFieldName = sanitizeFieldName(itemName);
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizedFieldName]: newSerial });
            allLoadedItemsData[sanitizedFieldName] = newSerial;
            renderFilteredItems(allLoadedItemsData, '');
            showNotification('Ítem agregado con éxito.', 'success');
        } catch (error) {
            console.error("Error al guardar el nuevo ítem:", error);
            showNotification('Error al guardar: ' + error.message, 'error');
        }
    };
    
    const openEditModal = (originalName, currentSerial) => {
        currentEditingItemOriginalName = originalName;
        modalItemCodeDescription.textContent = originalName;
        newSerialNumberInput.value = currentSerial;
        editSerialModal.style.display = 'flex';
        clearModalMessage();
    };
    const closeEditModal = () => {
        editSerialModal.style.display = 'none';
        currentEditingItemOriginalName = null;
    };
    const confirmEdit = async () => {
        showModalLoading(true);
        let newSerial = newSerialNumberInput.value.trim();
        if (newSerial === '0') { newSerial = 'REEMPLAZAR'; }
        if (!newSerial) {
            showModalMessage("El número de serie no puede estar vacío.", 'error');
            showModalLoading(false); return;
        }
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            const fieldToUpdate = sanitizeFieldName(currentEditingItemOriginalName);
            await updateDoc(itemDocRef, { [fieldToUpdate]: newSerial });
            allLoadedItemsData[fieldToUpdate] = newSerial;
            renderFilteredItems(allLoadedItemsData, searchInput.value);
            showModalMessage('Movimientos realizados con éxito.', 'success');
            setTimeout(() => { closeEditModal(); showModalLoading(false); }, 1500);
        } catch (error) {
            console.error("Error al actualizar el N° de serie:", error);
            showModalMessage(`Error al guardar los cambios: ${error.message}`, 'error');
            showModalLoading(false);
        }
    };

    const openDeleteModal = (sanitizedFieldName, originalItemName) => {
        itemToDelete = { sanitized: sanitizedFieldName, original: originalItemName };
        deleteModalText.textContent = `¿Estás seguro de que deseas eliminar "${originalItemName}"?`;
        deleteConfirmModal.style.display = 'flex';
    };
    const closeDeleteModal = () => {
        deleteConfirmModal.style.display = 'none';
        itemToDelete = null;
    };
    const executeDelete = async () => {
        if (!itemToDelete) return;
        deleteModalSpinner.style.display = 'block';
        confirmDeleteBtn.disabled = true;
        cancelDeleteBtn.disabled = true;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [itemToDelete.sanitized]: deleteField() });
            delete allLoadedItemsData[itemToDelete.sanitized];
            renderFilteredItems(allLoadedItemsData, searchInput.value);
            closeDeleteModal();
        } catch (error) {
            console.error("Error al eliminar el ítem:", error);
            deleteModalText.textContent = `Error: ${error.message}`;
        } finally {
            deleteModalSpinner.style.display = 'none';
            confirmDeleteBtn.disabled = false;
            cancelDeleteBtn.disabled = false;
        }
    };

    // --- Listeners de Eventos ---
    addItemBtn.addEventListener('click', addNewItemRow);
    searchInput.addEventListener('input', () => renderFilteredItems(allLoadedItemsData, searchInput.value));
    cancelEditBtn.addEventListener('click', closeEditModal);
    confirmEditBtn.addEventListener('click', confirmEdit);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    confirmDeleteBtn.addEventListener('click', executeDelete);
    backBtn.addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const modelName = urlParams.get('modelName');
        const zonaName = urlParams.get('zonaName');
        if (modelName && zonaName) {
            window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
        } else { window.history.back(); }
    });
    logoutBtn.addEventListener('click', () => { signOut(auth).then(() => window.location.href = 'login.html'); });
});