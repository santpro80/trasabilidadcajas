import { db, requireDepositoAuth, doc, setDoc, getDocs, collection, writeBatch, deleteDoc } from './firebase-config-deposito.js';

let selectedWarehouse = 'no_esteril_terminado'; // 'no_esteril_terminado' | 'esteril_terminado' | 'semi_elaborado' | 'materia_prima'

const updateSelectorUI = () => {
    const buttons = {
        'no_esteril_terminado': document.getElementById('btn-dep-no-esteril-terminado'),
        'esteril_terminado': document.getElementById('btn-dep-esteril-terminado'),
        'semi_elaborado': document.getElementById('btn-dep-semi-elaborado'),
        'materia_prima': document.getElementById('btn-dep-materia-prima')
    };

    Object.keys(buttons).forEach(key => {
        const btn = buttons[key];
        if (!btn) return;
        if (key === selectedWarehouse) {
            btn.className = "warehouse-selector-btn py-3 px-2 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all select-none bg-villalba-blue text-white border-villalba-blue shadow-lg shadow-blue-500/20 active:scale-[0.97]";
        } else {
            btn.className = "warehouse-selector-btn py-3 px-2 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all select-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 active:scale-[0.97]";
        }
    });

    const formatInstructions = document.getElementById('format-instructions');
    if (formatInstructions) {
        if (selectedWarehouse === 'no_esteril_terminado') {
            formatInstructions.innerHTML = `Cargar un archivo .csv con separación por punto y coma (;) que incluya las siguientes columnas:<br>
<span class="text-blue-600 dark:text-blue-400">CODIGO ; DESCRIPCION ; ENTREPISO ; MATERIAL ; CANTIDAD</span><br>
<span class="text-slate-400 text-[10px]">(o bien CODIGO ; DESCRIPCION ; ENTREPISO ; CANTIDAD)</span>`;
        } else {
            formatInstructions.innerHTML = `Cargar un archivo .csv con separación por punto y coma (;) que incluya las siguientes columnas:<br>
<span class="text-blue-600 dark:text-blue-400">CODIGO ; DESCRIPCION ; CANTIDAD</span>`;
        }
    }

    const manualInputLabel = document.getElementById('manual-input-label');
    const manualInput = document.getElementById('manual-input');
    if (manualInput) {
        if (selectedWarehouse === 'no_esteril_terminado') {
            if (manualInputLabel) {
                manualInputLabel.textContent = "Formato: CODIGO ; DESCRIPCIÓN ; ENTREPISO ; MATERIAL ; CANTIDAD (uno por línea)";
            }
            manualInput.placeholder = "42-118-01 ; PLACA VOLAR ANGOSTA ; 12 ; TITANIO ; 15\n42-118-02 ; PLACA VOLAR ANCHA ; 12 ; ACERO ; 22";
        } else {
            if (manualInputLabel) {
                manualInputLabel.textContent = "Formato: CODIGO ; DESCRIPCIÓN ; CANTIDAD (uno por línea)";
            }
            manualInput.placeholder = "42-118-01 ; PLACA VOLAR ANGOSTA ; 15\n42-118-02 ; PLACA VOLAR ANCHA ; 22";
        }
    }
};

