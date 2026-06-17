import { db, collection, query, onSnapshot, orderBy, limit, requireDepositoAuth } from './firebase-config-deposito.js';

let todosLosIntentos = [];
let filtroTexto = '';

const renderTabla = () => {
    const tbody = document.getElementById('tabla-body');
    const contador = document.getElementById('contador-movimientos');
    const mostrando = document.getElementById('mostrando-texto');

    const renderEmpty = '<tr><td colspan="6" class="py-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No hay intentos fallidos registrados</td></tr>';

    let filtrados = todosLosIntentos;

    if (filtroTexto) {
        const textLower = filtroTexto.toLowerCase();
        filtrados = filtrados.filter(m => 
            m.codigo.toLowerCase().includes(textLower) || 
            (m.descripcion && m.descripcion.toLowerCase().includes(textLower)) ||
            (m.usuarioNombre && m.usuarioNombre.toLowerCase().includes(textLower)) ||
            (m.usuario && m.usuario.toLowerCase().includes(textLower))
        );
    }

    if (contador) {
        contador.textContent = `${filtrados.length} REGISTROS`;
        contador.classList.remove('hidden');
    }
    if (mostrando) {
        mostrando.textContent = `Mostrando ${filtrados.length} intentos rechazados`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = renderEmpty;
        return;
    }

    tbody.innerHTML = filtrados.map(m => {
        const fechaObj = m.timestamp ? m.timestamp.toDate() : new Date();
        const fechaStr = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <p class="text-xs font-bold text-slate-900 dark:text-white">${fechaStr}</p>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${horaStr}</p>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <span class="text-xs font-black text-rose-600 dark:text-rose-400 tracking-widest">${m.codigo}</span>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <div class="flex flex-col">
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-md" title="${m.descripcion}">${m.descripcion || 'Sin descripción'}</p>
                    </div>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 text-center font-bold text-rose-600 dark:text-rose-400">
                    ${m.cantidad}
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 text-center font-bold text-slate-500">
                    ${m.stockDisponible ?? 0}
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 text-right">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[150px] inline-block" title="${m.usuario || ''}">${m.usuarioNombre || m.usuario || 'Desconocido'}</span>
                </td>
            </tr>
        `;
    }).join('');
};

let selectedWarehouse = ''; // 'no_esteril_terminado' | 'esteril_terminado' | 'semi_elaborado' | 'materia_prima'
let unsubscribe = null;

const setupRealtimeListener = () => {
    if (unsubscribe) unsubscribe();
    if (!selectedWarehouse) return;

    // Limitar a 200 registros de intentos fallidos
    const q = query(collection(db, `deposito_egresos_fallidos_${selectedWarehouse}`), orderBy('timestamp', 'desc'), limit(200));
    unsubscribe = onSnapshot(q, (snap) => {
        todosLosIntentos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTabla();
    }, (error) => {
        console.error("Error fetching egresos fallidos", error);
        document.getElementById('tabla-body').innerHTML = '<tr><td colspan="6" class="py-16 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error de conexión - Ver permisos</td></tr>';
    });
};

const showHistoryView = (warehouseName, labelText) => {
    selectedWarehouse = warehouseName;
    document.getElementById('historial-title-text').textContent = `Egresos Fallidos: ${labelText}`;
    
    // Toggle screens
    document.getElementById('warehouse-choice-screen').classList.add('hidden');
    document.getElementById('historial-main-container').classList.remove('hidden');
    document.getElementById('historial-main-container').classList.add('flex');
    
    setupRealtimeListener();
};

const showChoiceScreen = () => {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    selectedWarehouse = '';
    document.getElementById('historial-main-container').classList.add('hidden');
    document.getElementById('historial-main-container').classList.remove('flex');
    document.getElementById('warehouse-choice-screen').classList.remove('hidden');
    
    todosLosIntentos = [];
    document.getElementById('buscador-historial').value = '';
    filtroTexto = '';
    document.getElementById('tabla-body').innerHTML = '<tr><td colspan="6" class="py-20 text-center"><span class="material-symbols-outlined text-4xl animate-spin text-rose-500">sync</span></td></tr>';
};

const setupApp = () => {
    // Bind choice screen buttons
    document.getElementById('choice-no-esteril-terminado').addEventListener('click', () => showHistoryView('no_esteril_terminado', 'No Estéril Terminado'));
    document.getElementById('choice-esteril-terminado').addEventListener('click', () => showHistoryView('esteril_terminado', 'Estéril Terminado'));
    document.getElementById('choice-semi-elaborado').addEventListener('click', () => showHistoryView('semi_elaborado', 'Semi Elaborado'));
    document.getElementById('choice-materia-prima').addEventListener('click', () => showHistoryView('materia_prima', 'Materia Prima'));
    
    // Bind back button
    document.getElementById('btn-back-to-choices').addEventListener('click', showChoiceScreen);

    const buscarInput = document.getElementById('buscador-historial');

    buscarInput.addEventListener('input', (e) => {
        filtroTexto = e.target.value.trim();
        renderTabla();
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor', 'operario']);
        const nameEl = document.getElementById('user-display-name');
        if (nameEl && authData) {
            nameEl.textContent = authData.userData.name || authData.user.email || 'USUARIO';
        }
        setupApp();
    } catch (e) {
        console.error(e);
    }
});
