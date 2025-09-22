import { auth, db, onAuthStateChanged, collection, query, where, getDocs, doc, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const ticketsContainer = document.getElementById('tickets-container');
    const filtroEstado = document.getElementById('filtro-estado');
    const menuBtn = document.getElementById('menu-btn');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists() && userDocSnap.data().role === 'supervisor') {
                loadTickets();
            } else {
                // If user is not a supervisor, redirect
                window.location.href = 'tickets-operador.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    const loadTickets = async () => {
        if (!ticketsContainer) return;
        ticketsContainer.innerHTML = '<p>Cargando tickets...</p>';

        const status = filtroEstado.value;

        try {
            let q;
            if (status === 'todos') {
                q = query(collection(db, 'tickets'));
            } else {
                q = query(collection(db, 'tickets'), where('status', '==', status));
            }

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                ticketsContainer.innerHTML = `<p>No se encontraron tickets con el estado '${status}'.</p>`;
                return;
            }

            let ticketsHTML = '';
            const tickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tickets.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

            tickets.forEach(ticket => {
                const lastUpdate = ticket.lastUpdatedAt?.toDate().toLocaleString() || 'N/A';

                ticketsHTML += `
                    <div class="ticket-card" data-id="${ticket.id}">
                        <div class="ticket-subject">${ticket.subject}</div>
                        <div class="ticket-operator">Operador: ${ticket.operatorName}</div>
                        <div class="ticket-status status-${ticket.status}">${ticket.status}</div>
                        <div class="ticket-last-update">Última actualización: ${lastUpdate}</div>
                    </div>
                `;
            });

            ticketsContainer.innerHTML = ticketsHTML;

            document.querySelectorAll('.ticket-card').forEach(card => {
                card.addEventListener('click', () => {
                    const ticketId = card.dataset.id;
                    window.location.href = `ticket-detalle.html?id=${ticketId}`;
                });
            });

        } catch (error) {
            console.error("Error al cargar los tickets:", error);
            let errorMessage = '<p>Ocurrió un error al cargar los tickets.</p>';
            if (error.message.includes("firestore/failed-precondition")) {
                errorMessage += '<p style="color: red; font-weight: bold;">Este error puede ser por un índice faltante en Firestore. Por favor, revisa la consola del navegador (F12). Firebase usualmente provee un link para crear el índice automáticamente.</p>';
            }
            ticketsContainer.innerHTML = errorMessage;
        }
    };

    filtroEstado?.addEventListener('change', loadTickets);

    menuBtn?.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
});
