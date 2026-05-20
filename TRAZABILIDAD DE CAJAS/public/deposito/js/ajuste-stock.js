import { db, doc, getDoc, setDoc, requireDepositoAuth, collection, addDoc, serverTimestamp } from './firebase-config-deposito.js';

let depositoItemsCache = [];
let itemSeleccionado = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor']);
        currentUser = authData;
        const nameSpan = document.getElementById('user-display-name');
        if (nameSpan) nameSpan.textContent = authData.userData.name || authData.user.email;

        await fetchListaItems();
        initSearch();
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
    const lblStockActual = document.getElementById('stock-actual-badge');
    const inputNuevoStock = document.getElementById('nuevo-stock');
    const btnGuardar = document.getElementById('btn-guardar-ajuste');

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
                
                div.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden">
                        <span class="size-2 rounded-full bg-violet-500"></span>
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
        lblStockActual.textContent = item.stock || 0;
        inputNuevoStock.value = '';
        panelSeleccionado.classList.remove('hidden');
        inputNuevoStock.focus();
    };

    const guardarAjuste = async () => {
        if (!itemSeleccionado) return;
        
        const nuevoVal = parseInt(inputNuevoStock.value, 10);
        if (isNaN(nuevoVal) || nuevoVal < 0) {
            alert("Por favor ingrese un stock válido (número mayor o igual a 0).");
            return;
        }

        const oldStock = itemSeleccionado.stock || 0;
        if (nuevoVal === oldStock) {
            alert("El nuevo stock es idéntico al stock actual en sistema.");
            return;
        }

        btnGuardar.disabled = true;
        btnGuardar.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Guardando...</span>';
        panelSeleccionado.style.pointerEvents = 'none';
        panelSeleccionado.style.opacity = '0.7';

        try {
            // 1. Guardar Movimiento de Ajuste en deposito_movimientos
            const diff = nuevoVal - oldStock;
            await addDoc(collection(db, 'deposito_movimientos'), {
                tipo: 'Ajuste',
                codigo: itemSeleccionado.codigo,
                descripcion: itemSeleccionado.descripcion,
                cantidad: Math.abs(diff),
                detalle: `cambio el total de ${oldStock} a ${nuevoVal}`,
                timestamp: serverTimestamp(),
                usuarioNombre: currentUser?.userData?.name || currentUser?.user?.email || 'Desconocido',
                usuario: currentUser?.user?.email || 'Desconocido',
                userId: currentUser?.user?.uid || 'Anónimo'
            });

            // 2. Actualizar Stock Catálogo Individual (deposito_catalogo)
            const itemRef = doc(db, 'deposito_catalogo', itemSeleccionado.codigo);
            await setDoc(itemRef, { stock: nuevoVal }, { merge: true });

            // 3. Actualizar Master Document
            const masterRef = doc(db, 'system', 'master_catalog');
            const idx = depositoItemsCache.findIndex(i => i.codigo === itemSeleccionado.codigo);
            if (idx !== -1) {
                depositoItemsCache[idx].stock = nuevoVal;
            } else {
                depositoItemsCache.push({
                    codigo: itemSeleccionado.codigo,
                    descripcion: itemSeleccionado.descripcion,
                    stock: nuevoVal
                });
            }
            await setDoc(masterRef, { items: depositoItemsCache });

            // 4. Limpiar caché local
            localStorage.removeItem('villalba_items_cache');

            // Mostrar toast de éxito
            showToast();

            // Actualizar UI
            lblStockActual.textContent = nuevoVal;
            itemSeleccionado.stock = nuevoVal;
            inputNuevoStock.value = '';

            // Recargar lista local
            await fetchListaItems();

        } catch (error) {
            console.error("Error al guardar ajuste de stock:", error);
            alert("Ocurrió un error al intentar actualizar el stock.");
        } finally {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span><span>Guardar Cambios</span>';
            panelSeleccionado.style.pointerEvents = 'auto';
            panelSeleccionado.style.opacity = '1';
        }
    };

    btnGuardar.addEventListener('click', guardarAjuste);

    // Event listener to save when Enter is pressed in the new stock input
    inputNuevoStock.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            guardarAjuste();
        }
    });
};

const showToast = () => {
    const toast = document.getElementById('toast');
    toast.classList.remove('translate-y-24', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-24', 'opacity-0');
    }, 3000);
};
