import { db, collection, query, where, getDocs, doc, getDoc, unSanitizeFieldName, sanitizeFieldName } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const statsContainer = document.getElementById('stats-container');
    const monthTitle = document.getElementById('month-title');

    // Modal elements
    const consumptionModal = document.getElementById('consumption-modal');
    const modalTitle = document.getElementById('consumption-modal-title');
    const consumedItemsContainer = document.getElementById('consumed-items-container');
    const closeModalBtn = document.querySelector('.close-btn');

    // Download buttons
    const downloadBoxStatsBtn = document.getElementById('download-box-stats-btn');
    const downloadItemConsumptionBtn = document.getElementById('download-item-consumption-btn');

    // New elements for average tracing time
    const showAvgTracingTimeBtn = document.getElementById('show-avg-tracing-time-btn');
    const avgTracingTimeResultsDiv = document.getElementById('avg-tracing-time-results');

    // Data storage for downloads
    let currentBoxStatsData = [];
    let currentItemConsumptionData = {};

    // Helper function to download CSV
    const downloadCSV = (csvString, filename) => {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const loadMonthlyStats = async () => {
        if (!statsContainer || !monthTitle) {
            console.error("Required elements for statistics are not found on the page.");
            return;
        }

        statsContainer.innerHTML = '<p>Cargando estadísticas...</p>';

        try {
            const now = new Date();
            const currentMonthISO = now.toISOString().slice(0, 7); // Formato YYYY-MM
            
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            monthTitle.textContent = `Salidas de Cajas - ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

            // 1. Get all models from esquemas_modelos
            const schemasSnapshot = await getDocs(collection(db, "esquemas_modelos"));
            const allModelNames = schemasSnapshot.docs.map(doc => doc.id);

            // Initialize all models with 0 checkouts
            const modelCounts = {};
            allModelNames.forEach(modelName => {
                modelCounts[modelName] = 0;
            });

            // 2. Get checkout movements for the current month
            const q = query(
                collection(db, "movimientos_cajas"),
                where("mes", "==", currentMonthISO),
                where("tipo", "==", "Salida")
            );

            const querySnapshot = await getDocs(q);

            // 3. Update counts with actual checkout data
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.modelName && modelCounts.hasOwnProperty(data.modelName)) {
                    modelCounts[data.modelName]++;
                }
            });

            const sortedModels = Object.entries(modelCounts).sort(([, a], [, b]) => b - a);
            currentBoxStatsData = sortedModels; // Store data for download

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
    };

    const renderStatsTable = (modelCounts) => {
        // modelCounts is already sorted here from loadMonthlyStats
        let tableHTML = `
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Modelo de Caja</th>
                        <th>Cantidad de Salidas</th>
                    </tr>
                </thead>
                <tbody>
        `;

        modelCounts.forEach(([modelName, count]) => {
            tableHTML += `
                <tr class="clickable-row" data-model-name="${modelName}">
                    <td>${modelName}</td>
                    <td>${count}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
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
            const now = new Date();
            const currentMonthISO = now.toISOString().slice(0, 7); // Formato YYYY-MM

            // 1. Get all possible items for this model from esquemas_modelos
            const schemaDocSnap = await getDoc(doc(db, "esquemas_modelos", modelName));

            let allPossibleItems = {};
            if (schemaDocSnap.exists()) {
                const schemaData = schemaDocSnap.data();
                Object.keys(schemaData).forEach(sanitizedItemName => {
                    // Initialize all items from schema with 0 consumption
                    allPossibleItems[sanitizedItemName] = 0;
                });
            }

            // 2. Get actual consumption data for the month
            const sanitizedModel = sanitizeFieldName(modelName); // Use the imported sanitizeFieldName function
            const statsDocRef = doc(db, "estadisticas_consumo", currentMonthISO);
            const docSnap = await getDoc(statsDocRef);

            if (docSnap.exists()) {
                const allConsumptionData = docSnap.data();
                const modelConsumptionData = allConsumptionData[sanitizedModel];

                if (modelConsumptionData) {
                    // Merge actual consumption data into allPossibleItems
                    Object.keys(modelConsumptionData).forEach(sanitizedItemName => {
                        allPossibleItems[sanitizedItemName] = modelConsumptionData[sanitizedItemName];
                    });
                }
            }

            // 3. Render the combined data
            if (Object.keys(allPossibleItems).length > 0) {
                currentItemConsumptionData = allPossibleItems; // Store data for download
                renderConsumedItems(allPossibleItems);
            } else {
                consumedItemsContainer.innerHTML = '<p>No se encontraron ítems definidos para este modelo o no hay datos de consumo.</p>';
                currentItemConsumptionData = {}; // Clear data if no results
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

    // Modal event listeners
    closeModalBtn?.addEventListener('click', () => {
        consumptionModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == consumptionModal) {
            consumptionModal.style.display = 'none';
        }
    });

    // Download button event listeners
    downloadBoxStatsBtn?.addEventListener('click', () => {
        const now = new Date();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const filename = `Salidas_Cajas_${monthNames[now.getMonth()]}_${now.getFullYear()}.csv`;

        let csvContent = "Modelo de Caja;Cantidad de Salidas\n";
        currentBoxStatsData.forEach(([modelName, count]) => {
            csvContent += `"${modelName}";${count}\n`;
        });
        downloadCSV(csvContent, filename);
    });

    downloadItemConsumptionBtn?.addEventListener('click', () => {
        const now = new Date();
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const modelNameForFile = modalTitle.textContent.replace('Consumo de Items para "', '').replace('"', ''); // Extract model name from modal title
        const filename = `Consumo_Items_${modelNameForFile}_${monthNames[now.getMonth()]}_${now.getFullYear()}.csv`;

        let csvContent = "Código;Descripción;Cantidad Consumida\n";
        const sortedItems = Object.entries(currentItemConsumptionData).sort(([, a], [, b]) => b - a);
        sortedItems.forEach(([sanitizedItemName, count]) => {
            const originalItemName = unSanitizeFieldName(sanitizedItemName);
            const [itemCode, itemDesc] = originalItemName.split(';');
            csvContent += `"${itemCode || ''}";"${itemDesc || ''}";${count}\n`;
        });
        downloadCSV(csvContent, filename);
    });

    // New function to load and render average tracing times
    const loadAndRenderAvgTracingTimes = async () => {
        if (!avgTracingTimeResultsDiv) return;

        avgTracingTimeResultsDiv.innerHTML = '<p>Cargando tiempos promedio...</p>';

        try {
            const querySnapshot = await getDocs(collection(db, "tracingTimes"));
            const modelDurations = {}; // { "Model A": [1000, 2000, 1500], ... }

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

                    // Format duration to human-readable string
                    const totalSeconds = Math.floor(averageMs / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    const milliseconds = Math.floor(averageMs % 1000);

                    let formattedTime = '';
                    if (minutes > 0) formattedTime += `${minutes}m `;
                    formattedTime += `${seconds}s`;
                    if (minutes === 0) formattedTime += ` ${milliseconds}ms`; // Show ms only if less than a minute

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

    // Event listener for the new button
    showAvgTracingTimeBtn?.addEventListener('click', loadAndRenderAvgTracingTimes);

    loadMonthlyStats();
});