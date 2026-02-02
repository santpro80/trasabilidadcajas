import { db, doc, getDoc } from './firebase-config.js';

const searchInput = document.getElementById('prestamo-search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');

// Función auxiliar para formatear fechas de manera legible
function formatDate(timestamp) {
    if (!timestamp) return 'Fecha desconocida';
    // Si es un objeto Timestamp de Firestore
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    // Si ya es una fecha o string
    return new Date(timestamp).toLocaleString('es-ES');
}

async function buscarPrestamo() {
    const prestamoNum = searchInput.value.trim();
    
    if (!prestamoNum) {
        alert("Por favor, ingresa un número de préstamo.");
        return;
    }

    // Resetear estados de la interfaz
    resultsContainer.innerHTML = '';
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';

    try {
        // Referencia al documento del préstamo en la colección 'prestamos'
        const docRef = doc(db, "prestamos", prestamoNum);
        const docSnap = await getDoc(docRef);

        loadingState.style.display = 'none';

        if (docSnap.exists()) {
            const data = docSnap.data();
            renderResult(prestamoNum, data);
        } else {
            // No se encontró el documento
            resultsContainer.innerHTML = `
                <div class="state-message" style="background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 15px; border-radius: 8px;">
                    <p style="margin: 0;">No se encontró ningún registro para el préstamo N° <strong>${prestamoNum}</strong>.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error al buscar el préstamo:", error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
    }
}

function renderResult(prestamoNum, data) {
    // 1. Determinar la lista de cajas (soporte para estructura nueva y antigua)
    let cajas = [];
    
    if (data.cajas && Array.isArray(data.cajas)) {
        // Estructura NUEVA: Array de cajas
        cajas = data.cajas;
    } else if (data.cajaSerie) {
        // Estructura ANTIGUA: Solo una caja en la raíz del documento
        cajas.push({
            cajaSerie: data.cajaSerie,
            modelName: data.modelName || 'Modelo no especificado'
        });
    }

    // 2. Construir el HTML de la tarjeta de resultados
    const card = document.createElement('div');
    card.className = 'result-card';

    // Encabezado de la tarjeta (Info del Préstamo)
    const headerHtml = `
        <div class="result-header" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; flex-wrap: wrap; gap: 10px;">
                <span class="caja-serie" style="color: #4285F4; font-size: 1.3em; display: flex; align-items: center; gap: 8px;">
                    📄 Préstamo #${prestamoNum}
                </span>
                <span class="movement-date" style="color: #555; font-size: 0.95em;">
                    📅 ${formatDate(data.timestamp)}
                </span>
            </div>
            <div class="movement-user" style="width: 100%; border-top: 1px solid #eee; padding-top: 8px; margin-top: 5px;">
                👤 Generado por: <strong>${data.usuarioNombre || data.usuarioEmail || 'Usuario desconocido'}</strong>
                ${data.usuarioEmail ? `<br><small style="color: #888; margin-left: 20px;">(${data.usuarioEmail})</small>` : ''}
            </div>
        </div>
    `;

    // Cuerpo de la tarjeta (Lista de Cajas)
    let bodyHtml = '<div class="movements">';
    
    if (cajas.length > 0) {
        bodyHtml += `
            <h4 style="margin: 5px 0 15px 0; color: #2c3e50; display: flex; align-items: center; gap: 8px;">
                📦 Cajas Asociadas (${cajas.length})
            </h4>
        `;
        
        cajas.forEach((caja, index) => {
            bodyHtml += `
                <div class="movement-item" style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 8px; transition: transform 0.2s;">
                    <span class="movement-label salida" style="background-color: #e8f0fe; color: #4285F4; padding: 4px 10px; border-radius: 20px; font-size: 0.85em; margin-right: 10px; min-width: auto;">
                        #${index + 1}
                    </span>
                    <div style="flex-grow: 1;">
                        <div style="font-weight: 700; font-size: 1.1em; color: #333;">${caja.cajaSerie}</div>
                        <div style="font-size: 0.9em; color: #666;">${caja.modelName}</div>
                    </div>
                </div>
            `;
        });
    } else {
        bodyHtml += `
            <div style="text-align: center; padding: 20px; color: #888; font-style: italic;">
                No se encontraron detalles de cajas para este préstamo.
            </div>
        `;
    }
    
    bodyHtml += '</div>';

    card.innerHTML = headerHtml + bodyHtml;
    resultsContainer.appendChild(card);
}

// Event Listeners
searchBtn.addEventListener('click', buscarPrestamo);

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        buscarPrestamo();
    }
});