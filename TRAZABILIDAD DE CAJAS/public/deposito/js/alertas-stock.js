import { db, doc, getDoc, setDoc, requireDepositoAuth } from './firebase-config-deposito.js';
import { dbPedidos, collection, addDoc, serverTimestamp } from '../../pedidos-internos/js/firebase-config-pedidos.js';

let depositoItemsCache = [];
let itemSeleccionado = null;
let currentUser = null;

const THEME = {
    amarilla: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-500', icon: 'warning', label: 'AMARILLA' },
    roja: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-500', icon: 'error', label: 'ROJA' }
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor']);
        currentUser = authData;
        const nameSpan = document.getElementById('user-display-name');
        if (nameSpan) nameSpan.textContent = authData.userData.name || authData.user.email;

        await fetchListaItems();
        initSearch();
        renderAlertasActivas();
    } catch (e) {
        console.error("Autenticación fallida o carga abortada", e);
    }
});

const fetchListaItems = async () => {
    try {
        const masterRef = doc(db, 'system', 'master_catalog');
        const snap = await getDoc(masterRef);
        
        if (snap.exists()) {
            depositoItemsCache = snap.data().items || [];
        } else {
            console.warn("Master Document no encontrado.");
        }
    } catch (error) {
        console.error("Error al cargar lista de ítems:", error);
    }
};

