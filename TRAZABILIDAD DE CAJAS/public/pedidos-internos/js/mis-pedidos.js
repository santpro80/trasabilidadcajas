import { dbPedidos, collection, onSnapshot, query, where, doc, deleteDoc } from './firebase-config-pedidos.js';
import { initApp } from './app.js';

let myOrders = [];
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
        const renderError = `<div class="flex flex-col items-center justify-center p-6 bg-rose-500/10 border-2 border-dashed border-rose-500/30 rounded-2xl"><span class="material-symbols-outlined text-rose-500 text-3xl mb-1">error</span><span class="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center mt-2">Error de sesión.<br>Vuelve a iniciar sesión.</span></div>`;
        const containerHigh = document.getElementById('orders-high');
        if (containerHigh) containerHigh.innerHTML = renderError;
        return;
    }

    const q = query(collection(dbPedidos, "orders"), where("operatorId", "==", user.uid));
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
        console.error("Error obteniendo mis pedidos: ", error);
        const renderError = `<div class="flex flex-col items-center justify-center p-6 bg-rose-500/10 border-2 border-dashed border-rose-500/30 rounded-2xl"><span class="material-symbols-outlined text-rose-500 text-3xl mb-1">error</span><span class="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center mt-2">Error de permisos o conexión.<br>Avisa a tu supervisor.</span></div>`;
        const containerHigh = document.getElementById('orders-high');
        const containerMedium = document.getElementById('orders-medium');
        const containerLow = document.getElementById('orders-low');
        if (containerHigh) containerHigh.innerHTML = renderError;
        if (containerMedium) containerMedium.innerHTML = renderError;
        if (containerLow) containerLow.innerHTML = renderError;
    });
});

function getPriorityStyles(priority) {
    const variants = {
        'Baja': "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        'Media': "bg-amber-500/10 text-amber-500 border-amber-500/20",
        'Alta': "bg-rose-500/10 text-rose-500 border-rose-500/20"
    };
    return variants[priority] || variants['Baja'];
}

function renderOrderCard(order) {
    const priorityColor = order.priority === 'Alta' ? 'border-t-rose-500' :
        order.priority === 'Media' ? 'border-t-amber-500' :
            'border-t-emerald-500';

    return `
        <div class="bg-white dark:bg-surface-dark rounded-2xl p-5 relative border-b border-x border-t-4 ${priorityColor} border-x-slate-200 border-b-slate-200 dark:border-x-white/10 dark:border-b-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 group">
            <div class="flex justify-between items-start mb-2.5">
                <div class="space-y-0.5">
                    <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-white/40">
                        <span class="material-symbols-outlined text-[13px]">id_card</span> #ORD-${order.orderNum || 'N/A'}
                    </div>
                    <h3 class="text-slate-900 dark:text-white text-sm font-black tracking-tight leading-tight">
                        ${order.item}
                    </h3>
                    <p class="text-villalba-blue dark:text-blue-400 text-[9px] font-bold uppercase tracking-widest">${order.createdAtStr || order.createdAt}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3 p-2 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                <div>
                    <p class="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">CANTIDAD</p>
                    <p class="text-xs font-bold text-slate-900 dark:text-white">${order.quantity} <span class="text-[10px] text-slate-500 font-medium">${order.unit || 'UDS'}</span></p>
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

            ${order.status === 'Aprobado' && order.deliveryDate ? `<div class="mt-3 pt-2 border-t border-slate-100 dark:border-white/5"><p class="text-[10px] font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">local_shipping</span> Llega: ${order.deliveryDate}</p></div>` : ''}

            ${order.status === 'Pendiente' ? `
                <button onclick="window.misPedidos.cancelOrder('${order.id}')" class="absolute -top-2 -right-2 size-7 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-full shadow-md flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-colors z-10">
                    <span class="material-symbols-outlined text-[14px]">close</span>
                </button>
            ` : ''}
        </div>
    `;
}

function updateOperatorOrdersList() {
    const filteredOrders = myOrders.filter(o =>
        o.item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.orderNum && o.orderNum.toString().includes(searchQuery)) ||
        (o.id.includes(searchQuery))
    );

    document.getElementById('my-orders-count').innerText = `${filteredOrders.length} REGISTRADOS`;

    const noResultsMsg = document.getElementById('no-results-msg');
    const containerHigh = document.getElementById('orders-high');
    const containerMedium = document.getElementById('orders-medium');
    const containerLow = document.getElementById('orders-low');

    const countAlta = document.getElementById('count-alta');
    const countMedia = document.getElementById('count-media');
    const countBaja = document.getElementById('count-baja');

    const renderEmpty = '<div class="flex flex-col items-center justify-center p-6 bg-white/40 dark:bg-surface-dark/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl opacity-70"><span class="material-symbols-outlined text-slate-300 text-3xl mb-1">inbox</span><span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin Pedidos</span></div>';

    if (filteredOrders.length === 0) {
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

    const highOrders = filteredOrders.filter(o => o.priority === 'Alta');
    const mediumOrders = filteredOrders.filter(o => o.priority === 'Media');
    const lowOrders = filteredOrders.filter(o => o.priority === 'Baja' || !o.priority);

    countAlta.innerText = highOrders.length;
    countMedia.innerText = mediumOrders.length;
    countBaja.innerText = lowOrders.length;

    containerHigh.innerHTML = highOrders.length ? highOrders.map(renderOrderCard).join('') : renderEmpty;
    containerMedium.innerHTML = mediumOrders.length ? mediumOrders.map(renderOrderCard).join('') : renderEmpty;
    containerLow.innerHTML = lowOrders.length ? lowOrders.map(renderOrderCard).join('') : renderEmpty;
}

window.misPedidos = {
    cancelOrder: async (orderId) => {
        if (confirm("¿Estás seguro de cancelar y eliminar este pedido pendiente?")) {
            try {
                await deleteDoc(doc(dbPedidos, "orders", orderId));
                alert("Pedido eliminado.");
            } catch (error) {
                console.error("Error eliminando: ", error);
                alert("Hubo un error al eliminar el pedido.");
            }
        }
    }
};
