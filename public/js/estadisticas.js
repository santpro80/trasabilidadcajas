import { db, collection, query, where, getDocs } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const statsContainer = document.getElementById('stats-container');
    const monthTitle = document.getElementById('month-title');

    const loadMonthlyStats = async () => {
        if (!statsContainer || !monthTitle) {
            console.error("Required elements for statistics are not found on the page.");
            return;
        }

        statsContainer.innerHTML = '<p>Cargando estadísticas...</p>';

        try {
            const now = new Date();
            const currentMonthISO = now.toISOString().slice(0, 7); 
            
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            monthTitle.textContent = `Salidas de Cajas - ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

            const q = query(
                collection(db, "movimientos_cajas"),
                where("mes", "==", currentMonthISO),
                where("tipo", "==", "Salida")
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                statsContainer.innerHTML = '<p>No se encontraron salidas de cajas para este mes.</p>';
                return;
            }

            const modelCounts = {};
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.modelName) {
                    modelCounts[data.modelName] = (modelCounts[data.modelName] || 0) + 1;
                }
            });

            renderStatsTable(modelCounts);

        } catch (error) {
            console.error("Error al cargar las estadísticas:", error);
            statsContainer.innerHTML = '<p>Ocurrió un error al cargar las estadísticas.</p>';
        }
    };

    const renderStatsTable = (modelCounts) => {
        // Convert to array and sort by count descending
        const sortedModels = Object.entries(modelCounts).sort(([, a], [, b]) => b - a);

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

        sortedModels.forEach(([modelName, count]) => {
            tableHTML += `
                <tr>
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
    };

    loadMonthlyStats();
});