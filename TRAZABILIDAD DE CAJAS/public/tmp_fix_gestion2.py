import codecs

file_path = r"c:\Users\Tecnica\appweb santi\TRAZABILIDAD DE CAJAS\public\pedidos-internos\js\gestion-pedidos.js"
with codecs.open(file_path, 'r', 'utf-8') as f:
    text = f.read()

pre = text[:text.find('function updateOperatorOrdersList() {')]

post_idx = text.find('window.switchTab = (tab) => {')

if post_idx == -1:
    print("Could not find window.switchTab")
    post_idx = text.find('window.gestionPedidos = {')


post = text[post_idx:]

new_func = """function updateOperatorOrdersList() {
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

"""

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(pre + new_func + post)

print("Fixed updateOperatorOrdersList in gestion-pedidos.js")
