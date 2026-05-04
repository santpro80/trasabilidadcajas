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
    loadingState.classList.remove('hidden');
    loadingState.classList.add('flex');
    emptyState.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        // Referencia al documento del préstamo en la colección 'prestamos'
        const docRef = doc(db, "prestamos", prestamoNum);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            await renderResult(prestamoNum, data);
            loadingState.classList.add('hidden');
            loadingState.classList.remove('flex');
        } else {
            // No se encontró el documento
            resultsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 glass-card rounded-[2rem] border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10">
                    <span class="material-symbols-outlined text-4xl mb-3 text-amber-500">search_off</span>
                    <p class="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 text-center">
                        No se encontró ningún registro para el préstamo N° <span class="text-amber-700 dark:text-amber-400 font-black">${prestamoNum}</span>
                    </p>
                </div>
            `;
            loadingState.classList.add('hidden');
            loadingState.classList.remove('flex');
        }
    } catch (error) {
        console.error("Error al buscar el préstamo:", error);
        loadingState.classList.add('hidden');
        loadingState.classList.remove('flex');
        errorState.classList.remove('hidden');
        errorState.classList.add('flex');
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
    card.className = 'glass-card rounded-[2rem] border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-xl';

    // Encabezado de la tarjeta (Info del Préstamo)
    const headerHtml = `
        <div class="p-6 md:p-8 bg-slate-50 dark:bg-surface-dark/50 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue">
                        <span class="material-symbols-outlined">description</span>
                    </div>
                    <span class="text-xl md:text-2xl font-black text-villalba-blue dark:text-blue-400 tracking-tight">
                        Préstamo #${prestamoNum}
                    </span>
                </div>
                <div class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span class="material-symbols-outlined text-[18px]">calendar_today</span>
                    <span class="text-xs font-bold tracking-widest uppercase">${formatDate(data.timestamp)}</span>
                </div>
            </div>
            <div class="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest pt-2">
                <span class="material-symbols-outlined text-[16px]">person</span>
                Generado por: <span class="text-slate-800 dark:text-slate-200 ml-1">${data.usuarioNombre || data.usuarioEmail || 'Usuario desconocido'}</span>
                ${data.usuarioEmail ? `<span class="text-slate-400 lowercase ml-1 tracking-normal">(${data.usuarioEmail})</span>` : ''}
            </div>
        </div>
    `;

    // Cuerpo de la tarjeta (Lista de Cajas)
    let bodyHtml = '<div class="p-6 md:p-8 flex flex-col gap-6">';
    
    if (cajas.length > 0) {
        bodyHtml += `
            <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-4">
                <span class="material-symbols-outlined text-villalba-blue">inventory_2</span>
                Cajas Asociadas (${cajas.length})
            </h4>
            <div class="flex flex-col gap-6">
        `;
        
        // Procesamos cada caja para buscar sus fechas de entrada/salida y consumos
        const boxPromises = cajas.map(caja => getBoxDetails(caja, prestamoNum, data.timestamp, data.usuarioNombre || data.usuarioEmail));
        const boxDetailsList = await Promise.all(boxPromises);

        boxDetailsList.forEach((details, index) => {
            bodyHtml += renderBoxItem(details, index);
        });
        
        bodyHtml += `</div>`;
    } else {
        bodyHtml += `
            <div class="flex flex-col items-center justify-center py-10">
                <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">inventory</span>
                <span class="text-xs font-bold uppercase tracking-widest text-slate-400">No se encontraron cajas asociadas</span>
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

        // C. Buscar la siguiente SALIDA para delimitar el ciclo (Evitar que consumos del siguiente préstamo aparezcan aquí)
        let nextSalidaTime = null;
        if (result.entrada) {
            const qNextSalida = query(
                collection(db, "movimientos_cajas"),
                where("cajaSerie", "==", caja.cajaSerie),
                where("tipo", "==", "Salida"),
                where("timestamp", ">", result.entrada),
                orderBy("timestamp", "asc"),
                limit(1)
            );
            const snapNextSalida = await getDocs(qNextSalida);
            if (!snapNextSalida.empty) {
                nextSalidaTime = snapNextSalida.docs[0].data().timestamp;
            }
        }

        // D. Buscar Ítems Consumidos (Historial de cambios a "REEMPLAZAR")
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
            if (h.accion === 'MODIFICACIÓN DE ÍTEM' && h.detalles && h.detalles.valorNuevo === 'REEMPLAZAR') {
                
                let isRelevant = true;
                if (result.entrada) {
                    const entradaDate = result.entrada.toDate ? result.entrada.toDate() : new Date(result.entrada);
                    const historialDate = h.timestamp.toDate ? h.timestamp.toDate() : new Date(h.timestamp);
                    
                    // 1. Si existe una salida posterior (nuevo ciclo), el consumo debe ser ANTERIOR a esa salida.
                    if (nextSalidaTime) {
                        const nextSalidaDate = nextSalidaTime.toDate ? nextSalidaTime.toDate() : new Date(nextSalidaTime);
                        if (historialDate >= nextSalidaDate) {
                            isRelevant = false;
                        }
                    }

                    // 2. Si el historial es más de 2 días posterior a la entrada, probablemente sea de otro ciclo o mantenimiento tardío.
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
    const entradaStr = details.entrada ? formatDate(details.entrada) : '<span class="text-amber-500 flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">warning</span> Pendiente de retorno</span>';
    
    let consumosHtml = '';
    if (details.consumos.length > 0) {
        const periodoTexto = `${formatDateShort(details.salida)} al ${formatDateShort(details.entrada)}`;
        
        consumosHtml = `
            <div class="mt-6 rounded-2xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 overflow-hidden">
                <div class="px-5 py-3 border-b border-rose-100 dark:border-rose-500/20 flex items-center justify-between bg-rose-100/50 dark:bg-rose-500/10">
                    <div class="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest text-xs">
                        <span class="material-symbols-outlined text-[18px]">build</span>
                        Ítems Consumidos
                    </div>
                    <span class="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold text-[10px] tracking-widest uppercase shadow-sm">
                        Ciclo: ${periodoTexto}
                    </span>
                </div>
                <div class="p-5 flex flex-col gap-3">
        `;
        
        details.consumos.forEach(c => {
            const parts = (c.codigoDesc || '').split(';');
            const code = parts[0] || '?';
            const desc = parts[1] || '?';
            const fechaConsumo = formatDate(c.fecha);
            
            consumosHtml += `
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                    <div class="flex flex-col gap-1">
                        <span class="font-black text-slate-800 dark:text-white text-base">${code}</span>
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">${desc}</span>
                        <span class="text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                            <span class="material-symbols-outlined text-[14px]">event</span> ${fechaConsumo}
                        </span>
                    </div>
                    <div class="flex flex-col items-end shrink-0">
                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Serie Retirada</span>
                        <span class="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black tracking-widest border border-rose-200 dark:border-rose-500/20">
                            ${c.serieAnterior}
                        </span>
                    </div>
                </div>
            `;
        });
        consumosHtml += `</div></div>`;
    }

    return `
        <div class="relative bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-700 p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow group">
            <div class="absolute -top-3 -left-3 size-8 rounded-xl bg-villalba-blue text-white flex items-center justify-center font-black shadow-lg shadow-villalba-blue/30 text-sm">
                ${index + 1}
            </div>
            
            <div class="ml-4 md:ml-6">
                <div class="mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <h3 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">${details.cajaSerie}</h3>
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">${details.modelName}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-black/20 p-4 md:p-5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <div class="flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 pb-4 md:pb-0 md:pr-4">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">logout</span> Salida
                        </span>
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${salidaStr}</span>
                        <span class="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">person</span> ${details.salidaUser || 'N/A'}
                        </span>
                    </div>
                    <div class="flex flex-col pt-4 md:pt-0 md:pl-4">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">login</span> Entrada
                        </span>
                        <span class="font-bold text-slate-800 dark:text-slate-200 text-sm">${entradaStr}</span>
                        ${details.entrada ? `
                        <span class="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                            <span class="material-symbols-outlined text-[14px]">person</span> ${details.entradaUser || 'N/A'}
                        </span>` : ''}
                    </div>
                </div>

                ${consumosHtml}
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