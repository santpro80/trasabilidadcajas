import { auth, db, onAuthStateChanged, collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const ticketsContainer = document.getElementById('tickets-container');
    const filtroEstado = document.getElementById('filtro-estado');
    const menuBtn = document.getElementById('menu-btn');
    const crearTicketBtn = document.getElementById('crear-ticket-btn');

    let currentUser = null;
    let currentUserName = null;
    let currentUserRole = null;
    let unsubscribeTickets = null; 

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists() && userDocSnap.data().role === 'supervisor') {
                currentUserName = userDocSnap.data().name;
                currentUserRole = userDocSnap.data().role;
                listenForTickets();
            } else {
                window.location.href = 'tickets-operador.html';
                localStorage.setItem('redirectAfterLogin', window.location.href); // Added for consistency, though it redirects to another app page
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    const listenForTickets = () => {
        if (!ticketsContainer) return;
        ticketsContainer.innerHTML = '<p>Cargando tickets...</p>';

        if (unsubscribeTickets) unsubscribeTickets(); 

        const status = filtroEstado.value;
        let q;
        if (status === 'todos') {
            q = query(collection(db, 'tickets'));
        } else {
            q = query(collection(db, 'tickets'), where('status', '==', status));
        }

        unsubscribeTickets = onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                ticketsContainer.innerHTML = `<p>No se encontraron tickets.</p>`;
                return;
            }

            let ticketsHTML = '';
            const tickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tickets.sort((a, b) => (b.lastUpdatedAt?.toMillis() || 0) - (a.lastUpdatedAt?.toMillis() || 0));

            tickets.forEach(ticket => {
                const lastUpdate = ticket.lastUpdatedAt?.toDate().toLocaleString() || 'N/A';
                const unreadCount = ticket.unreadCounts?.supervisor || 0;

                ticketsHTML += `
                    <div class="bg-white dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-villalba-blue/30 transition-all cursor-pointer relative group flex flex-col justify-between min-h-[160px] ticket-card" data-id="${ticket.id}">
                        ${unreadCount > 0 ? `<div class="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-[11px] shadow-lg shadow-rose-500/30 ring-4 ring-white dark:ring-slate-900">${unreadCount}</div>` : ''}
                        
                        <div>
                            <div class="flex items-center justify-between mb-4">
                                <div class="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${ticket.status === 'abierto' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}">${ticket.status === 'abierto' ? 'Abierto' : 'Cerrado'}</div>
                            </div>
                            <h3 class="text-base font-black text-slate-800 dark:text-white leading-tight mb-2 uppercase break-words line-clamp-2">${ticket.subject}</h3>
                            <p class="text-slate-500 dark:text-slate-400 text-xs font-semibold tracking-wide uppercase mb-6 flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">person</span> ${ticket.operatorName}</p>
                        </div>
                        
                        <div class="flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-widest font-bold mt-auto border-t border-slate-100 dark:border-white/5 pt-4">
                            <span class="material-symbols-outlined text-[14px] opacity-70">schedule</span>
                            ${lastUpdate}
                        </div>
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

    const showCreateTicketModal = () => {
        const modalHTML = `
            <div id="create-ticket-modal" class="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div class="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-white/20 dark:border-white/10 relative overflow-hidden flex flex-col gap-6 scale-in-center">
                    <div class="absolute inset-0 bg-gradient-to-br from-villalba-blue/5 to-transparent pointer-events-none"></div>
                    
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue shrink-0">
                            <span class="material-symbols-outlined text-[24px]">support_agent</span>
                        </div>
                        <div>
                            <h2 class="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Nuevo Ticket</h2>
                            <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">Crear consulta o reporte</p>
                        </div>
                    </div>
                    
                    <div class="relative z-10 space-y-4">
                        <input type="text" id="ticket-subject-input" placeholder="Asunto del ticket" class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-villalba-blue/50 focus:border-villalba-blue transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400">
                        <textarea id="ticket-message-input" placeholder="Describe tu problema o consulta detalladamente..." class="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-villalba-blue/50 focus:border-villalba-blue transition-all min-h-[150px] resize-y placeholder:font-normal placeholder:text-slate-400 max-h-[300px]"></textarea>
                    </div>
                    
                    <div class="relative z-10 flex gap-3 mt-2">
                        <button id="cancel-ticket-btn" class="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase text-xs tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                        <button id="submit-ticket-btn" class="flex-1 py-3 rounded-xl bg-villalba-blue text-white font-bold uppercase text-xs tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">Crear Ticket</button>
                    </div>
                </div>
            </div>
            <style>
                .scale-in-center { animation: scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both; }
                @keyframes scale-in-center { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                .fade-in { animation: fadeIn 0.3s ease-in-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            </style>
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
                        supervisor: 0,
                        operator: 1   
                    }
                });
                modal.remove();
            } catch (error) {
                console.error("Error al crear el ticket:", error);
                alert('Ocurrió un error al crear el ticket.');
            }
        });
    };

    crearTicketBtn?.addEventListener('click', showCreateTicketModal);

    filtroEstado?.addEventListener('change', listenForTickets);

    menuBtn?.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
    window.addEventListener('beforeunload', () => {
        if (unsubscribeTickets) unsubscribeTickets();
    });
});
