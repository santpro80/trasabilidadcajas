import {
    auth,
    db,
    functions,
    onAuthStateChanged,
    signOut,
    getDoc,
    doc,
} from './firebase-config.js'; // No necesitamos httpsCallable

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const menuBtn = document.getElementById('menu-btn');
    const searchInput = document.getElementById('prestamo-search-input');
    const searchBtn = document.getElementById('search-btn');
    const resultsContainer = document.getElementById('results-container');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const errorState = document.getElementById('error-state');

    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDisplayNameElement) {
                userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    const showState = (state) => {
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        errorState.style.display = 'none';
        resultsContainer.style.display = 'none';

        if (state === 'loading') loadingState.style.display = 'block';
        else if (state === 'empty') emptyState.style.display = 'block';
        else if (state === 'error') errorState.style.display = 'block';
        else if (state === 'results') resultsContainer.style.display = 'flex';
    };

    const performSearch = async () => {
        const numeroPrestamo = searchInput.value.trim();
        if (!numeroPrestamo) {
            alert('Por favor, ingresa un número de préstamo.');
            return;
        }

        showState('loading');
        resultsContainer.innerHTML = '';

        try {
            // NUEVO: Consultar directamente a Firestore
            const prestamoDocRef = doc(db, "prestamos", numeroPrestamo);
            const docSnap = await getDoc(prestamoDocRef);

            if (!docSnap.exists()) {
                emptyState.querySelector('p').textContent = `No se encontraron cajas para el préstamo "${numeroPrestamo}".`;
                showState('empty');
                return;
            }

            // Creamos un array con un solo elemento para reutilizar la función renderResults
            const prestamoData = [docSnap.data()];
            renderResults(prestamoData);
            showState('results');

        } catch (error) {
            console.error("Error al buscar por préstamo:", error);
            errorState.querySelector('p').textContent = `Error: ${error.message}`;
            showState('error');
        }
    };

    const renderResults = (movimientos) => {
        resultsContainer.innerHTML = '';
        movimientos.forEach(mov => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';

            // Convertir el timestamp de Firestore a un objeto Date de JavaScript
            const fecha = mov.timestamp ? new Date(mov.timestamp.seconds * 1000).toLocaleString('es-AR') : 'Fecha no disponible';

            resultItem.innerHTML = `
                <div class="info">
                    <div class="caja-serie">${mov.cajaSerie || 'N/A'}</div>
                    <div class="modelo">Modelo: ${mov.modelName || 'No especificado'}</div>
                    <div class="usuario">Registrado por: ${mov.usuarioNombre || 'N/A'}</div>
                </div>
                <div class="timestamp">${fecha}</div>
            `;
            
            // Añadir evento para ir al detalle de la caja
            resultItem.addEventListener('click', () => {
                const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(mov.cajaSerie)}&modelName=${encodeURIComponent(mov.modelName)}`;
                window.location.href = url;
            });

            resultsContainer.appendChild(resultItem);
        });
    };

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'login.html';
            });
        });
    }
});