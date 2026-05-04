import { dbPedidos, collection, onSnapshot, query, doc, deleteDoc } from './firebase-config-pedidos.js';
import { initApp } from './app.js';

let myOrders = [];

let currentTab = 'Pendiente';

window.switchTab = function (tabName) {
    currentTab = tabName;

    // Update active visual state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'border-slate-200', 'dark:border-slate-700');
        btn.classList.add('opacity-70', 'hover:bg-slate-50', 'dark:hover:bg-slate-800/50', 'border-transparent');
        btn.querySelector('span:first-child').classList.remove('text-villalba-blue');
        btn.querySelector('span:first-child').classList.add('text-slate-500');
    });

    let activeBtnPrefix = tabName === 'Pendiente' ? 'nuevas' : tabName === 'En revisión' ? 'revision' : 'aprobados';
    let btn = document.getElementById('tab-' + activeBtnPrefix);
    if (btn) {
        btn.classList.remove('opacity-70', 'hover:bg-slate-50', 'dark:hover:bg-slate-800/50', 'border-transparent');
        btn.classList.add('bg-white', 'dark:bg-slate-800', 'shadow-sm', 'border-slate-200', 'dark:border-slate-700');
        btn.querySelector('span:first-child').classList.remove('text-slate-500');
        btn.querySelector('span:first-child').classList.add('text-villalba-blue');
    }

    updateOperatorOrdersList();
};

let searchQuery = '';
let unsubscribeSnapshot = null;
let currentUserObj = null;

initApp().then((user) => {
    currentUserObj = user;

    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('operator-content').classList.remove('hidden');

    const searchInput = document.getElementById('operator-search');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateOperatorOrdersList();
    });

    if (unsubscribeSnapshot) unsubscribeSnapshot();

    if (!user || !user.uid) {
        document.getElementById('operator-orders-list').innerHTML = '<p class="text-center text-rose-500 py-10 font-bold">Error de usuario. Vuelve a iniciar sesión.</p>';
        return;
    }

    // Panel Admin -> Muestra todo
    const q = query(collection(dbPedidos, "orders"));
    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        myOrders = snapshot.docs.map(doc => {
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

        myOrders.sort((a, b) => {
            const tA = a.timestamp?.seconds || 0;
            const tB = b.timestamp?.seconds || 0;
            return tB - tA;
        });

        updateOperatorOrdersList();
    }, (error) => {
        console.error("Error obteniendo pedidos: ", error);
        document.getElementById('operator-orders-list').innerHTML = '<p class="text-center text-rose-500 py-10 font-bold">Error cargando pedidos.</p>';
    });
});

function getStatusStyles(status) {
    const variants = {
        'Pendiente': "bg-amber-500/10 text-amber-500 border-amber-500/20",
        'En revisión': "bg-blue-500/10 text-blue-500 border-blue-500/20",
        'Aprobado': "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        'Denegado': "bg-rose-500/10 text-rose-500 border-rose-500/20"
    };
    return variants[status] || "bg-slate-500/10 text-slate-500 border-slate-500/20";
}

window.handleOrderArrival = async (orderId) => {
    if (confirm('¿Confirmar que el pedido ha llegado y marcar como completado?')) {
        try {
            const { updateDoc } = await import('./firebase-config-pedidos.js');
            await updateDoc(doc(dbPedidos, "orders", orderId), { status: 'Completado' });
        } catch (e) {
            console.error('Error al actualizar a Completado:', e);
            alert('Hubo un error al marcar como completado.');
        }
    }
};

