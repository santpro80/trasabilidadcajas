import { db, collection, query, onSnapshot, orderBy, limit, requireDepositoAuth } from './firebase-config-deposito.js';

let todosLosMovimientos = [];
let filtroTexto = '';
let filtroTipoSelect = 'Todos';

const renderTabla = () => {
    const tbody = document.getElementById('tabla-body');
    const contador = document.getElementById('contador-movimientos');
    const mostrando = document.getElementById('mostrando-texto');

    const renderEmpty = '<tr><td colspan="6" class="py-16 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No hay movimientos registrados</td></tr>';

    let filtrados = todosLosMovimientos;

    if (filtroTipoSelect !== 'Todos') {
        filtrados = filtrados.filter(m => m.tipo === filtroTipoSelect);
    }

    if (filtroTexto) {
        const textLower = filtroTexto.toLowerCase();
        filtrados = filtrados.filter(m => 
            m.codigo.toLowerCase().includes(textLower) || 
            (m.descripcion && m.descripcion.toLowerCase().includes(textLower))
        );
    }

    if (contador) {
        contador.textContent = `${filtrados.length} REGISTROS`;
        contador.classList.remove('hidden');
    }
    if (mostrando) {
        mostrando.textContent = `Mostrando ${filtrados.length} movimientos`;
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = renderEmpty;
        return;
    }

    tbody.innerHTML = filtrados.map(m => {
        const fechaObj = m.timestamp ? m.timestamp.toDate() : new Date();
        const fechaStr = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const esIngreso = m.tipo === 'Ingreso';
        const colorBadge = esIngreso ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <p class="text-xs font-bold text-slate-900 dark:text-white">${fechaStr}</p>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">${horaStr}</p>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${colorBadge}">${m.tipo}</span>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <span class="text-xs font-black text-villalba-blue dark:text-blue-400 tracking-widest">${m.codigo}</span>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80">
                    <p class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-md" title="${m.descripcion}">${m.descripcion || 'Sin descripción'}</p>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 text-center">
                    <span class="text-sm font-black text-slate-900 dark:text-white">${m.cantidad}</span>
                </td>
                <td class="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 text-right">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[150px] inline-block" title="${m.usuario || ''}">${m.usuarioNombre || m.usuario || 'Desconocido'}</span>
                </td>
            </tr>
        `;
    }).join('');
};

const setupListeners = () => {
    const buscarInput = document.getElementById('buscador-historial');
    const tipoSelect = document.getElementById('filtro-tipo');

    buscarInput.addEventListener('input', (e) => {
        filtroTexto = e.target.value.trim();
        renderTabla();
    });

    tipoSelect.addEventListener('change', (e) => {
        filtroTipoSelect = e.target.value;
        renderTabla();
    });

    // Limitar a 200 movimientos para evitar consumo excesivo de lecturas en Firestore
    const q = query(collection(db, 'deposito_movimientos'), orderBy('timestamp', 'desc'), limit(200));
    onSnapshot(q, (snap) => {
        todosLosMovimientos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTabla();
    }, (error) => {
        console.error("Error fetching historial", error);
        document.getElementById('tabla-body').innerHTML = '<tr><td colspan="6" class="py-16 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error de conexión - Ver permisos</td></tr>';
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await requireDepositoAuth(['supervisor', 'operario']);
        setupListeners();
    } catch (e) {
        console.error(e);
    }
});
