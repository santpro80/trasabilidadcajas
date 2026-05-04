import { dbPedidos, collection, onSnapshot, query, orderBy } from './firebase-config-pedidos.js';
import { initApp } from './app.js';

let reportsOrders = [];
let reportSearchTerm = '';
let reportSectorFilter = '';
let reportStatusFilter = 'Completado';
let unsubscribeSnapshot = null;
let currentUserObj = null;

initApp().then((user) => {
    currentUserObj = user;
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.remove();

    const searchInput = document.getElementById('report-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            reportSearchTerm = e.target.value;
            updateReportsView();
        });
    }

    const sectorSelect = document.getElementById('filter-sector');
    if (sectorSelect) {
        sectorSelect.addEventListener('change', (e) => {
            reportSectorFilter = e.target.value;
            updateReportsView();
        });
    }

    if (unsubscribeSnapshot) unsubscribeSnapshot();

    // Query all orders ordered by descending timestamp
    const q = query(collection(dbPedidos, "orders"), orderBy('timestamp', 'desc'));
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        reportsOrders = snapshot.docs.map(doc => {
            const data = doc.data();
            let createdAtStr = data.createdAt;
            if (data.timestamp && data.timestamp.toDate) {
                createdAtStr = data.timestamp.toDate().toLocaleDateString('es-AR');
            }
            return {
                id: doc.id,
                ...data,
                createdAtStr
            };
        });
        updateReportsView();
    }, (error) => {
        console.error("Error cargando reporte: ", error);
        const container = document.getElementById('orders-high');
        if (container) container.innerHTML = '<p class="text-center text-rose-500 py-10 font-bold">Error cargando reporte.</p>';
    });
});

function renderOrderCard(order) {
    const priorityColor = order.priority === 'Alta' ? 'border-t-rose-500' :
        order.priority === 'Media' ? 'border-t-amber-500' :
            'border-t-emerald-500';

    return `
        <div class="bg-white dark:bg-surface-dark rounded-2xl p-5 relative border-b border-x border-t-4 ${priorityColor} border-x-slate-200 border-b-slate-200 dark:border-x-white/10 dark:border-b-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 group">
            <div class="flex justify-between items-start mb-2.5">
                <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-white/40">
                        <span class="material-symbols-outlined text-[13px]">id_card</span> ${order.orderNumber || '#ORD-' + (order.orderNum || 'N/A')}
                        <span class="mx-1">•</span>
                        <span class="text-emerald-500">${order.sector || 'Sin sector'}</span>
                    </div>
                    <h3 class="text-slate-900 dark:text-white text-sm font-black tracking-tight leading-tight">
                        ${order.item}
                    </h3>
                    <p class="text-villalba-blue dark:text-blue-400 text-[9px] font-bold uppercase tracking-widest">${order.createdAtStr || order.createdAt} - ${order.entity || 'Usuario'}</p>
                </div>
            </div>

            <div class="flex items-center justify-between mt-3 p-2 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                <div>
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CANTIDAD</p>
                    <p class="text-xs font-bold text-slate-900 dark:text-white">${order.quantity} <span class="text-[10px] text-slate-500 font-medium">${order.unit || 'UDS'}</span></p>
                </div>
                <div class="text-right">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">PROVEEDOR</p>
                    <p class="text-xs font-bold text-slate-900 dark:text-white uppercase truncate max-w-[120px]">${order.supplier || 'N/A'}</p>
                </div>
            </div>
            ${order.quotation && order.quotation > 0 ? `
            <div class="mt-2 flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                <p class="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">COTIZACI&Oacute;N</p>
                <p class="text-xs font-black text-emerald-700 dark:text-emerald-300">
                    ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: order.currency || 'ARS' }).format(order.quotation)}
                </p>
            </div>
            ` : ''}
        </div>
    `;
}

