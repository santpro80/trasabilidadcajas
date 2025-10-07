import { auth, db, onAuthStateChanged, collection, query, where, onSnapshot, addDoc, serverTimestamp, getDoc, doc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const ticketsContainer = document.getElementById('tickets-container');
    const crearTicketBtn = document.getElementById('crear-ticket-btn');
    const menuBtn = document.getElementById('menu-btn');

    let currentUser = null;
    let currentUserName = null;
    let currentUserRole = null;
    let unsubscribeTickets = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
                currentUserName = userDocSnap.data().name;
                currentUserRole = userDocSnap.data().role || 'operador';
            }
            listenForTickets(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    const listenForTickets = (userId) => {
        if (!ticketsContainer) return;
        ticketsContainer.innerHTML = '<p>Cargando tickets...</p>';

        if (unsubscribeTickets) unsubscribeTickets();

        const q = query(
            collection(db, 'tickets'),
            where('operatorUid', '==', userId),
            where('status', '==', 'abierto')
        );

        unsubscribeTickets = onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                ticketsContainer.innerHTML = '<p>No tienes tickets abiertos.</p>';
                return;
            }

            let ticketsHTML = '';
            const tickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tickets.sort((a, b) => (b.lastUpdatedAt?.toMillis() || 0) - (a.lastUpdatedAt?.toMillis() || 0));

            tickets.forEach(ticket => {
                const lastUpdate = ticket.lastUpdatedAt?.toDate().toLocaleString() || 'N/A';
                const unreadCount = ticket.unreadCounts?.operator || 0;

                ticketsHTML += `
                    <div class="ticket-card" data-id="${ticket.id}">
                        ${unreadCount > 0 ? `<div class="notification-badge">${unreadCount}</div>` : ''}
                        <div class="ticket-subject">${ticket.subject}</div>
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

        }, (error) => {
            console.error("Error al cargar los tickets:", error);
            let errorMessage = '<p>Ocurrió un error al cargar los tickets.</p>';
            if (error.message.includes("firestore/failed-precondition")) {
                errorMessage += '<p style="color: red; font-weight: bold;">Este error puede ser por un índice faltante en Firestore. Por favor, revisa la consola del navegador (F12). Firebase usualmente provee un link para crear el índice automáticamente.</p>';
            }
            ticketsContainer.innerHTML = errorMessage;
        });
    };

    crearTicketBtn?.addEventListener('click', () => {
        showCreateTicketModal();
    });

    const showCreateTicketModal = () => {
        const modalHTML = `
            <div id="create-ticket-modal" class="modal-overlay" style="display: flex;">
                <div class="modal-content">
                    <h2>Crear Nuevo Ticket</h2>
                    <input type="text" id="ticket-subject-input" placeholder="Asunto del ticket">
                    <textarea id="ticket-message-input" placeholder="Describe tu problema o consulta..."></textarea>
                    <div class="modal-actions">
                        <button id="cancel-ticket-btn" class="btn-modal secondary">Cancelar</button>
                        <button id="submit-ticket-btn" class="btn-modal primary">Crear Ticket</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById('create-ticket-modal');
        const cancelBtn = document.getElementById('cancel-ticket-btn');
        const submitBtn = document.getElementById('submit-ticket-btn');

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        submitBtn.addEventListener('click', async () => {
            const subject = document.getElementById('ticket-subject-input').value.trim();
            const message = document.getElementById('ticket-message-input').value.trim();

            if (!subject || !message) {
                alert('Por favor, completa todos los campos.');
                return;
            }

            try {
                await addDoc(collection(db, 'tickets'), {
                    operatorUid: currentUser.uid,
                    operatorName: currentUserName || currentUser.email,
                    subject: subject,
                    createdAt: serverTimestamp(),
                    lastUpdatedAt: serverTimestamp(),
                    status: 'abierto',
                    messages: [
                        {
                            senderUid: currentUser.uid,
                            senderName: currentUserName || currentUser.email,
                            text: message,
                            timestamp: new Date()
                        }
                    ],
                    unreadCounts: { 
                        supervisor: 1, 
                        operator: 0    
                    }
                });
                modal.remove();
            } catch (error) {
                console.error("Error al crear el ticket:", error);
                alert('Ocurrió un error al crear el ticket.');
            }
        });
    };

    menuBtn?.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
    window.addEventListener('beforeunload', () => {
        if (unsubscribeTickets) unsubscribeTickets();
    });
});
