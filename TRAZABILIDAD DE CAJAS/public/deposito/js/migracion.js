import { db, requireDepositoAuth, doc, setDoc, getDocs, collection, writeBatch } from './firebase-config-deposito.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor']);
        document.getElementById('user-display-name').textContent = authData.userData.name || authData.user.email;

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
            statusLog.innerHTML = `<div class="mb-1 text-slate-900 dark:text-white uppercase font-black">--- INICIANDO PROCESO ---</div>`;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target.result;
                if (!text) {
                    alert("El archivo parece estar vacío.");
                    importBtn.disabled = false;
                    return;
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
                        const columns = rows[i].split(separator);
                        
                        let codigo = columns[0]?.trim() || '';
                        const rawDesc = columns[1]?.trim() || '';
                        const rawDetalle = columns[2]?.trim() || '';

                        // Combinamos descripción y detalle
                        let descripcionFinal = `${rawDesc} ${rawDetalle}`.trim();
                        const estado = 'ACTIVO';

                        // Validaciones S/N
                        let hasIssues = false;
                        if (!codigo) {
                            codigo = `S/N`;
                            hasIssues = true;
                        }
                        if (!descripcionFinal) {
                            descripcionFinal = `S/N`;
                            hasIssues = true;
                        }

                        // ID único para Firestore en caso de S/N repetidos
                        const finalDocId = codigo === 'S/N' ? `SN-${Date.now()}-${i}` : codigo;

                        const itemRef = doc(db, "deposito_catalogo", finalDocId);
                        
                        await setDoc(itemRef, {
                            codigo: codigo,
                            descripcion: descripcionFinal,
                            estado: estado,
                            stock: 0, 
                            ultimaActualizacion: new Date(),
                            migrado: true
                        }, { merge: true });

                        added++;
                        
                        // Cuadro rojo leve si hay S/N
                        const logBg = hasIssues ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 p-1 rounded' : '';
                        statusLog.innerHTML += `<div class="${logBg}">[${added}] OK: [${codigo}] ${descripcionFinal}</div>`;
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
                
                localStorage.removeItem('villalba_items_cache');
                alert(`Migración terminada: ${added} items cargados con éxito.`);
            };
            
            reader.onerror = (err) => {
                alert("Error crítico al leer el archivo.");
                console.error(err);
                importBtn.disabled = false;
            };

            reader.readAsText(file);
        });

        // NUEVA LÓGICA: CARGA MANUAL
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
            statusLog.innerHTML = `<div class="mb-1 text-indigo-500 uppercase font-black">--- INICIANDO CARGA MANUAL ---</div>`;

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
                    if (columns.length < 2) {
                        throw new Error("Formato inválido. Usá CODIGO ; DESCRIPCIÓN o pegá desde Excel");
                    }
                    
                    const codigo = columns[0]?.trim() || '';
                    const descripcion = columns[1]?.trim() || '';

                    if (!codigo) throw new Error("Código faltante.");

                    const itemRef = doc(db, "deposito_catalogo", codigo);
                    
                    await setDoc(itemRef, {
                        codigo: codigo,
                        descripcion: descripcion,
                        estado: 'ACTIVO',
                        stock: 0, 
                        ultimaActualizacion: new Date(),
                        migrado: false,
                        manual: true
                    }, { merge: true });

                    added++;
                    statusLog.innerHTML += `<div>[${added}] OK: [${codigo}] ${descripcion}</div>`;
                } catch (err) {
                    errors++;
                    statusLog.innerHTML += `<div class="bg-rose-500 text-white p-1 rounded mb-1">ERROR [Línea ${i+1}]: ${err.message}</div>`;
                }
                statusLog.scrollTop = statusLog.scrollHeight;
            }

            manualBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">add_circle</span> AGREGAR ÍTEMS MANUALMENTE';
            manualInput.value = '';
            
            localStorage.removeItem('villalba_items_cache');
            alert(`Carga manual finalizada: ${added} items registrados.`);
        });
    } catch (error) {
        console.error("Error en módulo de migración", error);
    }
});
