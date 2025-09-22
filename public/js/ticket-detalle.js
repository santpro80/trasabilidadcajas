import { auth, db, onAuthStateChanged, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot, deleteDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const ticketAsunto = document.getElementById('ticket-asunto');
    const mensajesContainer = document.getElementById('mensajes-container');
    const mensajeRespuesta = document.getElementById('mensaje-respuesta');
    const enviarRespuestaBtn = document.getElementById('enviar-respuesta-btn');
    const cerrarTicketBtn = document.getElementById('cerrar-ticket-btn');
    const eliminarTicketBtn = document.getElementById('eliminar-ticket-btn');
    const volverBtn = document.getElementById('volver-btn');

    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('id');

    let currentUser = null;
    let currentUserRole = null;
    let currentUserName = null;
    let unsubscribe = null; // To stop the listener when leaving the page

    if (!ticketId) {
        window.location.href = 'menu.html';
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
                currentUserRole = userDocSnap.data().role;
                currentUserName = userDocSnap.data().name;
            }
            listenForTicketUpdates(); // Start the real-time listener
        } else {
            window.location.href = 'login.html';
        }
    });

    const listenForTicketUpdates = () => {
        const ticketRef = doc(db, 'tickets', ticketId);
        
        unsubscribe = onSnapshot(ticketRef, (docSnap) => {
            if (!docSnap.exists()) {
                alert('El ticket no existe o fue eliminado.');
                window.location.href = 'tickets-supervisor.html'; // Go back to the list
                return;
            }

            const ticket = docSnap.data();

            // Security check
            if (currentUserRole !== 'supervisor' && ticket.operatorUid !== currentUser.uid) {
                alert('No tienes permiso para ver este ticket.');
                window.location.href = 'menu.html';
                return;
            }

            ticketAsunto.textContent = ticket.subject;
            renderMessages(ticket.messages || []);

            // Hide all action buttons by default
            cerrarTicketBtn.style.display = 'none';
            eliminarTicketBtn.style.display = 'none';

            // Update UI based on ticket status
            if (ticket.status === 'cerrado') {
                mensajeRespuesta.disabled = true;
                enviarRespuestaBtn.disabled = true;
                mensajeRespuesta.placeholder = 'Este ticket está cerrado.';
                if (currentUserRole === 'supervisor') {
                    eliminarTicketBtn.style.display = 'block'; // Show delete button
                }
            } else { // Ticket is open
                mensajeRespuesta.disabled = false;
                enviarRespuestaBtn.disabled = false;
                mensajeRespuesta.placeholder = 'Escribe tu respuesta...';
                if (currentUserRole === 'supervisor') {
                    cerrarTicketBtn.style.display = 'block'; // Show close button
                }
            }
        }, (error) => {
            console.error("Error al escuchar los cambios del ticket:", error);
        });
    };

    const renderMessages = (messages) => {
        let messagesHTML = '';
        messages.forEach(msg => {
            const isCurrentUser = msg.senderUid === currentUser.uid;
            const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString() : (msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '');

            messagesHTML += `
                <div class="message ${isCurrentUser ? 'sent' : 'received'}">
                    <div class="message-sender">${msg.senderName}</div>
                    <div class="message-text">${msg.text}</div>
                    <div class="message-date">${msgDate}</div>
                </div>
            `;
        });
        mensajesContainer.innerHTML = messagesHTML;
        // Always scroll to the bottom to show the latest message
        mensajesContainer.scrollTop = mensajesContainer.scrollHeight;
    };

    enviarRespuestaBtn?.addEventListener('click', async () => {
        const text = mensajeRespuesta.value.trim();
        if (!text) return;

        const newMessage = {
            senderUid: currentUser.uid,
            senderName: currentUserName || currentUser.email,
            text: text,
            timestamp: new Date() // Use client-side timestamp
        };

        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            await updateDoc(ticketRef, {
                messages: arrayUnion(newMessage),
                lastUpdatedAt: serverTimestamp()
            });
            mensajeRespuesta.value = '';
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            alert('Ocurrió un error al enviar la respuesta.');
        }
    });

    mensajeRespuesta?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line
            enviarRespuestaBtn.click(); // Trigger send button click
        }
    });

    cerrarTicketBtn?.addEventListener('click', async () => {
        if (currentUserRole !== 'supervisor') return;

        const confirmation = confirm('¿Estás seguro de que quieres cerrar este ticket?');
        if (!confirmation) return;

        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            await updateDoc(ticketRef, {
                status: 'cerrado',
                lastUpdatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error al cerrar el ticket:", error);
            alert('Ocurrió un error al cerrar el ticket.');
        }
    });

    eliminarTicketBtn?.addEventListener('click', () => {
        if (currentUserRole !== 'supervisor') return;

        const confirmation = confirm('¿Estás seguro de que quieres eliminar este ticket permanentemente? Esta acción no se puede deshacer.');
        if (!confirmation) return;

        const ticketRef = doc(db, 'tickets', ticketId);
        console.log("Intentando eliminar el ticket con ID:", ticketId);

        deleteDoc(ticketRef)
            .then(() => {
                console.log("Promesa de deleteDoc resuelta (then).");
                alert("La solicitud de eliminación fue procesada por Firebase.");
                // The onSnapshot listener should handle the redirect.
            })
            .catch((error) => {
                console.error("Error al eliminar el ticket:", error);
                alert(`Ocurrió un error al eliminar el ticket: ${error.message}`);
            });
    });

    // Stop the listener when the user navigates away
    window.addEventListener('beforeunload', () => {
        if (unsubscribe) {
            unsubscribe();
        }
    });

    volverBtn?.addEventListener('click', () => {
        if (currentUserRole === 'supervisor') {
            window.location.href = 'tickets-supervisor.html';
        } else {
            window.location.href = 'tickets-operador.html';
        }
    });
});