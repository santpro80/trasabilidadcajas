import {
    db, auth, onAuthStateChanged, signOut,
    doc, getDoc, setDoc, updateDoc, deleteField, onSnapshot,
    registrarHistorial,
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

    let allLoadedItemsData = {};
    let currentSelectedSerialNumber = '';
    let modelName = '';
    let zonaName = '';
    let currentEditingItem = { originalName: '', oldSerial: '' };
    let itemToDelete = null;
    let codeToDescMap = new Map();
    let unsubscribeFromItems = null;
    let reportType = ''; 
    let notificationTimeout;

    const showNotification = (message, type = 'success') => {
        const toast = document.getElementById('notification-toast');
        const icon = document.getElementById('toast-icon');
        const msg = document.getElementById('toast-message');
        if (!toast || !icon || !msg) return;

        const toastContent = toast.querySelector('.toast-content');
        clearTimeout(notificationTimeout);
        msg.textContent = message;
        icon.textContent = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');
        
        if (type === 'success') {
            toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300 bg-emerald-500 text-white';
        } else if (type === 'error') {
            toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300 bg-rose-500 text-white';
        } else {
            toastContent.className = 'toast-content flex items-center gap-3 p-4 rounded-2xl shadow-2xl transition-all duration-300 bg-slate-800 text-white';
        }

        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';

        notificationTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        }, 3000);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = '../login.html'; return; }
        if (userDisplayNameElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                userDisplayNameElement.textContent = userDoc.data().name || user.email;
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
        
        if (boxSerialNumberDisplay) boxSerialNumberDisplay.textContent = currentSelectedSerialNumber.toUpperCase();
        
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
                codeToDescMap.set(code.trim().toUpperCase(), description.trim());
            }
        });
    };

    const showState = (stateElement) => {
        [loadingState, errorState, emptyState, itemsList].forEach(el => { if (el) el.classList.add('hidden'); });
        if (stateElement) {
            stateElement.classList.remove('hidden');
            if (stateElement === itemsList) stateElement.classList.add('flex');
        }
    };

    const renderFilteredItems = (itemsData, searchTerm) => {
        if (!itemsList) return;
        const dynamicRows = Array.from(itemsList.querySelectorAll('.dynamic-item-row'));
        itemsList.innerHTML = '';
        dynamicRows.forEach(row => itemsList.appendChild(row));
        
        const lowerTerm = searchTerm.toLowerCase();
        const filteredKeys = Object.keys(itemsData).filter(key => {
            const originalKey = unSanitizeFieldName(key);
            const val = itemsData[key];
            return originalKey.toLowerCase().includes(lowerTerm) || String(val).toLowerCase().includes(lowerTerm);
        });

        if (filteredKeys.length === 0 && dynamicRows.length === 0) {
            showState(emptyState);
            return;
        }

        filteredKeys.sort().forEach(sanitizedName => {
            const itemValue = itemsData[sanitizedName];
            const originalItemName = unSanitizeFieldName(sanitizedName);
            const [itemCode, description] = originalItemName.includes(';') ? originalItemName.split(';') : [originalItemName, "Sin descripción"];
            
            const listItem = document.createElement('li');
            listItem.className = 'bg-white dark:bg-slate-800/40 rounded-2xl p-4 lg:p-5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-villalba-blue/40 hover:-translate-y-1 dark:hover:border-villalba-blue/50 flex flex-col md:flex-row items-start md:items-center gap-4 group transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl relative overflow-hidden';
            
            const isReemplazar = (String(itemValue).toUpperCase() === 'REEMPLAZAR');
            const badgeClass = isReemplazar 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-400" 
                : "bg-villalba-blue/10 text-villalba-blue dark:bg-villalba-blue/20 dark:text-villalba-blue/90";

            listItem.innerHTML = `
                <div class="flex-1 w-full grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center relative z-10">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-300 shadow-inner relative transition-transform group-hover:scale-105 cursor-pointer">
                            <span class="material-symbols-outlined text-[24px] text-slate-300 dark:text-slate-400 absolute z-0 pointer-events-none">inventory_2</span>
                            <img src="../assets/items/${itemCode}.webp" alt="${itemCode}" class="item-img-clickable w-[90%] h-[90%] object-contain relative z-10 transition-transform pointer-events-auto" onerror="this.style.opacity='0'" onload="this.style.opacity='1'; this.previousElementSibling.style.display='none'">
                        </div>
                        <span class="text-[13px] whitespace-nowrap md:w-auto font-black tracking-widest text-slate-500 uppercase group-hover:text-villalba-blue transition-colors">${itemCode || "S/M"}</span>
                    </div>
                    <h3 class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight uppercase break-words" title="${description}">${description}</h3>
                    <div class="flex items-center md:justify-end pr-2">
                         <span class="text-[13px] font-black px-4 py-2 rounded-xl ${badgeClass} tracking-widest whitespace-nowrap shadow-sm">SN: <span class="font-mono">${itemValue}</span></span>
                    </div>
                </div>
                <div class="flex-shrink-0 ml-auto w-full md:w-auto flex justify-end relative z-20">
                    <button class="btn-delete-item w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors border border-rose-100 dark:border-rose-500/20 shadow-sm" title="Eliminar ítem">
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
                <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            `;
            
            listItem.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-item')) return;
                
                // Abrir modal de imagen si se hace click en la imagen
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

                openEditModal(originalItemName, itemValue);
            });

            listItem.querySelector('.btn-delete-item').addEventListener('click', (e) => {
                e.stopPropagation(); 
                openDeleteModal(sanitizedName, originalItemName);
            });

            itemsList.appendChild(listItem);
        });
        showState(itemsList);
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
                <button type="button" class="cancel-add-btn px-4 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors shadow-sm font-bold text-xs uppercase tracking-widest">Cancelar</button>
                <button type="button" class="save-add-btn px-4 h-10 rounded-xl bg-villalba-blue text-white flex items-center justify-center hover:bg-villalba-blue/90 transition-colors shadow-sm font-bold text-xs uppercase tracking-widest">Guardar</button>
            </div>
        `;
        itemsList.prepend(newRow);
        showState(itemsList);
        const codeInput = newRow.querySelector('.manual-code-input');
        codeInput.focus();
        codeInput.addEventListener('input', () => {
            const desc = codeToDescMap.get(codeInput.value.trim().toUpperCase());
            newRow.querySelector('.item-desc-display').textContent = desc ? `Descripción: ${desc}` : 'Código sin descripción asignada.';
        });
        
        const serialInput = newRow.querySelector('.item-serial-input');
        serialInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().slice(0, 6);
            e.target.setAttribute('inputmode', e.target.value.length >= 2 ? 'numeric' : 'text');
        });

        newRow.querySelector('.cancel-add-btn').addEventListener('click', () => newRow.remove());
        newRow.querySelector('.save-add-btn').addEventListener('click', () => saveNewItem(newRow));
    };

    const saveNewItem = async (rowElement) => {
        const codeInput = rowElement.querySelector('.manual-code-input');
        const serialInput = rowElement.querySelector('.item-serial-input');
        const itemCode = codeInput.value.trim().toUpperCase();
        const itemSerial = serialInput.value.trim().toUpperCase();
        let description = codeToDescMap.get(itemCode);

        if (!itemCode || !itemSerial) {
            showNotification("Código y N° de Serie requeridos.", "error");
            return;
        }

        if (!description) {
            description = prompt("Código nuevo. Ingresa descripción:");
            if (!description) { showNotification("Descripción requerida.", "error"); return; }
        }

        const itemName = `${itemCode};${description}`;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizeFieldName(itemName)]: itemSerial }, { merge: true });
            registrarHistorial('AGREGAR ÍTEM', { cajaSerie: currentSelectedSerialNumber, itemDescripcion: itemName, valorNuevo: itemSerial, mensaje: `Ítem "${itemName}" agregado a caja "${currentSelectedSerialNumber}".` });
            showNotification("Ítem agregado con éxito.", "success");
            rowElement.remove();
        } catch (error) {
            showNotification("Error al guardar.", "error");
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

    const generarPDF = async (tipo, prestamoNum = null) => {
        if (!currentSelectedSerialNumber) return;
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const userName = userDisplayNameElement ? userDisplayNameElement.textContent : 'Operario';

        showNotification('Generando PDF...', 'info');

        try {
            pdf.setFontSize(18);
            pdf.text(`Reporte de ${tipo}`, 15, 20);
            pdf.setFontSize(11);
            pdf.text(`Caja (Modelo): ${modelName}`, 15, 30);
            pdf.text(`N° Serie Caja: ${currentSelectedSerialNumber}`, 15, 35);
            pdf.text(`Usuario: ${userName}`, 15, 40);
            if (tipo === 'Salida' && prestamoNum) pdf.text(`N° de Préstamo: ${prestamoNum}`, 15, 45);
            pdf.text(`Fecha: ${new Date().toLocaleString('es-AR', { hour12: false })}`, 15, 50);

            const head = [['Código', 'Descripción', 'N° Serie']];
            const body = Object.keys(allLoadedItemsData).sort().map(sanitizedName => {
                const [codigo, desc] = unSanitizeFieldName(sanitizedName).split(';');
                return [codigo || '', desc || '', allLoadedItemsData[sanitizedName]];
            });

            pdf.autoTable({ head, body, startY: 60, theme: 'grid', styles: { fontSize: 9 } });

            const fileName = `Reporte_${tipo}_${currentSelectedSerialNumber}_${new Date().getTime()}.pdf`;
            const pdfBlob = pdf.output('blob');
            
            if (window.uploadReportToOneDrive) {
                await window.uploadReportToOneDrive(pdfBlob, fileName, currentSelectedSerialNumber);
            }

            // pdf.save(fileName); // Eliminado a pedido: no se guarda localmente
            await registrarMovimientoCaja(tipo, currentSelectedSerialNumber, modelName, prestamoNum);
            
            showNotification('Reporte enviado a la nube exitosamente.', 'success');
            
            // Redirigir a la página anterior después de 1.5 segundos
            setTimeout(() => {
                window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
            }, 1500);
        } catch (error) {
            showNotification('Error al procesar reporte.', 'error');
            console.error(error);
        }
    };

    // Event Listeners
    if (addItemBtn) addItemBtn.addEventListener('click', addNewItemRow);
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => { tipoReporteModal.style.display = 'flex'; });
    
    if (btnEntrada) btnEntrada.addEventListener('click', () => { 
        reportType = 'Entrada'; 
        tipoReporteModal.style.display = 'none'; 
        generarPDF('Entrada'); 
    });

    if (btnSalida) btnSalida.addEventListener('click', () => { 
        reportType = 'Salida'; 
        tipoReporteModal.style.display = 'none'; 
        prestamoModal.style.display = 'flex'; 
        prestamoInput.focus(); 
    });

    if (cancelReportBtn) cancelReportBtn.addEventListener('click', () => { tipoReporteModal.style.display = 'none'; });

    if (confirmPrestamoBtn) confirmPrestamoBtn.addEventListener('click', () => { 
        const num = prestamoInput.value.trim(); 
        if (num) { prestamoModal.style.display = 'none'; generarPDF('Salida', num); }
        else showNotification("Ingresa un número de préstamo.", "error");
    });

    if (confirmEditBtn) confirmEditBtn.addEventListener('click', async () => {
        let ns = newSerialNumberInput.value.trim().toUpperCase();
        if (ns === '0') ns = 'REEMPLAZAR';
        if (!ns) return;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [sanitizeFieldName(currentEditingItem.originalName)]: ns });
            if (ns === 'REEMPLAZAR') await registrarConsumoItem(modelName, currentEditingItem.originalName);
            showNotification('Ítem actualizado.', 'success');
            editSerialModal.style.display = 'none';
        } catch (error) { showNotification('Error al editar.', 'error'); }
    });

    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', async () => {
        if (!itemToDelete) return;
        try {
            const itemDocRef = doc(db, "Items", currentSelectedSerialNumber);
            await updateDoc(itemDocRef, { [itemToDelete.sanitized]: deleteField() });
            showNotification('Ítem eliminado.', 'success');
            deleteConfirmModal.style.display = 'none';
        } catch (error) { showNotification('Error al eliminar.', 'error'); }
    });

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => editSerialModal.style.display = 'none');
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal.style.display = 'none');
    if (cancelPrestamoBtn) cancelPrestamoBtn.addEventListener('click', () => prestamoModal.style.display = 'none');

    const imageModal = document.getElementById('imageModal');
    const closeImageModalBtn = document.getElementById('closeImageModal');
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', () => imageModal.style.display = 'none');
    if (imageModal) imageModal.addEventListener('click', (e) => { if (e.target === imageModal) imageModal.style.display = 'none'; });

    if (backBtn) backBtn.addEventListener('click', () => window.history.back());
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = '../login.html'));
    
    if (searchInput) searchInput.addEventListener('input', () => renderFilteredItems(allLoadedItemsData, searchInput.value));
});