const getCatalogCollection = () => `deposito_catalogo_${selectedWarehouse}`;
const getMasterDoc = () => `master_catalog_${selectedWarehouse}`;
const getCacheKey = () => `villalba_items_cache_${selectedWarehouse}`;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor']);
        document.getElementById('user-display-name').textContent = authData.userData.name || authData.user.email;

        // Bind selector buttons
        const bindWarehouseBtn = (id, key) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    selectedWarehouse = key;
                    updateSelectorUI();
                });
            }
        };
        bindWarehouseBtn('btn-dep-no-esteril-terminado', 'no_esteril_terminado');
        bindWarehouseBtn('btn-dep-esteril-terminado', 'esteril_terminado');
        bindWarehouseBtn('btn-dep-semi-elaborado', 'semi_elaborado');
        bindWarehouseBtn('btn-dep-materia-prima', 'materia_prima');
        
        updateSelectorUI();

        const csvInput = document.getElementById('csv-input');
        const fileName = document.getElementById('file-name');
        const importBtn = document.getElementById('import-btn');
        const progressContainer = document.getElementById('progress-container');
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const statusLog = document.getElementById('status-log');

        csvInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileName.textContent = file.name.toUpperCase();
                importBtn.disabled = false;
            }
        });

        importBtn.addEventListener('click', async () => {
            const file = csvInput.files[0];
            if (!file) return;

            importBtn.disabled = true;
            progressContainer.classList.remove('hidden');
            statusLog.classList.remove('hidden');
            statusLog.innerHTML = `<div class="mb-1 text-slate-900 dark:text-white uppercase font-black">--- INICIANDO PROCESO (${selectedWarehouse.toUpperCase()}) ---</div>`;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target.result;
                if (!text) {
                    alert("El archivo parece estar vacío.");
                    importBtn.disabled = false;
                    return;
                }

                // Cargar catálogo actual para no pisar el stock
                statusLog.innerHTML += `<div class="text-indigo-400 italic">Cargando stock y catálogo actual desde ${getCatalogCollection()}...</div>`;
                const existingItems = new Map();
                try {
                    const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
                    catalogSnap.forEach(doc => {
                        existingItems.set(doc.id, doc.data());
                    });
                    statusLog.innerHTML += `<div class="text-emerald-500 font-bold mb-2">Catálogo cargado: ${existingItems.size} ítems en base de datos.</div>`;
                } catch (err) {
                    console.error("Error al obtener catálogo actual:", err);
                    statusLog.innerHTML += `<div class="text-amber-500 font-bold mb-2">Advertencia: No se pudo verificar la base de datos actual. Nuevos ítems se inicializarán en 0.</div>`;
                }

                const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
                statusLog.innerHTML += `<div class="text-slate-500 italic">Archivo leído: ${rows.length} líneas detectadas.</div>`;

                let startIdx = 0;
                // Detectar si hay cabecera
                if (rows.length > 0 && rows[0].toLowerCase().includes('codigo')) {
                    startIdx = 1;
                    statusLog.innerHTML += `<div class="text-slate-500 italic">Cabecera detectada y omitida.</div>`;
                }

                const total = rows.length - startIdx;
                if (total <= 0) {
                    statusLog.innerHTML += `<div class="text-amber-500 font-black">ADVERTENCIA: No hay datos para procesar después de la cabecera.</div>`;
                    alert("No se encontraron registros válidos para migrar.");
                    importBtn.disabled = false;
                    return;
                }

                let processed = 0;
                let added = 0;
                let errors = 0;

                // Intentar detectar separador (punto y coma o coma)
                let separator = ';';
                if (rows[startIdx] && !rows[startIdx].includes(';') && rows[startIdx].includes(',')) {
                    separator = ',';
                    statusLog.innerHTML += `<div class="text-indigo-400 italic">Info: Usando coma (,) como separador detectado.</div>`;
                }

                for (let i = startIdx; i < rows.length; i++) {
                    try {
                        const line = rows[i].trim();
                        if (!line) continue;

                        const columns = line.split(separator);
                        
                        let codigo = columns[0]?.replace(/"/g, '')?.trim() || '';
                        let descripcion = columns[1]?.replace(/"/g, '')?.trim() || '';
                        let entrepiso = '';
                        let material = '';
                        let rawCantidad = '0';

                        if (selectedWarehouse === 'no_esteril_terminado') {
                            if (columns.length >= 5) {
                                entrepiso = columns[2]?.replace(/"/g, '')?.trim() || '';
                                material = columns[3]?.replace(/"/g, '')?.trim() || '';
                                rawCantidad = columns[4]?.replace(/"/g, '')?.trim() || '0';
                            } else {
                                entrepiso = columns[2]?.replace(/"/g, '')?.trim() || '';
                                rawCantidad = columns[3]?.replace(/"/g, '')?.trim() || '0';
                            }
                        } else {
                            rawCantidad = columns[2]?.replace(/"/g, '')?.trim() || '0';
                        }

                        let stock = parseInt(rawCantidad, 10);
                        if (isNaN(stock)) stock = 0;

                        // Validaciones S/N
                        if (!codigo) {
                            codigo = `S/N`;
                        }
                        if (!descripcion) {
                            descripcion = `S/N`;
                        }

                        // ID único para Firestore en caso de S/N repetidos
                        const finalDocId = codigo === 'S/N' ? `SN-${Date.now()}-${i}` : codigo;

                        const itemRef = doc(db, getCatalogCollection(), finalDocId);
                        
                        const exists = existingItems.has(finalDocId);
                        const itemData = {
                            codigo: codigo,
                            descripcion: descripcion,
                            stock: stock,
                            estado: 'ACTIVO',
                            ultimaActualizacion: new Date(),
                            migrado: true
                        };

                        if (selectedWarehouse === 'no_esteril_terminado') {
                            itemData.entrepiso = entrepiso;
                            if (material) itemData.material = material;
                        }

                        await setDoc(itemRef, itemData, { merge: true });
                        existingItems.set(finalDocId, itemData);

                        added++;
                        
                        // Cuadro rojo leve si hay S/N
                        const hasIssues = (codigo === 'S/N' || descripcion === 'S/N');
                        const logBg = hasIssues ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 p-1 rounded' : '';
                        const entrepisoLog = selectedWarehouse === 'no_esteril_terminado' ? ` - Entrepiso: ${entrepiso}` : '';
                        statusLog.innerHTML += `<div class="${logBg}">[${added}] OK: [${codigo}] ${descripcion}${entrepisoLog} - Cantidad: ${stock} ${exists ? '<span class="text-amber-500 font-bold">(Actualizado)</span>' : '<span class="text-emerald-500 font-bold">(Nuevo)</span>'}</div>`;
                    } catch (err) {
                        errors++;
                        statusLog.innerHTML += `<div class="bg-rose-500 text-white p-1 rounded mb-1">FATAL [Fila ${i+1}]: ${err.message}</div>`;
                        console.error("Error en fila", i, err);
                    }

                    processed++;
                    const percent = Math.round((processed / total) * 100);
                    progressBar.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    statusLog.scrollTop = statusLog.scrollHeight;
                }

                statusLog.innerHTML += `<div class="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-600 font-black text-center uppercase tracking-widest">
                    MIGRACIÓN FINALIZADA<br>
                    ${added} items registrados con éxito
                </div>`;
                
                statusLog.innerHTML += `<div class="text-indigo-400 italic">Optimizando base maestra (creando Master Document)...</div>`;
                const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
                const allItems = catalogSnap.docs.map(d => {
                    const data = d.data();
                    const item = { 
                        codigo: d.id, 
                        descripcion: data.descripcion || 'S/N', 
                        stock: data.stock || 0 
                    };
                    if (selectedWarehouse === 'no_esteril_terminado') {
                        item.entrepiso = data.entrepiso || '';
                        item.material = data.material || '';
                    }
                    return item;
                });
                await setDoc(doc(db, 'system', getMasterDoc()), { items: allItems });

                localStorage.removeItem(getCacheKey());
                alert(`Migración terminada: ${added} items cargados con éxito y optimizados.`);
            };
            
            reader.onerror = (err) => {
                alert("Error crítico al leer el archivo.");
                console.error(err);
                importBtn.disabled = false;
            };

            reader.readAsText(file);
        });

        // CARGA MANUAL
        const manualInput = document.getElementById('manual-input');
        const manualBtn = document.getElementById('manual-import-btn');

        manualBtn.addEventListener('click', async () => {
            const text = manualInput.value.trim();
            if (!text) {
                alert("Por favor, ingresá al menos un ítem.");
                return;
            }

            const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
            
            manualBtn.disabled = true;
            manualBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> PROCESANDO...';
            
            statusLog.classList.remove('hidden');
            statusLog.innerHTML = `<div class="mb-1 text-indigo-500 uppercase font-black">--- INICIANDO CARGA MANUAL (${selectedWarehouse.toUpperCase()}) ---</div>`;

            // Cargar catálogo actual para no pisar el stock
            statusLog.innerHTML += `<div class="text-indigo-400 italic">Cargando catálogo actual...</div>`;
            const existingItems = new Map();
            try {
                const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
                catalogSnap.forEach(doc => {
                    existingItems.set(doc.id, doc.data());
                });
                statusLog.innerHTML += `<div class="text-emerald-500 font-bold mb-2">Catálogo cargado: ${existingItems.size} ítems.</div>`;
            } catch (err) {
                console.error("Error al obtener catálogo actual:", err);
            }

            let added = 0;
            let errors = 0;

            for (let i = 0; i < rows.length; i++) {
                try {
                    // Detectar separador: Tabulador (Excel paste) o Punto y Coma
                    let separator = ';';
                    if (rows[i].includes('\t')) {
                        separator = '\t';
                    }
                    
                    const columns = rows[i].split(separator);
                    
                    const codigo = columns[0]?.replace(/"/g, '')?.trim() || '';
                    const descripcion = columns[1]?.replace(/"/g, '')?.trim() || '';
                    let entrepiso = '';
                    let material = '';
                    let rawCantidad = '0';

                    if (selectedWarehouse === 'no_esteril_terminado') {
                        if (columns.length >= 5) {
                            entrepiso = columns[2]?.replace(/"/g, '')?.trim() || '';
                            material = columns[3]?.replace(/"/g, '')?.trim() || '';
                            rawCantidad = columns[4]?.replace(/"/g, '')?.trim() || '0';
                        } else {
                            entrepiso = columns[2]?.replace(/"/g, '')?.trim() || '';
                            rawCantidad = columns[3]?.replace(/"/g, '')?.trim() || '0';
                        }
                    } else {
                        rawCantidad = columns[2]?.replace(/"/g, '')?.trim() || '0';
                    }

                    if (!codigo) throw new Error("Código faltante.");

                    let stock = parseInt(rawCantidad, 10);
                    if (isNaN(stock)) stock = 0;

                    const itemRef = doc(db, getCatalogCollection(), codigo);
                    
                    const exists = existingItems.has(codigo);
                    const itemData = {
                        codigo: codigo,
                        descripcion: descripcion,
                        stock: stock,
                        estado: 'ACTIVO',
                        ultimaActualizacion: new Date(),
                        migrado: false,
                        manual: true
                    };

                    if (selectedWarehouse === 'no_esteril_terminado') {
                        itemData.entrepiso = entrepiso;
                        if (material) itemData.material = material;
                    }

                    await setDoc(itemRef, itemData, { merge: true });
                    existingItems.set(codigo, itemData);

                    added++;
                    const entrepisoLog = selectedWarehouse === 'no_esteril_terminado' ? ` - Entrepiso: ${entrepiso}` : '';
                    const materialLog = material ? ` - Material: ${material}` : '';
                    statusLog.innerHTML += `<div>[${added}] OK: [${codigo}] ${descripcion}${entrepisoLog}${materialLog} - Cantidad: ${stock} ${exists ? '<span class="text-amber-500 font-bold">(Actualizado)</span>' : '<span class="text-emerald-500 font-bold">(Nuevo)</span>'}</div>`;
                } catch (err) {
                    errors++;
                    statusLog.innerHTML += `<div class="bg-rose-500 text-white p-1 rounded mb-1">ERROR [Línea ${i+1}]: ${err.message}</div>`;
                }
                statusLog.scrollTop = statusLog.scrollHeight;
            }

            statusLog.innerHTML += `<div class="text-indigo-400 italic mt-2">Optimizando base maestra (creando Master Document)...</div>`;
            const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
            const allItems = catalogSnap.docs.map(d => {
                const data = d.data();
                const item = { 
                    codigo: d.id, 
                    descripcion: data.descripcion || 'S/N', 
                    stock: data.stock || 0 
                };
                if (selectedWarehouse === 'no_esteril_terminado') {
                    item.entrepiso = data.entrepiso || '';
                    item.material = data.material || '';
                }
                return item;
            });
            await setDoc(doc(db, 'system', getMasterDoc()), { items: allItems });

            manualBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">add_circle</span> AGREGAR ÍTEMS MANUALMENTE';
            manualInput.value = '';
            
            localStorage.removeItem(getCacheKey());
            alert(`Carga manual finalizada: ${added} items registrados y optimizados.`);
        });

        // ASIGNACIÓN / CARGA DE MATERIALES POR CÓDIGO
        const materialInput = document.getElementById('material-input');
        const materialBtn = document.getElementById('material-import-btn');

        if (materialBtn) {
            materialBtn.addEventListener('click', async () => {
                const text = materialInput ? materialInput.value.trim() : '';
                if (!text) {
                    alert("Por favor, ingresá al menos un código con su material.");
                    return;
                }

                const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
                
                materialBtn.disabled = true;
                materialBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> ASIGNANDO MATERIALES...';
                
                statusLog.classList.remove('hidden');
                statusLog.innerHTML = `<div class="mb-1 text-indigo-500 uppercase font-black">--- INICIANDO ASIGNACIÓN DE MATERIALES (${selectedWarehouse.toUpperCase()}) ---</div>`;

                let updated = 0;
                let errors = 0;

                for (let i = 0; i < rows.length; i++) {
                    try {
                        let separator = ';';
                        if (rows[i].includes('\t')) separator = '\t';
                        else if (!rows[i].includes(';') && rows[i].includes(',')) separator = ',';

                        const columns = rows[i].split(separator);
                        const codigo = columns[0]?.replace(/"/g, '')?.trim() || '';
                        const material = columns[1]?.replace(/"/g, '')?.trim() || '';

                        if (!codigo) throw new Error("Código faltante.");
                        if (!material) throw new Error("Material faltante.");

                        const itemRef = doc(db, getCatalogCollection(), codigo);
                        await setDoc(itemRef, { 
                            codigo: codigo,
                            material: material,
                            ultimaActualizacion: new Date()
                        }, { merge: true });

                        updated++;
                        statusLog.innerHTML += `<div>[${updated}] OK: Código [${codigo}] -> Material: <span class="text-indigo-400 font-black">${material}</span></div>`;
                    } catch (err) {
                        errors++;
                        statusLog.innerHTML += `<div class="bg-rose-500 text-white p-1 rounded mb-1">ERROR [Línea ${i+1}]: ${err.message}</div>`;
                    }
                    statusLog.scrollTop = statusLog.scrollHeight;
                }

                statusLog.innerHTML += `<div class="text-indigo-400 italic mt-2">Optimizando base maestra (creando Master Document)...</div>`;
                const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
                const allItems = catalogSnap.docs.map(d => {
                    const data = d.data();
                    const item = { 
                        codigo: d.id, 
                        descripcion: data.descripcion || 'S/N', 
                        stock: data.stock || 0 
                    };
                    if (selectedWarehouse === 'no_esteril_terminado') {
                        item.entrepiso = data.entrepiso || '';
                        item.material = data.material || '';
                    }
                    return item;
                });
                await setDoc(doc(db, 'system', getMasterDoc()), { items: allItems });

                materialBtn.disabled = false;
                materialBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">add_circle</span> ASIGNAR MATERIALES';
                if (materialInput) materialInput.value = '';
                
                localStorage.removeItem(getCacheKey());
                alert(`Asignación de materiales finalizada: ${updated} ítems actualizados y optimizados.`);
            });
        }

        // ELIMINAR ÍTEMS "SN" (SIN CÓDIGO)
        const deleteSnBtn = document.getElementById('btn-delete-sn');
        if (deleteSnBtn) {
            deleteSnBtn.addEventListener('click', async () => {
                const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente todos los ítems cuyos códigos comienzan con 'SN' en el depósito ${selectedWarehouse.toUpperCase()}? Esta acción no se puede deshacer.`);
                if (!confirmed) return;

                deleteSnBtn.disabled = true;
                deleteSnBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> BORRANDO ÍTEMS...';
                
                statusLog.classList.remove('hidden');
                statusLog.innerHTML = `<div class="mb-1 text-rose-500 uppercase font-black">--- INICIANDO ELIMINACIÓN DE REGISTROS 'SN' (${selectedWarehouse.toUpperCase()}) ---</div>`;

                try {
                    statusLog.innerHTML += `<div class="text-indigo-400 italic">Buscando ítems en la base de datos...</div>`;
                    const catalogSnap = await getDocs(collection(db, getCatalogCollection()));
                    
                    const toDelete = [];
                    catalogSnap.forEach(d => {
                        const id = d.id;
                        const isSN = id.toUpperCase().startsWith('SN');
                        if (isSN) {
                            toDelete.push(d);
                        }
                    });

                    statusLog.innerHTML += `<div class="text-indigo-400 italic">Encontrados ${toDelete.length} ítems 'SN' para eliminar.</div>`;

                    if (toDelete.length === 0) {
                        statusLog.innerHTML += `<div class="text-emerald-500 font-bold mb-2">No se encontraron ítems 'SN' para eliminar.</div>`;
                        alert("No se encontraron ítems que comiencen con 'SN'.");
                        deleteSnBtn.disabled = false;
                        deleteSnBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete_sweep</span> ELIMINAR ÍTEMS "SN" (SIN CÓDIGO)';
                        return;
                    }

                    let deletedCount = 0;
                    let batch = writeBatch(db);
                    let countInBatch = 0;

                    for (const docSnap of toDelete) {
                        batch.delete(docSnap.ref);
                        countInBatch++;
                        deletedCount++;

                        statusLog.innerHTML += `<div class="text-rose-500/80">[ELIMINADO] ID: ${docSnap.id}</div>`;
                        statusLog.scrollTop = statusLog.scrollHeight;

                        if (countInBatch === 400) {
                            statusLog.innerHTML += `<div class="text-slate-400 italic">Enviando lote de eliminaciones...</div>`;
                            await batch.commit();
                            batch = writeBatch(db);
                            countInBatch = 0;
                        }
                    }

                    if (countInBatch > 0) {
                        statusLog.innerHTML += `<div class="text-slate-400 italic">Enviando lote final de eliminaciones...</div>`;
                        await batch.commit();
                    }

                    statusLog.innerHTML += `<div class="text-emerald-500 font-bold mt-2">Eliminados ${deletedCount} registros con éxito.</div>`;
                    
                    // Regenerar el Master Document
                    statusLog.innerHTML += `<div class="text-indigo-400 italic mt-2">Regenerando catálogo maestro (Master Document)...</div>`;
                    const freshCatalogSnap = await getDocs(collection(db, getCatalogCollection()));
                    const allItems = freshCatalogSnap.docs.map(d => ({ 
                        codigo: d.id, 
                        descripcion: d.data().descripcion || 'S/N', 
                        stock: d.data().stock || 0 
                    }));
                    await setDoc(doc(db, 'system', getMasterDoc()), { items: allItems });

                    // Limpiar caché local
                    localStorage.removeItem(getCacheKey());

                    statusLog.innerHTML += `<div class="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 font-black text-center uppercase tracking-widest">
                        PROCESO COMPLETADO EXCoreCTAMENTE
                    </div>`;
                    alert(`Eliminación completada con éxito. Se eliminaron ${deletedCount} registros.`);

                } catch (err) {
                    console.error("Error al eliminar registros 'SN':", err);
                    statusLog.innerHTML += `<div class="bg-rose-500 text-white p-1 rounded mb-1">ERROR CRÍTICO: ${err.message}</div>`;
                    alert("Ocurrió un error al intentar eliminar los registros.");
                } finally {
                    deleteSnBtn.disabled = false;
                    deleteSnBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete_sweep</span> ELIMINAR ÍTEMS "SN" (SIN CÓDIGO)';
                }
            });
        }
    } catch (error) {
        console.error("Error en módulo de migración", error);
    }
});
