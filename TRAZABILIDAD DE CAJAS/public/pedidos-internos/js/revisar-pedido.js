import { dbPedidos, doc, getDoc, updateDoc } from './firebase-config-pedidos.js';
import { initApp } from './app.js';

let currentOrderId = null;

initApp().then(async (user) => {
    // Only admins or supervisors should ideally access this, but we'll allow supervisors for now since user.role logic wasn't fully refactored, you can restrict it further later.
    const urlParams = new URLSearchParams(window.location.search);
    currentOrderId = urlParams.get('id');

    if (!currentOrderId) {
        alert("ID de pedido no especificado.");
        window.history.back();
        return;
    }

    try {
        const orderRef = doc(dbPedidos, "orders", currentOrderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
            const data = orderSnap.data();

            // Llenar datos de solo lectura
            document.getElementById('no-entity').value = data.entity || 'N/A';
            document.getElementById('no-item').value = data.item || '';
            document.getElementById('no-item').disabled = true;
            document.getElementById('no-supplier').value = data.supplier || '';
            document.getElementById('no-supplier').disabled = true;
            document.getElementById('no-quantity').value = data.quantity || 0;
            document.getElementById('no-quantity').disabled = true;
            document.getElementById('no-unit').value = data.unit || 'UDS';
            document.getElementById('no-unit').disabled = true;
            document.getElementById('no-priority').value = data.priority || 'Baja';
            document.getElementById('no-priority').disabled = true;

            // Llenar datos editables por admin
            document.getElementById('admin-status').value = data.status || 'Pendiente';

            // Set min date to today for delivery date
            const deliveryDateInput = document.getElementById('admin-delivery-date');
            if (deliveryDateInput) {
                const today = new Date().toISOString().split('T')[0];
                deliveryDateInput.setAttribute('min', today);
                if (data.deliveryDate) {
                    deliveryDateInput.value = data.deliveryDate;
                }
            }

            // Admin Supplier
            if (data.adminSupplier) {
                document.getElementById('admin-supplier').value = data.adminSupplier;
            } else if (data.supplier) {
                document.getElementById('admin-supplier').value = data.supplier;
            }

            // Currency Switcher
            if (data.currency) {
                document.getElementById('admin-currency').value = data.currency;
            }

            if (data.orderNumber) {
                document.getElementById('admin-order-number').value = data.orderNumber;
            }

            if (data.rejectionReason) {
                document.getElementById('admin-rejection-reason').value = data.rejectionReason;
            }

            // Real-time currency formatting logic (Normal typing)
            const quotationDisplay = document.getElementById('admin-quotation-display');
            const quotationHidden = document.getElementById('admin-quotation');

            const formatValue = (val) => {
                // Solo permitimos números y una coma
                let clean = val.replace(/[^0-9,]/g, '');

                // Evitamos múltiples comas
                const parts = clean.split(',');
                let integerPart = parts[0];
                let decimalPart = parts.length > 1 ? parts[1].slice(0, 2) : null;

                // Formateamos la parte entera con puntos de miles
                integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

                // Reconstruimos el string
                if (decimalPart !== null) {
                    return `${integerPart},${decimalPart}`;
                }
                return integerPart;
            };

            const updateHiddenValue = (formatted) => {
                if (!formatted) {
                    quotationHidden.value = 0;
                    return;
                }
                let clean = formatted.replace(/\./g, '').replace(',', '.');
                quotationHidden.value = parseFloat(clean) || 0;
            };

            quotationDisplay.addEventListener('input', (e) => {
                const cursorPosition = e.target.selectionStart;
                const oldLength = e.target.value.length;

                let formatted = formatValue(e.target.value);
                e.target.value = formatted;

                // Ajustar posición del cursor si se añadieron puntos
                const newLength = formatted.length;
                e.target.setSelectionRange(cursorPosition + (newLength - oldLength), cursorPosition + (newLength - oldLength));

                updateHiddenValue(formatted);
            });

            if (data.quotation !== undefined && data.quotation > 0) {
                const initialStr = data.quotation.toString().replace('.', ',');
                quotationDisplay.value = formatValue(initialStr);
                quotationHidden.value = data.quotation;
            } else {
                quotationDisplay.value = "";
                quotationHidden.value = 0;
            }

            toggleRejectionReason(data.status || 'Pendiente');

            document.getElementById('loading-state').classList.add('hidden');
            document.getElementById('new-order-content').classList.remove('hidden');

            if ((data.status || 'Pendiente') === 'Pendiente') {
                try {
                    await updateDoc(doc(dbPedidos, "orders", currentOrderId), { status: 'En revisión' });
                    document.getElementById('admin-status').value = 'En revisión';
                    toggleRejectionReason('En revisión');
                } catch (e) {
                    console.error("No se pudo auto-setear En revisión", e);
                }
            }
        } else {
            alert("El pedido no existe.");
            window.history.back();
        }
    } catch (error) {
        console.error("Error al obtener el pedido:", error);
        alert("Ocurrió un error al cargar el pedido.");
        window.history.back();
    }

    // Toggle rejection reason field
    document.getElementById('admin-status').addEventListener('change', (e) => {
        toggleRejectionReason(e.target.value);
    });

    const form = document.getElementById('new-order-form');
    const submitBtn = document.getElementById('submit-order-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newStatus = document.getElementById('admin-status').value;
        const newDeliveryDate = document.getElementById('admin-delivery-date').value;
        const newRejectionReason = document.getElementById('admin-rejection-reason').value;
        const newQuotation = document.getElementById('admin-quotation').value;
        const adminSupplier = document.getElementById('admin-supplier').value;
        const currency = document.getElementById('admin-currency').value;
        const adminOrderNumber = document.getElementById('admin-order-number').value.trim();

        // Validación CRÍTICA: No aprobar sin cotización ni N° de Orden
        if (newStatus === 'Aprobado') {
            if (!newQuotation || parseFloat(newQuotation) <= 0) {
                alert("⚠️ Error: No puedes aprobar un pedido sin ingresar un costo o cotización.");
                return;
            }
            if (!adminOrderNumber) {
                alert("⚠️ Error: No puedes aprobar un pedido sin ingresar un N° de Orden.");
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = "GUARDANDO...";

        try {
            const updateData = {
                status: newStatus,
                deliveryDate: newDeliveryDate || "",
                adminSupplier: adminSupplier || "",
                currency: currency || "ARS",
                orderNumber: adminOrderNumber || ""
            };

            if (newQuotation) {
                updateData.quotation = parseFloat(newQuotation);
            } else {
                updateData.quotation = 0;
            }

            if (newStatus === 'Denegado' || newStatus === 'En revisión') {
                updateData.rejectionReason = newRejectionReason;
            } else {
                updateData.rejectionReason = null;
            }

            await updateDoc(doc(dbPedidos, "orders", currentOrderId), updateData);
            window.history.back();
        } catch (error) {
            console.error("Error al actualizar el pedido:", error);
            alert("Ocurrió un error al guardar los cambios.");
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = "GUARDAR CAMBIOS";
        }
    });
});

function toggleRejectionReason(status) {
    const container = document.getElementById('rejection-container');
    const input = document.getElementById('admin-rejection-reason');
    if (status === 'Denegado' || status === 'En revisión') {
        container.classList.remove('hidden');
        input.required = (status === 'Denegado');
    } else {
        container.classList.add('hidden');
        input.required = false;
        input.value = "";
    }
}
