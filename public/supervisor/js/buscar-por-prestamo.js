import { db, doc, getDoc, collection, query, where, getDocs, orderBy, limit } from './firebase-config.js';

const searchInput = document.getElementById('prestamo-search-input');
const searchBtn = document.getElementById('search-btn');
const menuBtn = document.getElementById('menu-btn');
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

function formatDateShort(timestamp) {
    if (!timestamp) return 'Actualidad';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
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

        if (docSnap.exists()) {
            const data = docSnap.data();
            await renderResult(prestamoNum, data);
            loadingState.style.display = 'none';
        } else {
            // No se encontró el documento
            resultsContainer.innerHTML = `
                <div class="state-message" style="background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 15px; border-radius: 8px;">
                    <p style="margin: 0;">No se encontró ningún registro para el préstamo N° <strong>${prestamoNum}</strong>.</p>
                </div>
            `;
            loadingState.style.display = 'none';
        }
    } catch (error) {
        console.error("Error al buscar el préstamo:", error);
        loadingState.style.display = 'none';
        errorState.style.display = 'block';
    }
}

async function renderResult(prestamoNum, data) {
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
        
        // Procesamos cada caja para buscar sus fechas de entrada/salida y consumos
        // Usamos Promise.all para que sea rápido y paralelo
        const boxPromises = cajas.map(caja => getBoxDetails(caja, prestamoNum, data.timestamp, data.usuarioNombre || data.usuarioEmail));
        const boxDetailsList = await Promise.all(boxPromises);

        boxDetailsList.forEach((details, index) => {
            bodyHtml += renderBoxItem(details, index);
        });
    } else {
        bodyHtml += `
            <div style="text-align: center; padding: 20px; color: #888; font-style: italic;">
                No se encontraron detalles de cajas para este préstamo.
            </div>
        `;
    }
    
    bodyHtml += '</div>';

    // Limpiamos y construimos la tarjeta final
    card.innerHTML = '';
    card.insertAdjacentHTML('beforeend', headerHtml);
    card.insertAdjacentHTML('beforeend', bodyHtml);
    
    resultsContainer.appendChild(card);
}

