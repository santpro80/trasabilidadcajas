import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, query, getDocs, orderBy } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const menuBtn = document.getElementById('menu-btn');
    const opinionsList = document.getElementById('opinionsList');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userDisplayNameElement) userDisplayNameElement.textContent = userData.name || user.email;
                    
                    // Security check: Only supervisors can see this page
                    if (userData.role !== 'supervisor') {
                        console.warn('Acceso denegado. El usuario no es supervisor.');
                        window.location.href = 'menu.html';
                        return;
                    }
                    
                    loadOpinions();

                } else {
                    // If user has no document, they are treated as operator, deny access
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
            querySnapshot.forEach(doc => {
                const opinion = doc.data();
                const li = document.createElement('li');
                li.className = 'opinion-item';

                const date = opinion.fecha ? opinion.fecha.toDate().toLocaleString('es-AR') : 'Fecha no disponible';

                li.innerHTML = `
                    <div class="opinion-header">
                        <span class="opinion-user">${opinion.userName || 'Usuario desconocido'}</span>
                        <span class="opinion-date">${date}</span>
                    </div>
                    <p class="opinion-body">${opinion.opinion}</p>
                `;
                opinionsList.appendChild(li);
            });

            loadingState.style.display = 'none';
            opinionsList.style.display = 'flex';

        } catch (error) {
            console.error("Error cargando las opiniones:", error);
            loadingState.textContent = 'Error al cargar las opiniones.';
        }
    };

    logoutBtn?.addEventListener('click', () => {
        signOut(auth).catch(error => console.error('Error al cerrar sesión:', error));
    });

    menuBtn?.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });
});