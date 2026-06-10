import { db, collection, query, onSnapshot, orderBy, limit, requireDepositoAuth } from './firebase-config-deposito.js';

let todosLosMovimientos = [];
let filtroTexto = '';
let filtroTipoSelect = 'Todos';

let currentLimit = 100;
let isFetching = false;
let allLoaded = false;
let unsubscribe = null;

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
        if (isFetching) {
            mostrando.textContent = `Cargando más movimientos... (Mostrando ${filtrados.length})`;
        } else if (allLoaded) {
            mostrando.textContent = `Mostrando ${filtrados.length} movimientos. Fin del registro.`;
        } else {
            mostrando.textContent = `Mostrando ${filtrados.length} movimientos. Desliza para cargar más.`;
        }
    }

    if (filtrados.length === 0) {
        tbody.innerHTML = renderEmpty;
        return;
    }

    tbody.innerHTML = filtrados.map(m => {
        const fechaObj = m.timestamp ? m.timestamp.toDate() : new Date();
        const fechaStr = fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaStr = fechaObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        let colorBadge = 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        if (m.tipo === 'Ingreso') {
            colorBadge = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
        } else if (m.tipo === 'Egreso') {
            colorBadge = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
        } else if (m.tipo === 'Ajuste') {
            colorBadge = 'bg-orange-500/10 text-orange-500 border-orange-500/20';
        }

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
                    <div class="flex flex-col">
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-md" title="${m.descripcion}">${m.descripcion || 'Sin descripción'}</p>
                        ${m.detalle ? `<p class="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5" title="${m.detalle}">${m.detalle}</p>` : ''}
                    </div>
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

const setupRealtimeListener = () => {
    if (unsubscribe) unsubscribe();

    isFetching = true;
    const mostrando = document.getElementById('mostrando-texto');
    if (mostrando) mostrando.textContent = `Cargando movimientos...`;

    const q = query(collection(db, 'deposito_movimientos'), orderBy('timestamp', 'desc'), limit(currentLimit));
    unsubscribe = onSnapshot(q, (snap) => {
        todosLosMovimientos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (snap.docs.length < currentLimit) {
            allLoaded = true;
        } else {
            allLoaded = false;
        }
        
        isFetching = false;
        renderTabla();
    }, (error) => {
        console.error("Error fetching historial", error);
        document.getElementById('tabla-body').innerHTML = '<tr><td colspan="6" class="py-16 text-center text-rose-500 font-bold uppercase tracking-widest text-xs">Error de conexión - Ver permisos</td></tr>';
        isFetching = false;
    });
};

const handleScroll = () => {
    if (isFetching || allLoaded) return;

    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainer;
    
    // Detectar scroll en el contenedor interno
    const reachedContainerBottom = scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 100;
    
    // Detectar scroll a nivel de ventana (mobile/fallback)
    const doc = document.documentElement;
    const reachedWindowBottom = doc.scrollHeight > window.innerHeight && doc.scrollTop + window.innerHeight >= doc.scrollHeight - 100;

    if (reachedContainerBottom || reachedWindowBottom) {
        currentLimit += 100;
        setupRealtimeListener();
    }
};

const setupListeners = () => {
    const buscarInput = document.getElementById('buscador-historial');
    const tipoSelect = document.getElementById('filtro-tipo');
    const tableContainer = document.querySelector('.table-container');

    buscarInput.addEventListener('input', (e) => {
        filtroTexto = e.target.value.trim();
        renderTabla();
    });

    tipoSelect.addEventListener('change', (e) => {
        filtroTipoSelect = e.target.value;
        renderTabla();
    });

    if (tableContainer) {
        tableContainer.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);

    setupRealtimeListener();
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await requireDepositoAuth(['supervisor', 'operario']);
        setupListeners();
    } catch (e) {
        console.error(e);
    }
});
