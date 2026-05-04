import { auth, db, onAuthStateChanged, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot, deleteDoc, increment } from './firebase-config.js';

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
    let unsubscribe = null; 

    if (!ticketId) {
        window.location.href = 'menu.html';
        return;
    }

    const markAsRead = async () => {
        console.log("--- Running markAsRead --- ");
        if (!currentUserRole) {
            console.log("markAsRead: Aborting, currentUserRole is not set.");
            return;
        }

        console.log(`markAsRead: Current user role is '${currentUserRole}'`);

        const ticketRef = doc(db, 'tickets', ticketId);
        const ticketSnap = await getDoc(ticketRef);

        if (ticketSnap.exists()) {
            const ticketData = ticketSnap.data();
            const updateData = {};

            console.log(`markAsRead: Checking conditions for operator. operatorUid on ticket is '${ticketData.operatorUid}'. currentUser.uid is '${currentUser.uid}'`);

            if (currentUserRole === 'supervisor' && (ticketData.unreadCounts?.supervisor || 0) > 0) {
                console.log("markAsRead: Condition for SUPERVISOR met. Resetting count.");
                updateData['unreadCounts.supervisor'] = 0;
            } else if (currentUserRole === 'operador' && ticketData.operatorUid === currentUser.uid && (ticketData.unreadCounts?.operator || 0) > 0) {
                console.log("markAsRead: Condition for OPERATOR met. Resetting count.");
                updateData['unreadCounts.operator'] = 0;
            } else {
                console.log("markAsRead: No condition met to reset unread counts.");
            }

            if (Object.keys(updateData).length > 0) {
                console.log("markAsRead: Calling updateDoc with:", updateData);
                await updateDoc(ticketRef, updateData);
            } else {
                console.log("markAsRead: No update needed.");
            }
        } else {
            console.log("markAsRead: Ticket document not found.");
        }
        console.log("--- Finished markAsRead ---");
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                currentUserRole = userData.role || 'operador'; 
                currentUserName = userData.name;
            } else {
                currentUserRole = 'operador';
            }
            await markAsRead(); 
            listenForTicketUpdates(); 
        } else {
            window.location.href = 'login.html';
        }
    });

    const listenForTicketUpdates = () => {
        const ticketRef = doc(db, 'tickets', ticketId);
        
        unsubscribe = onSnapshot(ticketRef, (docSnap) => {
            if (!docSnap.exists()) {
                alert('El ticket no existe o fue eliminado.');
                window.location.href = 'tickets-supervisor.html'; 
                return;
            }

            const ticket = docSnap.data();
            if (currentUserRole !== 'supervisor' && ticket.operatorUid !== currentUser.uid) {
                alert('No tienes permiso para ver este ticket.');
                window.location.href = 'menu.html';
                return;
            }

            ticketAsunto.textContent = ticket.subject;

            const estadoBadge = document.getElementById('ticket-estado-badge');
            if (estadoBadge) {
                estadoBadge.textContent = ticket.status;
                estadoBadge.className = "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0 ml-auto md:ml-0 transition-all " + 
                    (ticket.status === 'abierto' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400');
            }

            renderMessages(ticket.messages || []);

            cerrarTicketBtn.style.display = 'none';
            eliminarTicketBtn.style.display = 'none';
            if (ticket.status === 'cerrado') {
                mensajeRespuesta.disabled = true;
                enviarRespuestaBtn.disabled = true;
                mensajeRespuesta.placeholder = 'Este ticket está cerrado.';
                if (currentUserRole === 'supervisor') {
                    eliminarTicketBtn.style.display = 'block'; 
                }
            } else { 
                mensajeRespuesta.disabled = false;
                enviarRespuestaBtn.disabled = false;
                mensajeRespuesta.placeholder = 'Escribe tu respuesta...';
                if (currentUserRole === 'supervisor') {
                    cerrarTicketBtn.style.display = 'block'; 
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
                <div class="${isCurrentUser ? 'self-end bg-villalba-blue text-white rounded-br-sm' : 'self-start bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/5 rounded-bl-sm'} p-4 rounded-2xl max-w-[85%] md:max-w-[70%] shadow-sm relative group mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div class="text-[10px] uppercase tracking-widest font-black ${isCurrentUser ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'} mb-1.5 flex items-center justify-between gap-4">
                        <span>${msg.senderName}</span>
                    </div>
                    <div class="text-sm font-medium leading-relaxed whitespace-pre-wrap ${isCurrentUser ? 'text-white' : 'text-slate-700 dark:text-slate-200'}">${msg.text}</div>
                    <div class="text-[9px] uppercase tracking-wider font-bold opacity-50 mt-3 text-right block w-full">${msgDate}</div>
                </div>
            `;
        });
        mensajesContainer.innerHTML = messagesHTML;
        mensajesContainer.scrollTop = mensajesContainer.scrollHeight;
    };

    enviarRespuestaBtn?.addEventListener('click', async () => {
        const text = mensajeRespuesta.value.trim();
        if (!text) return;

        const newMessage = {
            senderUid: currentUser.uid,
            senderName: currentUserName || currentUser.email,
            text: text,
            timestamp: new Date() 
        };

        try {
            const ticketRef = doc(db, 'tickets', ticketId);
            
            const updatePayload = {
                messages: arrayUnion(newMessage),
                lastUpdatedAt: serverTimestamp()
            };
            if (currentUserRole === 'supervisor') {
                updatePayload['unreadCounts.operator'] = increment(1);
            } else { 
                updatePayload['unreadCounts.supervisor'] = increment(1);
            }

            await updateDoc(ticketRef, updatePayload);
            mensajeRespuesta.value = '';
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            alert('Ocurrió un error al enviar la respuesta.');
        }
    });

    mensajeRespuesta?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            enviarRespuestaBtn.click(); 
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

    eliminarTicketBtn?.addEventListener('click', async () => {
        if (currentUserRole !== 'supervisor') return;

        const confirmation = confirm('¿Estás seguro de que quieres eliminar este ticket permanentemente? Esta acción no se puede deshacer.');
        if (!confirmation) return;

        const ticketRef = doc(db, 'tickets', ticketId);
        console.log("Intentando eliminar el ticket con ID:", ticketId);

        try {
            await deleteDoc(ticketRef);
            alert('Se ha enviado la solicitud de eliminación. Serás redirigido a la lista de tickets.');
            window.location.href = 'tickets-supervisor.html'; 
        } catch (error) {
            console.error("Error al eliminar el ticket:", error);
            alert(`Ocurrió un error al intentar eliminar el ticket: ${error.message}`);
        }
    });
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