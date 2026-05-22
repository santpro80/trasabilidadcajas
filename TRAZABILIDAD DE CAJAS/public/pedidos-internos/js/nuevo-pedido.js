import { dbPedidos, collection, addDoc, serverTimestamp } from './firebase-config-pedidos.js';
import { initApp } from './app.js';

initApp().then((user) => {
    // Current user está en "user"
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('new-order-content').classList.remove('hidden');

    const form = document.getElementById('new-order-form');
    const submitBtn = document.getElementById('submit-order-btn');
    const noEntityInput = document.getElementById('no-entity');

    // Cargar nombre del solicitante basado en el usuario actual
    if (noEntityInput && user) {
        noEntityInput.value = user.name || user.email || "Usuario Local";
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const item = document.getElementById('no-item').value;
        const quantity = parseFloat(document.getElementById('no-quantity').value);
        const unit = document.getElementById('no-unit').value;
        const supplier = document.getElementById('no-supplier').value;
        const priority = document.getElementById('no-priority').value;

        if (!item || isNaN(quantity)) {
            alert("Completa los campos obligatorios");
            return;
        }

        if (quantity <= 0) {
            alert("La cantidad debe ser mayor a 0");
            return;
        }

        // Mostrar modal de confirmación antes de guardar
        const dialog = document.createElement('div');
        dialog.className = "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity animate-in fade-in";
        dialog.innerHTML = `
            <div class="bg-white dark:bg-surface-dark w-full max-w-sm rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative zoom-in-95 duration-200 text-center">
                <div class="size-16 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                    <span class="material-symbols-outlined text-villalba-blue text-3xl">help</span>
                </div>
                <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">¿Confirmar Pedido?</h2>
                <p class="text-sm text-slate-500 font-medium mb-6">Estás a punto de solicitar <b>${quantity} ${unit}</b> de <b>${item}</b>.</p>
                <div class="flex gap-3 w-full">
                    <button type="button" id="cancel-btn" class="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">Cancelar</button>
                    <button type="button" id="confirm-btn" class="flex-1 py-3.5 bg-villalba-blue hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg shadow-blue-500/30">Sí, Solicitar</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        dialog.querySelector('#cancel-btn').addEventListener('click', () => {
            dialog.remove();
        });

        dialog.querySelector('#confirm-btn').addEventListener('click', async () => {
            dialog.remove();
            
            submitBtn.disabled = true;
            submitBtn.querySelector('.btn-text').textContent = "GUARDANDO...";

            try {
                const newOrder = {
                    orderNum: Math.floor(Math.random() * 99999).toString(),
                    item: item,
                    entity: user?.name || user?.email || "Usuario Local",
                    operatorId: user?.uid || "anon",
                    sector: user?.sector_pedidos || "Sin Asignar",
                    supplier: supplier || "Sin comentarios",
                    quantity: quantity,
                    unit: unit,
                    code: "NEW-" + Math.floor(Math.random() * 999),
                    priority: priority,
                    createdAt: new Date().toLocaleDateString('es-AR'),
                    timestamp: serverTimestamp(),
                    deliveryDate: "",
                    status: "Pendiente",
                };

                await addDoc(collection(dbPedidos, "orders"), newOrder);
                window.location.href = 'mis-pedidos.html';
            } catch (error) {
                console.error("Error al guardar el pedido:", error);
                alert("Ocurrió un error al guardar el pedido.");
                submitBtn.disabled = false;
                submitBtn.querySelector('.btn-text').textContent = "CONFIRMAR PEDIDO";
            }
        });
    });
});
