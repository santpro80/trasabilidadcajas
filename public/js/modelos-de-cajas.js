import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    collection,
    getDocs,
    doc,
    getDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelosList = document.getElementById('modelos-list');
    const userDisplayElement = document.getElementById('user-email');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        if (userDisplayElement) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                userDisplayElement.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email;
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                userDisplayElement.textContent = user.email;
            }
        }

        loadZonas();
    });

    const showState = (stateElement) => {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (modelosList) modelosList.style.display = 'none';

        if (stateElement) {
            stateElement.style.display = 'block';
        }
    };

    const loadZonas = async () => {
        showState(loadingState);
        try {
            const querySnapshot = await getDocs(collection(db, "Cajas"));
            if (modelosList) modelosList.innerHTML = '';

            if (querySnapshot.empty) {
                showState(emptyState);
                return;
            }

            querySnapshot.forEach((doc) => {
                const zonaName = doc.id;
                const listItem = document.createElement('li');
                listItem.className = 'list-item';
                listItem.textContent = zonaName.toUpperCase();

                listItem.addEventListener('click', () => {
                    window.location.href = `modelado-caja.html?zonaName=${encodeURIComponent(zonaName)}`;
                });

                modelosList.appendChild(listItem);
            });

            showState(modelosList);

        } catch (error) {
            console.error("Error al cargar las zonas:", error);
            showState(errorState);
        }
    };

    if (backBtn) {
        // La corrección está aquí: se usa '=>' en lugar de '->'
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }
});