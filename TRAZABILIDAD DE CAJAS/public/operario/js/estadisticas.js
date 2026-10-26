import { db, collection, query, where, getDocs, doc, getDoc, unSanitizeFieldName, sanitizeFieldName } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const statsContainer = document.getElementById('stats-container');
    const monthTitle = document.getElementById('month-title');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const consumptionModal = document.getElementById('consumption-modal');
    const modalTitle = document.getElementById('consumption-modal-title');
    const consumedItemsContainer = document.getElementById('consumed-items-container');
    const closeModalBtn = document.querySelector('.close-btn');
    const downloadBoxStatsBtn = document.getElementById('download-box-stats-btn');
    const downloadItemConsumptionBtn = document.getElementById('download-item-consumption-btn');
    const showAvgTracingTimeBtn = document.getElementById('show-avg-tracing-time-btn');
    const avgTracingTimeResultsDiv = document.getElementById('avg-tracing-time-results');
    let currentBoxStatsData = [];
    let currentItemConsumptionData = {};
    let currentDate = new Date();
    const downloadCSV = (csvString, filename) => {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const getTimestampMs = (ts, fallbackDateStr) => {
        if (!ts) {
            return fallbackDateStr ? new Date(fallbackDateStr).getTime() : 0;
        }
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
        if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
        const parsed = new Date(ts).getTime();
        return isNaN(parsed) ? 0 : parsed;
    };

    const loadMonthlyStats = async (date) => {
        if (!statsContainer || !monthTitle) {
            console.error("Required elements for statistics are not found on the page.");
            return;
        }

        statsContainer.innerHTML = '<p>Cargando estadísticas...</p>';

        try {
            const currentMonthISO = date.toISOString().slice(0, 7); 
            const nextMonthDate = new Date(date.getFullYear(), date.getMonth() + 1, 15);
            const nextMonthISO = nextMonthDate.toISOString().slice(0, 7);
            
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            monthTitle.textContent = `Salidas de Cajas - ${monthNames[date.getMonth()]} ${date.getFullYear()}`;

            const startOfMonthRange = new Date(date.getFullYear(), date.getMonth(), 0, 0, 0, 0);
            const endOfNextMonthRange = new Date(date.getFullYear(), date.getMonth() + 2, 2, 23, 59, 59, 999);

            const qMovCurrent = query(
                collection(db, "movimientos_cajas"),
                where("mes", "==", currentMonthISO)
            );
            const qMovNext = query(
                collection(db, "movimientos_cajas"),
                where("mes", "==", nextMonthISO)
            );
            const qHistorial = query(
                collection(db, "historial"),
                where("timestamp", ">=", startOfMonthRange),
                where("timestamp", "<=", endOfNextMonthRange)
            );

            const [schemasSnapshot, movCurrentSnap, movNextSnap, historialSnap] = await Promise.all([
                getDocs(collection(db, "esquemas_modelos")),
                getDocs(qMovCurrent),
                getDocs(qMovNext),
                getDocs(qHistorial)
            ]);

            const allModelNames = schemasSnapshot.docs.map(doc => doc.id);

            const modelStats = {};
            allModelNames.forEach(modelName => {
                modelStats[modelName] = {
                    sinConsumo: 0,
                    conConsumo: 0,
                    totalSalidas: 0
                };
            });

            const normSerie = (s) => String(s || '').trim().toUpperCase();
            const movsByCaja = {};
            const seenDocIds = new Set();

            [...movCurrentSnap.docs, ...movNextSnap.docs].forEach(docSnap => {
                if (seenDocIds.has(docSnap.id)) return;
                seenDocIds.add(docSnap.id);

                const data = docSnap.data();
                const serie = normSerie(data.cajaSerie);

                if (!serie) {
                    if (data.tipo === 'Salida' && data.mes === currentMonthISO && data.modelName && modelStats.hasOwnProperty(data.modelName)) {
                        modelStats[data.modelName].totalSalidas++;
                        modelStats[data.modelName].conConsumo++;
                    }
                    return;
                }

                if (!movsByCaja[serie]) movsByCaja[serie] = [];
                movsByCaja[serie].push({
                    id: docSnap.id,
                    ...data,
                    timeMs: getTimestampMs(data.timestamp, data.fecha)
                });
            });

            Object.keys(movsByCaja).forEach(serie => {
                movsByCaja[serie].sort((a, b) => a.timeMs - b.timeMs);
            });

            const consumosByCaja = {};
            historialSnap.forEach(docSnap => {
                const h = docSnap.data();
                if (
                    h.accion === 'MODIFICACIÓN DE ÍTEM' &&
                    h.detalles &&
                    String(h.detalles.valorNuevo || '').trim().toUpperCase() === 'REEMPLAZAR'
                ) {
                    const serie = normSerie(h.detalles.cajaSerie);
                    if (!serie) return;
                    if (!consumosByCaja[serie]) consumosByCaja[serie] = [];
                    consumosByCaja[serie].push(getTimestampMs(h.timestamp));
                }
            });

            Object.keys(consumosByCaja).forEach(serie => {
                consumosByCaja[serie].sort((a, b) => a - b);
            });

            Object.keys(movsByCaja).forEach(serie => {
                const movs = movsByCaja[serie];
                const consumos = consumosByCaja[serie] || [];

                for (let i = 0; i < movs.length; i++) {
                    const mov = movs[i];
                    if (mov.tipo !== 'Salida' || mov.mes !== currentMonthISO) continue;

                    const modelName = mov.modelName;
                    if (!modelName || !modelStats.hasOwnProperty(modelName)) continue;

                    modelStats[modelName].totalSalidas++;

                    // Buscar la siguiente Salida de esta misma caja para delimitar el ciclo del préstamo
                    let nextSalidaTimeMs = Infinity;
                    for (let k = i + 1; k < movs.length; k++) {
                        if (movs[k].tipo === 'Salida') {
                            nextSalidaTimeMs = movs[k].timeMs;
                            break;
                        }
                    }

                    // Buscar si se registró Entrada antes de la próxima Salida
                    let entradaMov = null;
                    for (let j = i + 1; j < movs.length; j++) {
                        if (movs[j].timeMs >= nextSalidaTimeMs) break;
                        if (movs[j].tipo === 'Entrada') {
                            entradaMov = movs[j];
                            break;
                        }
                    }

                    if (!entradaMov) {
                        // Lo que no se avisó como Entrada se suma a Cajas con Consumo
                        modelStats[modelName].conConsumo++;
                    } else {
                        const salidaTimeMs = mov.timeMs;
                        const endCycleTimeMs = Math.min(
                            nextSalidaTimeMs - 1,
                            Math.max(entradaMov.timeMs, entradaMov.timeMs + (2 * 24 * 60 * 60 * 1000))
                        );

                        const tuvoConsumo = consumos.some(cTimeMs => cTimeMs >= salidaTimeMs && cTimeMs <= endCycleTimeMs);

                        if (tuvoConsumo) {
                            modelStats[modelName].conConsumo++;
                        } else {
                            modelStats[modelName].sinConsumo++;
                        }
                    }
                }
            });

            const sortedModels = Object.entries(modelStats).sort(([, a], [, b]) => {
                if (b.totalSalidas !== a.totalSalidas) return b.totalSalidas - a.totalSalidas;
                return b.conConsumo - a.conConsumo;
            });
            currentBoxStatsData = sortedModels; 

            if (sortedModels.length === 0) {
                statsContainer.innerHTML = '<p>No se encontraron modelos de cajas definidos.</p>';
            } else {
                renderStatsTable(sortedModels);
            }

        } catch (error) {
            console.error("Error al cargar las estadísticas:", error);
            statsContainer.innerHTML = '<p>Ocurrió un error al cargar las estadísticas.</p>';
            currentBoxStatsData = [];
        }
        updateNavButtons();
    };

    const renderStatsTable = (modelStatsList) => {
        let tableHTML = `
            <div style="width: 100%; overflow-x: auto;">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Modelo de Caja</th>
                            <th>Cajas sin Consumo</th>
                            <th>Cajas con Consumo</th>
                            <th>Cajas Totales que Salieron</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        modelStatsList.forEach(([modelName, stats]) => {
            tableHTML += `
                <tr class="clickable-row" data-model-name="${modelName}">
                    <td>${modelName}</td>
                    <td>${stats.sinConsumo}</td>
                    <td>${stats.conConsumo}</td>
                    <td>${stats.totalSalidas}</td>
                </tr>
            `;
        });

        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;

        statsContainer.innerHTML = tableHTML;
        attachRowListeners();
    };

    const attachRowListeners = () => {
        document.querySelectorAll('.clickable-row').forEach(row => {
            row.addEventListener('click', () => {
                const modelName = row.dataset.modelName;
                showConsumptionForModel(modelName);
            });
        });
    };

    const showConsumptionForModel = async (modelName) => {
        if (!consumptionModal || !modalTitle || !consumedItemsContainer) return;

        modalTitle.textContent = `Consumo de Items para "${modelName}"`;
        consumedItemsContainer.innerHTML = '<p>Cargando...</p>';
        consumptionModal.style.display = 'flex';

        try {
            const currentMonthISO = currentDate.toISOString().slice(0, 7); 

            const schemaDocSnap = await getDoc(doc(db, "esquemas_modelos", modelName));

            let allPossibleItems = {};
            if (schemaDocSnap.exists()) {
                const schemaData = schemaDocSnap.data();
                Object.keys(schemaData).forEach(sanitizedItemName => {
                    allPossibleItems[sanitizedItemName] = 0;
                });
            }

            const sanitizedModel = sanitizeFieldName(modelName); 
            const statsDocRef = doc(db, "estadisticas_consumo", currentMonthISO);
            const docSnap = await getDoc(statsDocRef);

            if (docSnap.exists()) {
                const allConsumptionData = docSnap.data();
                const modelConsumptionData = allConsumptionData[sanitizedModel];

                if (modelConsumptionData) {
                    Object.keys(modelConsumptionData).forEach(sanitizedItemName => {
                        allPossibleItems[sanitizedItemName] = modelConsumptionData[sanitizedItemName];
                    });
                }
            }

            if (Object.keys(allPossibleItems).length > 0) {
                currentItemConsumptionData = allPossibleItems; 
                renderConsumedItems(allPossibleItems);
            } else {
                consumedItemsContainer.innerHTML = '<p>No se encontraron ítems definidos para este modelo o no hay datos de consumo.</p>';
                currentItemConsumptionData = {}; 
            }

        } catch (error) {
            console.error("Error al cargar estadísticas de consumo:", error);
            consumedItemsContainer.innerHTML = '<p>Ocurrió un error al cargar los datos de consumo.</p>';
            currentItemConsumptionData = {};
        }
    };

    const renderConsumedItems = (consumptionData) => {
        const sortedItems = Object.entries(consumptionData).sort(([, a], [, b]) => b - a);

        let listHTML = '';
        sortedItems.forEach(([sanitizedItemName, count]) => {
            const originalItemName = unSanitizeFieldName(sanitizedItemName);
            const [itemCode, itemDesc] = originalItemName.split(';');
            
            listHTML += `
                <div class="consumed-item">
                    <div class="item-details">
                        <span class="item-desc">${itemDesc || 'Sin descripción'}</span>
                        <span class="item-code">${itemCode || 'Sin código'}</span>
                    </div>
                    <span class="item-count">${count}</span>
                </div>
            `;
        });

        consumedItemsContainer.innerHTML = listHTML;
    };

    const updateNavButtons = () => {
        const now = new Date();
        const nextMonth = new Date(currentDate.getMonth() + 1, 1);
        nextMonthBtn.disabled = nextMonth > now;
    };

    closeModalBtn?.addEventListener('click', () => {
        consumptionModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == consumptionModal) {
            consumptionModal.style.display = 'none';
        }
    });

    downloadBoxStatsBtn?.addEventListener('click', () => {
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const filename = `Salidas_Cajas_${monthNames[currentDate.getMonth()]}_${currentDate.getFullYear()}.csv`;

        let csvContent = "\uFEFFModelo de Caja;Cajas sin Consumo;Cajas con Consumo;Cajas Totales que Salieron\n";
        currentBoxStatsData.forEach(([modelName, stats]) => {
            csvContent += `"${modelName}";${stats.sinConsumo};${stats.conConsumo};${stats.totalSalidas}\n`;
        });
        downloadCSV(csvContent, filename);
    });

    downloadItemConsumptionBtn?.addEventListener('click', () => {
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const modelNameForFile = modalTitle.textContent.replace('Consumo de Items para "', '').replace('"', ''); // Extract model name from modal title
        const filename = `Consumo_Items_${modelNameForFile}_${monthNames[currentDate.getMonth()]}_${currentDate.getFullYear()}.csv`;

        let csvContent = "Código;Descripción;Cantidad Consumida\n";
        const sortedItems = Object.entries(currentItemConsumptionData).sort(([, a], [, b]) => b - a);
        sortedItems.forEach(([sanitizedItemName, count]) => {
            const originalItemName = unSanitizeFieldName(sanitizedItemName);
            const [itemCode, itemDesc] = originalItemName.split(';');
            csvContent += `"${itemCode || ''}";"${itemDesc || ''}";${count}\n`;
        });
        downloadCSV(csvContent, filename);
    });

    const loadAndRenderAvgTracingTimes = async () => {
        if (!avgTracingTimeResultsDiv) return;

        avgTracingTimeResultsDiv.innerHTML = '<p>Cargando tiempos promedio...</p>';

        try {
            const querySnapshot = await getDocs(collection(db, "tracingTimes"));
            const modelDurations = {}; 

            querySnapshot.forEach(doc => {
                const data = doc.data();
                const modelName = data.modelName;
                const durationMs = data.durationMs;

                if (modelName && typeof durationMs === 'number') {
                    if (!modelDurations[modelName]) {
                        modelDurations[modelName] = [];
                    }
                    modelDurations[modelName].push(durationMs);
                }
            });

            let resultsHTML = '';
            if (Object.keys(modelDurations).length === 0) {
                resultsHTML = '<p>No hay datos de tiempo de trazado disponibles.</p>';
            } else {
                resultsHTML = '<h3>Tiempo Promedio de Trazado por Modelo:</h3><ul>';
                for (const modelName in modelDurations) {
                    const durations = modelDurations[modelName];
                    const sum = durations.reduce((a, b) => a + b, 0);
                    const averageMs = sum / durations.length;

                    const totalSeconds = Math.floor(averageMs / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    const milliseconds = Math.floor(averageMs % 1000);

                    let formattedTime = '';
                    if (minutes > 0) formattedTime += `${minutes}m `;
                    formattedTime += `${seconds}s`;
                    if (minutes === 0) formattedTime += ` ${milliseconds}ms`; 

                    resultsHTML += `<li><strong>${modelName}</strong>: ${formattedTime}</li>`;
                }
                resultsHTML += '</ul>';
            }
            avgTracingTimeResultsDiv.innerHTML = resultsHTML;

        } catch (error) {
            console.error("Error al cargar tiempos promedio de trazado:", error);
            avgTracingTimeResultsDiv.innerHTML = '<p>Ocurrió un error al cargar los tiempos promedio.</p>';
        }
    };

    showAvgTracingTimeBtn?.addEventListener('click', loadAndRenderAvgTracingTimes);

    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadMonthlyStats(currentDate);
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadMonthlyStats(currentDate);
    });

    loadMonthlyStats(currentDate);
});