// Función para obtener los detalles profundos de cada caja (Salida, Entrada, Consumos)
async function getBoxDetails(caja, prestamoNum, loanTimestamp, loanUser) {
    const result = {
        cajaSerie: caja.cajaSerie,
        modelName: caja.modelName,
        salida: null,
        salidaUser: null,
        entrada: null,
        entradaUser: null,
        consumos: []
    };

    try {
        // A. Buscar la fecha exacta de SALIDA para esta caja y préstamo
        const qSalida = query(
            collection(db, "movimientos_cajas"),
            where("prestamoNum", "==", prestamoNum),
            where("cajaSerie", "==", caja.cajaSerie),
            where("tipo", "==", "Salida"),
            limit(1)
        );
        const snapSalida = await getDocs(qSalida);
        
        let salidaTime = null;
        if (!snapSalida.empty) {
            salidaTime = snapSalida.docs[0].data().timestamp;
            result.salidaUser = snapSalida.docs[0].data().usuarioNombre || snapSalida.docs[0].data().usuarioEmail;
        } else {
            // Si no encontramos el movimiento exacto, usamos la fecha general del préstamo
            salidaTime = loanTimestamp;
            result.salidaUser = loanUser;
        }
        result.salida = salidaTime;

        if (!salidaTime) return result;

        // B. Buscar la siguiente ENTRADA (Retorno) después de la salida
        const qEntrada = query(
            collection(db, "movimientos_cajas"),
            where("cajaSerie", "==", caja.cajaSerie),
            where("tipo", "==", "Entrada"),
            where("timestamp", ">", salidaTime),
            orderBy("timestamp", "asc"),
            limit(1)
        );
        const snapEntrada = await getDocs(qEntrada);
        
        if (!snapEntrada.empty) {
            result.entrada = snapEntrada.docs[0].data().timestamp;
            result.entradaUser = snapEntrada.docs[0].data().usuarioNombre || snapEntrada.docs[0].data().usuarioEmail;
        }

        // C. Buscar Ítems Consumidos (Historial de cambios a "REEMPLAZAR")
        // Buscamos en el historial cualquier cambio ocurrido DESPUÉS de que salió la caja.
        // NOTA: Quitamos el filtro de timestamp de la query para evitar problemas de índices en Firebase.
        // Filtramos por fecha manualmente aquí abajo.
        const qHistorial = query(
            collection(db, "historial"),
            where("detalles.cajaSerie", "==", caja.cajaSerie)
        );
        
        const snapHistorial = await getDocs(qHistorial);
        
        snapHistorial.forEach(doc => {
            const h = doc.data();
            
            // Filtrado manual de fecha para asegurar que el consumo fue DESPUÉS de la salida
            const hDate = h.timestamp?.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
            const sDate = salidaTime?.toDate ? salidaTime.toDate() : new Date(salidaTime);
            if (hDate < sDate) return;

            // Filtramos: Solo nos interesan modificaciones donde el valor nuevo sea "REEMPLAZAR"
            // Y que hayan ocurrido antes de la siguiente salida (si es que hubo otra), 
            // pero para simplificar asumimos que son relevantes si ocurrieron después de esta salida.
            if (h.accion === 'MODIFICACIÓN DE ÍTEM' && h.detalles && h.detalles.valorNuevo === 'REEMPLAZAR') {
                
                // Si ya volvió la caja, verificamos que el consumo no sea de una fecha muy posterior (ej. otro préstamo futuro)
                // Damos un margen de 1 día después de la entrada por si el chequeo se hizo al día siguiente.
                // Si no ha vuelto (entrada es null), mostramos todo lo que haya pasado hasta hoy.
                let isRelevant = true;
                if (result.entrada) {
                    const entradaDate = result.entrada.toDate ? result.entrada.toDate() : new Date(result.entrada);
                    const historialDate = h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
                    // Si el historial es más de 2 días posterior a la entrada, probablemente sea de otro ciclo.
                    const diffTime = Math.abs(historialDate - entradaDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    if (historialDate > entradaDate && diffDays > 2) {
                        isRelevant = false;
                    }
                }

                if (isRelevant) {
                    result.consumos.push({
                        codigoDesc: h.detalles.itemDescripcion, // Viene como "CODIGO;DESCRIPCION"
                        serieAnterior: h.detalles.valorAnterior,
                        fecha: h.timestamp
                    });
                }
            }
        });

    } catch (e) {
        console.error("Error obteniendo detalles de la caja:", e);
    }
    return result;
}

function renderBoxItem(details, index) {
    const salidaStr = formatDate(details.salida);
    const entradaStr = details.entrada ? formatDate(details.entrada) : '<span style="color: #e67e22; font-weight: bold;">⚠️ Pendiente de retorno</span>';
    
    let consumosHtml = '';
    if (details.consumos.length > 0) {
        const periodoTexto = `${formatDateShort(details.salida)} al ${formatDateShort(details.entrada)}`;
        
        consumosHtml = `<div style="margin-top: 20px; padding: 15px; background: #fff5f5; border-radius: 8px; border: 1px solid #f5c6cb;">
            <div style="font-size: 1em; color: #721c24; font-weight: bold; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #f5c6cb; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Ítems Consumidos
                </div>
                <span style="font-size: 0.85em; font-weight: normal; color: #a71d2a; background: #fff; padding: 2px 8px; border-radius: 10px; border: 1px solid #f5c6cb;">Periodo: ${periodoTexto}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">`;
        
        details.consumos.forEach(c => {
            const parts = (c.codigoDesc || '').split(';');
            const code = parts[0] || '?';
            const desc = parts[1] || '?';
            const fechaConsumo = formatDate(c.fecha);
            
            consumosHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 15px; border-radius: 6px; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700; color: #333; font-size: 1.1em;">${code}</span>
                        <span style="font-size: 0.95em; color: #666;">${desc}</span>
                        <span style="font-size: 0.85em; color: #555; margin-top: 3px; display: flex; align-items: center; gap: 5px;">
                            📅 ${fechaConsumo}
                        </span>
                    </div>
                    <div style="text-align: right; min-width: 140px;">
                        <span style="display: block; font-size: 0.75em; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Serie Anterior</span>
                        <span style="display: inline-block; font-size: 1.4em; font-weight: 800; color: #12a78e; background-color: #ffebee; padding: 6px 12px; border-radius: 6px; border: 1px solid #ffcdd2;">
                            ${c.serieAnterior}
                        </span>
                    </div>
                </div>`;
        });
        consumosHtml += `</div></div>`;
    }

    return `
        <div class="movement-item" style="background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #e0e0e0; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: flex-start; gap: 15px;">
                <span class="movement-label salida" style="background-color: #e8f0fe; color: #4285F4; padding: 6px 14px; border-radius: 20px; font-size: 1em; font-weight: bold; min-width: auto; height: fit-content;">
                    #${index + 1}
                </span>
                <div style="flex-grow: 1; width: 100%;">
                    <div style="margin-bottom: 15px;">
                        <div style="font-weight: 800; font-size: 1.4em; color: #2c3e50;">${details.cajaSerie}</div>
                        <div style="font-size: 1em; color: #555;">${details.modelName}</div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
                        <div style="border-right: 1px solid #e0e0e0; padding-right: 10px;">
                            <span style="display: block; color: #666; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Salida</span>
                            <span style="font-size: 1.1em; color: #333; font-weight: 600; display: block; margin-bottom: 4px;">${salidaStr}</span>
                            <div style="font-size: 0.9em; color: #555; display: flex; align-items: center; gap: 5px;">
                                👤 ${details.salidaUser || 'N/A'}
                            </div>
                        </div>
                        <div style="padding-left: 10px;">
                            <span style="display: block; color: #666; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Entrada</span>
                            <span style="font-size: 1.1em; color: #333; font-weight: 600; display: block; margin-bottom: 4px;">${entradaStr}</span>
                            ${details.entrada ? `<div style="font-size: 0.9em; color: #555; display: flex; align-items: center; gap: 5px;">👤 ${details.entradaUser || 'N/A'}</div>` : ''}
                        </div>
                    </div>

                    ${consumosHtml}
                </div>
            </div>
        </div>
    `;
}

// Event Listeners
searchBtn.addEventListener('click', buscarPrestamo);

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        buscarPrestamo();
    }
});

if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
}