const initSearch = () => {
    const input = document.getElementById('buscador-input');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    const panelSeleccionado = document.getElementById('item-seleccionado');
    const lblCodigo = document.getElementById('item-codigo');
    const lblDesc = document.getElementById('item-desc');
    const btnQuitar = document.getElementById('btn-quitar-alerta');

    input.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();
        
        autocompleteList.innerHTML = '';
        itemSeleccionado = null;
        panelSeleccionado.classList.add('hidden');
        
        if (!val) {
            autocompleteList.classList.add('hidden');
            return;
        }

        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');
        const matches = depositoItemsCache.filter(item => {
            const codigo = item.codigo.toUpperCase();
            const desc = (item.descripcion || '').toUpperCase();
            const codigoAlfanumerico = codigo.replace(/[^A-Z0-9]/g, '');
            return codigo.includes(val) || desc.includes(val) || (valAlfanumerico.length > 0 && codigoAlfanumerico.includes(valAlfanumerico));
        }).slice(0, 15);

        if (matches.length > 0) {
            autocompleteList.classList.remove('hidden');
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors group";
                
                // Show indicator if it already has an alert
                let badge = '';
                if (item.alertaStock === 'amarilla') badge = '<span class="size-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]"></span>';
                if (item.alertaStock === 'roja') badge = '<span class="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>';

                div.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden">
                        ${badge || '<span class="size-2 rounded-full bg-transparent"></span>'}
                        <div class="flex flex-col overflow-hidden">
                            <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">${item.codigo}</span>
                            <span class="text-[9px] font-bold text-slate-500 uppercase leading-tight truncate">${item.descripcion}</span>
                        </div>
                    </div>
                    <span class="text-[10px] font-black text-villalba-blue opacity-0 group-hover:opacity-100 transition-opacity">SELECCIONAR</span>
                `;
                
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    seleccionarItem(item);
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => autocompleteList.classList.add('hidden'), 200);
    });

    const seleccionarItem = (item) => {
        input.value = '';
        autocompleteList.classList.add('hidden');
        itemSeleccionado = item;
        
        lblCodigo.textContent = item.codigo;
        lblDesc.textContent = item.descripcion;
        panelSeleccionado.classList.remove('hidden');

        if (item.alertaStock) {
            btnQuitar.classList.remove('hidden');
        } else {
            btnQuitar.classList.add('hidden');
        }
    };

    // Botones de Acción
    document.getElementById('btn-alerta-amarilla').addEventListener('click', () => setAlerta('amarilla'));
    document.getElementById('btn-alerta-roja').addEventListener('click', () => setAlerta('roja'));
    btnQuitar.addEventListener('click', () => setAlerta(null));
};

const setAlerta = async (nivel) => {
    if (!itemSeleccionado) return;

    const btnAmarillo = document.getElementById('btn-alerta-amarilla');
    const btnRojo = document.getElementById('btn-alerta-roja');
    const panel = document.getElementById('item-seleccionado');
    const oldHtmlA = btnAmarillo.innerHTML;
    const oldHtmlR = btnRojo.innerHTML;

    if (nivel === 'amarilla') btnAmarillo.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';
    if (nivel === 'roja') btnRojo.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span>';
    panel.style.pointerEvents = 'none';
    panel.style.opacity = '0.7';

    try {
        // 1. Actualizar Master Document
        const idx = depositoItemsCache.findIndex(i => i.codigo === itemSeleccionado.codigo);
        if (idx !== -1) {
            if (nivel) {
                depositoItemsCache[idx].alertaStock = nivel;
            } else {
                delete depositoItemsCache[idx].alertaStock;
            }
            
            const masterRef = doc(db, 'system', 'master_catalog');
            await setDoc(masterRef, { items: depositoItemsCache }, { merge: true });
            
            // Forzar recarga de cache en los clientes
            localStorage.removeItem('villalba_items_cache');
        }

        // 2. Actualizar Documento Individual
        const itemRef = doc(db, 'deposito_catalogo', itemSeleccionado.codigo);
        await setDoc(itemRef, nivel ? { alertaStock: nivel } : { alertaStock: null }, { merge: true });

        // 3. Generar Nota de Pedido Automática si es una alerta nueva
        if (nivel) {
            const cantInput = document.getElementById('cantidad-reposicion').value;
            const cant = parseInt(cantInput, 10) > 0 ? parseInt(cantInput, 10) : 1;
            const prioridad = nivel === 'roja' ? 'Alta' : 'Media';

            const newOrder = {
                orderNum: Math.floor(Math.random() * 99999).toString(),
                item: `REPOSICIÓN: ${itemSeleccionado.descripcion}`,
                entity: currentUser?.userData?.name || currentUser?.user?.email || "Sistema Depósito",
                operatorId: currentUser?.user?.uid || "system",
                sector: "Depósito (Automático)",
                supplier: "Alerta de Stock",
                quantity: cant,
                unit: "Unidades",
                code: itemSeleccionado.codigo,
                priority: prioridad,
                createdAt: new Date().toLocaleDateString('es-AR'),
                timestamp: serverTimestamp(),
                deliveryDate: "",
                status: "Pendiente",
            };

            await addDoc(collection(dbPedidos, "orders"), newOrder);
        }

        // Éxito
        showToast(nivel ? 'Pedido generado' : 'Alerta removida');
        document.getElementById('item-seleccionado').classList.add('hidden');
        document.getElementById('cantidad-reposicion').value = '';
        itemSeleccionado = null;
        renderAlertasActivas();

    } catch (error) {
        console.error("Error al configurar alerta:", error);
        alert("Ocurrió un error al configurar la alerta. Ver consola.");
    } finally {
        btnAmarillo.innerHTML = oldHtmlA;
        btnRojo.innerHTML = oldHtmlR;
        panel.style.pointerEvents = 'auto';
        panel.style.opacity = '1';
    }
};

const renderAlertasActivas = () => {
    const tbody = document.getElementById('alertas-tbody');
    const contador = document.getElementById('contador-alertas');
    
    const itemsConAlerta = depositoItemsCache.filter(i => i.alertaStock === 'amarilla' || i.alertaStock === 'roja');
    
    contador.textContent = `${itemsConAlerta.length} ÍTEMS`;

    if (itemsConAlerta.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="py-16 text-center">
                    <div class="flex flex-col items-center justify-center gap-3 text-slate-400">
                        <span class="material-symbols-outlined text-4xl opacity-50">notifications_paused</span>
                        <p class="text-[10px] font-black uppercase tracking-widest">No hay alertas activas</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Sort: Rojas first, then Amarillas
    itemsConAlerta.sort((a, b) => {
        if (a.alertaStock === 'roja' && b.alertaStock !== 'roja') return -1;
        if (a.alertaStock !== 'roja' && b.alertaStock === 'roja') return 1;
        return a.codigo.localeCompare(b.codigo);
    });

    tbody.innerHTML = itemsConAlerta.map(item => {
        const theme = THEME[item.alertaStock] || THEME.amarilla;
        
        return `
            <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td class="py-4 px-4 border-b border-slate-100 dark:border-slate-800/80 w-[120px]">
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${theme.border} ${theme.bg} ${theme.text}">
                        <span class="material-symbols-outlined text-[14px]">${theme.icon}</span>
                        <span class="text-[9px] font-black uppercase tracking-widest">${theme.label}</span>
                    </div>
                </td>
                <td class="py-4 px-4 border-b border-slate-100 dark:border-slate-800/80">
                    <p class="text-xs font-black text-slate-800 dark:text-white tracking-widest leading-none">${item.codigo}</p>
                    <p class="text-[10px] font-bold text-slate-500 uppercase mt-1 truncate max-w-[200px] sm:max-w-md">${item.descripcion}</p>
                </td>
            </tr>
        `;
    }).join('');
};

const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.querySelector('p:last-child').textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-24');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-24');
    }, 4000);
};
