import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    getDoc,
    doc,
    collection, query, where, orderBy, getDocs, limit
} from './firebase-config.js';

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
            const prestamoDocRef = doc(db, "prestamos", numeroPrestamo);
            const salidaDocSnap = await getDoc(prestamoDocRef);

            if (!salidaDocSnap.exists()) {
                emptyState.querySelector('p').textContent = `No se encontraron cajas para el préstamo "${numeroPrestamo}".`;
                showState('empty');
                return;
            }

            const salidaData = salidaDocSnap.data();
            const cajaSerie = salidaData.cajaSerie;
            const salidaTimestamp = salidaData.timestamp;

            const movimientosQuery = query(
                collection(db, "movimientos_cajas"),
                where("cajaSerie", "==", cajaSerie),
                where("tipo", "==", "Entrada"),
                where("timestamp", ">", salidaTimestamp),
                orderBy("timestamp", "asc"),
                limit(1)
            );
            const entradaSnapshot = await getDocs(movimientosQuery);
            const entradaData = entradaSnapshot.empty ? null : entradaSnapshot.docs[0].data();
            const entradaTimestamp = entradaData ? entradaData.timestamp : null;
            const consumoQuery = query(
                collection(db, "historial"),
                where("detalles.cajaSerie", "==", cajaSerie),
                where("detalles.valorNuevo", "==", "REEMPLAZAR"),
                where("timestamp", ">", salidaTimestamp),
                ...(entradaTimestamp ? [where("timestamp", "<", entradaTimestamp)] : [])
            );
            const consumoSnapshot = await getDocs(consumoQuery);
            const itemsConsumidos = consumoSnapshot.docs.map(doc => doc.data().detalles);
            renderResults(salidaData, entradaData, itemsConsumidos);
            showState('results');

        } catch (error) {
            console.error("Error al buscar por préstamo:", error);
            errorState.querySelector('p').textContent = `Error: ${error.message}`;
            showState('error');
        }
    };

    const renderResults = (salida, entrada, consumidos) => {
        resultsContainer.innerHTML = ''; 
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';

        const fechaSalida = salida.timestamp ? new Date(salida.timestamp.seconds * 1000).toLocaleString('es-AR') : 'N/A';
        const fechaEntrada = entrada ? new Date(entrada.timestamp.seconds * 1000).toLocaleString('es-AR') : 'Aún no registrada';

        resultCard.innerHTML = `
            <div class="result-header">
                <div class="caja-serie">${salida.cajaSerie || 'N/A'}</div>
                <div class="modelo">${salida.modelName || 'No especificado'}</div>
            </div>
            <div class="movements">
                <div class="movement-item">
                    <span class="movement-label salida">Salida:</span>
                    <span class="movement-date">${fechaSalida}</span>
                    <span class="movement-user">por ${salida.usuarioNombre || 'N/A'}</span>
                </div>
                <div class="movement-item">
                    <span class="movement-label entrada">Entrada:</span>
                    <span class="movement-date">${fechaEntrada}</span>
                    ${entrada ? `<span class="movement-user">por ${entrada.usuarioNombre || 'N/A'}</span>` : ''}
                </div>
            </div>
        `;

        if (consumidos.length > 0) {
            const consumoCard = document.createElement('div');
            consumoCard.className = 'consumo-card';
            let itemsHTML = consumidos.map(item => `<li>${item.itemDescripcion} (Serie: ${item.valorAnterior})</li>`).join('');
            
            consumoCard.innerHTML = `
                <h3>Ítems Consumidos en este Préstamo</h3>
                <ul>${itemsHTML}</ul>
            `;
            resultCard.appendChild(consumoCard);
        }
        resultCard.addEventListener('click', () => {
            const url = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(salida.cajaSerie)}&modelName=${encodeURIComponent(salida.modelName)}`;
            window.location.href = url;
        });

        resultsContainer.appendChild(resultCard);
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