function renderOrderCard(order) {
    let extraAprobado = '';
    if (order.status === 'Aprobado') {
        const fechaText = order.deliveryDate ? `Llega: ${order.deliveryDate}` : 'Fecha a coordinar';
        extraAprobado = `
            <div class="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2">
                <p class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">event_available</span> ${fechaText}
                </p>
                <button onclick="event.stopPropagation(); handleOrderArrival('${order.id}')" class="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                    <span class="material-symbols-outlined text-[14px]">done_all</span> LLEGÓ
                </button>
            </div>
        `;
    }

    const priorityColor = order.priority === 'Alta' ? 'border-t-rose-500' :
        order.priority === 'Media' ? 'border-t-amber-500' :
            'border-t-emerald-500';

    return `
        <div onclick="window.location.href='revisar-pedido.html?id=${order.id}'" class="cursor-pointer bg-white dark:bg-surface-dark rounded-2xl p-5 relative border-b border-x border-t-4 ${priorityColor} border-x-slate-200 border-b-slate-200 dark:border-x-white/10 dark:border-b-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 group">
            <div class="flex justify-between items-start mb-2.5">
                <div class="space-y-0.5 pointer-events-none">
                    <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-white/40">
                        <span class="material-symbols-outlined text-[13px]">id_card</span> #ORD-${order.orderNum || 'N/A'}
                    </div>
                    <h3 class="text-slate-900 dark:text-white text-sm font-black tracking-tight leading-tight">
                        ${order.item}
                    </h3>
                    <p class="text-villalba-blue dark:text-blue-400 text-[9px] font-bold uppercase tracking-widest">${order.createdAtStr || order.createdAt} - ${order.entity || 'Usuario'}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 p-2 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 pointer-events-none">
                <div>
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CANTIDAD</p>
                    <p class="text-xs font-bold text-slate-900 dark:text-white">${order.quantity} <span class="text-[10px] text-slate-500 font-medium">${order.unit || 'UDS'}</span></p>
                    ${order.quotation ? `<p class="text-[10px] font-bold text-emerald-600 mt-1">Cotiz: $${order.quotation.toLocaleString('es-AR')}</p>` : ''}
                </div>
                <div class="text-right flex flex-col items-end">
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ESTADO</p>
                    <div class="flex items-center gap-1">
                        <span class="flex h-1.5 w-1.5 rounded-full ${order.status === 'Pendiente' ? 'bg-amber-500' : order.status === 'En revisión' ? 'bg-blue-500' : order.status === 'Aprobado' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                        <p class="text-xs font-bold ${order.status === 'Pendiente' ? 'text-amber-500' : order.status === 'En revisión' ? 'text-blue-500' : order.status === 'Aprobado' ? 'text-emerald-500' : 'text-rose-500'}">
                            ${order.status}
                        </p>
                    </div>
                </div>
            </div>
            
            ${order.rejectionReason && (order.status === 'Denegado' || order.status === 'En revisión') ? `<div class="mt-2 p-2 ${order.status === 'Denegado' ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800/20' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/20'} border rounded-lg"><p class="text-[9px] font-black uppercase ${order.status === 'Denegado' ? 'text-rose-500' : 'text-blue-500'} tracking-widest mb-1">Notas / Motivo</p><p class="text-xs ${order.status === 'Denegado' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'} font-medium">${order.rejectionReason}</p></div>` : ''}
            ${extraAprobado}
        </div>
    `;
}

function updateOperatorOrdersList() {
    const filteredOrders = myOrders.filter(o =>
        o.item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.entity?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.orderNum && o.orderNum.toString().includes(searchQuery)) ||
        (o.id.includes(searchQuery))
    );

    document.getElementById('my-orders-count').innerText = `${filteredOrders.length} REGISTRADOS`;

    const countNuevas = filteredOrders.filter(o => (o.status || 'Pendiente') === 'Pendiente').length;
    const countRevision = filteredOrders.filter(o => o.status === 'En revisión').length;
    const countAprobados = filteredOrders.filter(o => o.status === 'Aprobado').length;

    const countNEl = document.getElementById('tab-count-nuevas');
    const countREl = document.getElementById('tab-count-revision');
    const countAEl = document.getElementById('tab-count-aprobados');
    if (countNEl) countNEl.innerText = countNuevas.toString().padStart(2, '0');
    if (countREl) countREl.innerText = countRevision.toString().padStart(2, '0');
    if (countAEl) countAEl.innerText = countAprobados.toString().padStart(2, '0');

    const activeOrders = filteredOrders.filter(o => (o.status || 'Pendiente') === currentTab);

    const noResultsMsg = document.getElementById('no-results-msg');
    const containerHigh = document.getElementById('orders-high');
    const containerMedium = document.getElementById('orders-medium');
    const containerLow = document.getElementById('orders-low');

    const countAlta = document.getElementById('count-alta');
    const countMedia = document.getElementById('count-media');
    const countBaja = document.getElementById('count-baja');

    const renderEmpty = '<div class="flex items-center justify-center p-8 bg-white/50 dark:bg-surface-dark/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl"><span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin Pedidos</span></div>';

    if (activeOrders.length === 0) {
        if (noResultsMsg) noResultsMsg.classList.add('hidden');
        if (containerHigh) containerHigh.innerHTML = renderEmpty;
        if (containerMedium) containerMedium.innerHTML = renderEmpty;
        if (containerLow) containerLow.innerHTML = renderEmpty;
        if (countAlta) countAlta.innerText = '0';
        if (countMedia) countMedia.innerText = '0';
        if (countBaja) countBaja.innerText = '0';
        return;
    }

    if (noResultsMsg) noResultsMsg.classList.add('hidden');

    const highPriority = activeOrders.filter(o => o.priority === 'Alta');
    const medPriority = activeOrders.filter(o => o.priority === 'Media');
    const lowPriority = activeOrders.filter(o => (!o.priority || o.priority === 'Baja'));

    if (countAlta) countAlta.innerText = highPriority.length;
    if (countMedia) countMedia.innerText = medPriority.length;
    if (countBaja) countBaja.innerText = lowPriority.length;

    if (containerHigh) containerHigh.innerHTML = highPriority.length ? highPriority.map(renderOrderCard).join('') : renderEmpty;
    if (containerMedium) containerMedium.innerHTML = medPriority.length ? medPriority.map(renderOrderCard).join('') : renderEmpty;
    if (containerLow) containerLow.innerHTML = lowPriority.length ? lowPriority.map(renderOrderCard).join('') : renderEmpty;
}


