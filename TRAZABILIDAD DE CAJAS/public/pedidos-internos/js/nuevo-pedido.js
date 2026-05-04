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

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = "GUARDANDO...";

        try {
            const newOrder = {
                orderNum: Math.floor(Math.random() * 99999).toString(),
                item: item,
                entity: user?.name || user?.email || "Usuario Local",
                operatorId: user?.uid || "anon",
                sector: user?.sector_pedidos || "Sin Asignar",
                supplier: supplier || "No especificado",
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
