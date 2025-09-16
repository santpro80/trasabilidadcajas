import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, query, getDocs, orderBy, addDoc, serverTimestamp } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const menuBtn = document.getElementById('menu-btn');
    const opinionsList = document.getElementById('opinionsList');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const opinionTemplate = document.getElementById('opinion-template');
    const replyTemplate = document.getElementById('reply-template');

    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    currentUser = { uid: user.uid, ...userData };
                    if (userDisplayNameElement) userDisplayNameElement.textContent = currentUser.name || user.email;
                    
                    if (currentUser.role !== 'supervisor') {
                        console.warn('Acceso denegado. El usuario no es supervisor.');
                        window.location.href = 'menu.html';
                        return;
                    }
                    
                    loadOpinions();

                } else {
                    console.warn('Acceso denegado. Perfil de usuario no encontrado.');
                    window.location.href = 'menu.html';
                }
            } catch (error) {
                console.error("Error de autenticación o permisos:", error);
                window.location.href = 'login.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    const loadOpinions = async () => {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        opinionsList.style.display = 'none';

        try {
            const opinionsRef = collection(db, 'opiniones');
            const q = query(opinionsRef, orderBy('fecha', 'desc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                loadingState.style.display = 'none';
                emptyState.style.display = 'block';
                return;
            }

            opinionsList.innerHTML = '';
            for (const opinionDoc of querySnapshot.docs) {
                const opinion = opinionDoc.data();
                const opinionId = opinionDoc.id;

                const opinionItem = opinionTemplate.content.cloneNode(true).querySelector('.opinion-item');

                opinionItem.querySelector('.opinion-user').textContent = opinion.userName || 'Usuario desconocido';
                opinionItem.querySelector('.opinion-date').textContent = opinion.fecha ? opinion.fecha.toDate().toLocaleString('es-AR') : 'Fecha no disponible';
                opinionItem.querySelector('.opinion-body').textContent = opinion.opinion;

                // Cargar respuestas
                const repliesList = opinionItem.querySelector('.replies-list');
                const repliesRef = collection(db, 'opiniones', opinionId, 'respuestas');
                const repliesQuery = query(repliesRef, orderBy('fecha', 'asc'));
                const repliesSnapshot = await getDocs(repliesQuery);

                repliesSnapshot.forEach(replyDoc => {
                    const reply = replyDoc.data();
                    const replyItem = replyTemplate.content.cloneNode(true).querySelector('.reply-item');
                    replyItem.querySelector('.reply-user').textContent = reply.userName || 'Supervisor';
                    replyItem.querySelector('.reply-date').textContent = reply.fecha ? reply.fecha.toDate().toLocaleString('es-AR') : '';
                    replyItem.querySelector('.reply-body').textContent = reply.respuesta;
                    repliesList.appendChild(replyItem);
                });

                // Configurar formulario de respuesta
                const replyTextarea = opinionItem.querySelector('.reply-textarea');
                const btnReply = opinionItem.querySelector('.btn-reply');

                btnReply.addEventListener('click', async () => {
                    const replyText = replyTextarea.value.trim();
                    if (replyText) {
                        await addReply(opinionId, replyText);
                        replyTextarea.value = '';
                        // Recargar solo esa opinión para ver la nueva respuesta
                        loadOpinions(); // Simple reload for now
                    }
                });

                opinionsList.appendChild(opinionItem);
            }

            loadingState.style.display = 'none';
            opinionsList.style.display = 'flex';

        } catch (error) {
            console.error("Error cargando las opiniones:", error);
            loadingState.textContent = 'Error al cargar las opiniones.';
        }
    };

    const addReply = async (opinionId, respuesta) => {
        if (!currentUser) return;

        try {
            const repliesRef = collection(db, 'opiniones', opinionId, 'respuestas');
            await addDoc(repliesRef, {
                respuesta,
                fecha: serverTimestamp(),
                userId: currentUser.uid,
                userName: currentUser.name
            });
        } catch (error) {
            console.error('Error al agregar la respuesta:', error);
        }
    };

    logoutBtn?.addEventListener('click', () => {
        signOut(auth).catch(error => console.error('Error al cerrar sesión:', error));
    });

    menuBtn?.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
});