function updateReportsView() {
    // Filtrar por búsqueda, sector y SOLO pedidos COMPLETADOS
    const filteredOrders = reportsOrders.filter(order => {
        const matchesSearch =
            order.item?.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
            order.orderNum?.toString().includes(reportSearchTerm) ||
            order.orderNumber?.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
            order.entity?.toLowerCase().includes(reportSearchTerm.toLowerCase());

        const matchesSector = reportSectorFilter === '' || order.sector === reportSectorFilter;

        // El usuario quiere específicamente los completados
        const isCompleted = order.status === 'Completado';

        return matchesSearch && matchesSector && isCompleted;
    });

    const totalCountEl = document.getElementById('reports-total-count');
    if (totalCountEl) totalCountEl.innerText = `${filteredOrders.length} COMPLETADOS`;

    const containerHigh = document.getElementById('orders-high');
    const containerMedium = document.getElementById('orders-medium');
    const containerLow = document.getElementById('orders-low');
    const countAlta = document.getElementById('count-alta');
    const countMedia = document.getElementById('count-media');
    const countBaja = document.getElementById('count-baja');
    const noResultsMsg = document.getElementById('no-results-msg');

    const renderEmpty = '<div class="flex items-center justify-center p-8 bg-white/20 dark:bg-surface-dark/50 border-2 border-dashed border-white/20 dark:border-slate-800 rounded-2xl"><span class="text-xs font-bold text-white/60 dark:text-slate-500 uppercase tracking-widest">Vacio</span></div>';

    if (filteredOrders.length === 0) {
        if (noResultsMsg) noResultsMsg.classList.remove('hidden');
        if (containerHigh) containerHigh.innerHTML = renderEmpty;
        if (containerMedium) containerMedium.innerHTML = renderEmpty;
        if (containerLow) containerLow.innerHTML = renderEmpty;
        if (countAlta) countAlta.innerText = '0';
        if (countMedia) countMedia.innerText = '0';
        if (countBaja) countBaja.innerText = '0';
        return;
    }

    if (noResultsMsg) noResultsMsg.classList.add('hidden');

    const highPriority = filteredOrders.filter(o => o.priority === 'Alta');
    const medPriority = filteredOrders.filter(o => o.priority === 'Media');
    const lowPriority = filteredOrders.filter(o => (!o.priority || o.priority === 'Baja'));

    if (countAlta) countAlta.innerText = highPriority.length;
    if (countMedia) countMedia.innerText = medPriority.length;
    if (countBaja) countBaja.innerText = lowPriority.length;

    if (containerHigh) containerHigh.innerHTML = highPriority.length ? highPriority.map(renderOrderCard).join('') : renderEmpty;
    if (containerMedium) containerMedium.innerHTML = medPriority.length ? medPriority.map(renderOrderCard).join('') : renderEmpty;
    if (containerLow) containerLow.innerHTML = lowPriority.length ? lowPriority.map(renderOrderCard).join('') : renderEmpty;
}

window.reports = {
    exportToCSV: () => {
        const filtered = getFilteredOrders();
        const headers = ["ID Orden", "Producto", "Sector", "Prioridad", "Cantidad", "Unidad", "Solicitante", "Fecha Creacion", "Fecha Entrega", "Proveedor", "Cotización"];
        const rows = filtered.map(o => [
            o.orderNumber || `#ORD-${o.orderNum}`,
            o.item,
            o.sector || 'Sin Asignar',
            o.priority,
            o.quantity,
            o.unit,
            o.entity,
            o.createdAtStr || o.createdAt,
            o.deliveryDate || 'N/A',
            o.supplier || 'N/A',
            o.quotation || o.cotizacion || '0'
        ]);

        // Usar punto y coma para Excel (localización español) y agregar BOM para UTF-8
        const csvContent = "\uFEFF" + [headers, ...rows]
            .map(e => e.map(cell => `"${cell}"`).join(";"))
            .join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `archivo_ingenieria_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

function getFilteredOrders() {
    return reportsOrders.filter(order => {
        const matchesSearch =
            order.item?.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
            order.orderNum?.toString().includes(reportSearchTerm) ||
            order.orderNumber?.toLowerCase().includes(reportSearchTerm.toLowerCase()) ||
            order.entity?.toLowerCase().includes(reportSearchTerm.toLowerCase());

        const matchesSector = reportSectorFilter === '' || order.sector === reportSectorFilter;

        // Solo exportar completados en esta vista de archivo
        return matchesSearch && matchesSector && order.status === 'Completado';
    });
}
