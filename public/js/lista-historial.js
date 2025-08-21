// public/js/lista-historial.js

import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, query, orderBy, getDocs, where } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const historyTableContainer = document.getElementById('history-table-container');
    const historyTbody = document.getElementById('history-tbody');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    
    const searchInput = document.getElementById('search-input');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const filterBtn = document.getElementById('filter-btn');
    const clearFilterBtn = document.getElementById('clear-filter-btn');

    let allHistoryItems = [];

    const showState = (state) => {
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        historyTableContainer.style.display = 'none';
        if(state) state.style.display = 'block';
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                userDisplayNameElement.textContent = userDocSnap.exists() ? userDocSnap.data().name : user.email;
                loadHistoryData();
            } catch (error) {
                console.error("Error al cargar datos de usuario:", error);
            }
        } else {
            window.location.href = 'login.html';
        }
    });
    
    const loadHistoryData = async (filters = {}) => {
        showState(loadingState);
        try {
            const historyRef = collection(db, "historial");
            let q = query(historyRef, orderBy("timestamp", "desc"));

            if (filters.startDate) {
                q = query(q, where("timestamp", ">=", filters.startDate));
            }
            if (filters.endDate) {
                const endOfDay = new Date(filters.endDate);
                endOfDay.setHours(23, 59, 59, 999);
                q = query(q, where("timestamp", "<=", endOfDay));
            }

            const querySnapshot = await getDocs(q);
            allHistoryItems = querySnapshot.docs.map(doc => doc.data());
            renderHistory(allHistoryItems);

        } catch (error) {
            console.error("Error al obtener el historial:", error);
            showState(emptyState);
        }
    };

    // ===== FUNCIÓN MODIFICADA PARA RENDERIZAR EN TABLA =====
    const renderHistory = (items) => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredItems = items.filter(item => {
            const user = item.usuarioNombre.toLowerCase();
            const action = item.accion.toLowerCase();
            const message = item.detalles.mensaje.toLowerCase();
            return user.includes(searchTerm) || action.includes(searchTerm) || message.includes(searchTerm);
        });

        if (filteredItems.length === 0) {
            showState(emptyState);
            return;
        }

        historyTbody.innerHTML = ''; // Limpiar el cuerpo de la tabla
        
        filteredItems.forEach(item => {
            const row = document.createElement('tr');
            const date = item.timestamp ? item.timestamp.toDate().toLocaleString('es-AR') : 'N/A';

            row.innerHTML = `
                <td>${date}</td>
                <td>${item.usuarioNombre || item.usuarioEmail}</td>
                <td>${item.accion}</td>
                <td>${item.detalles.mensaje}</td>
            `;
            historyTbody.appendChild(row);
});

        showState(historyTableContainer);
    };

    filterBtn.addEventListener('click', () => {
        const filters = {};
        if (startDateInput.value) filters.startDate = new Date(startDateInput.value);
        if (endDateInput.value) filters.endDate = new Date(endDateInput.value);
        loadHistoryData(filters);
    });

    clearFilterBtn.addEventListener('click', () => {
        searchInput.value = '';
        startDateInput.value = '';
        endDateInput.value = '';
        loadHistoryData();
    });
    
    searchInput.addEventListener('input', () => {
        renderHistory(allHistoryItems);
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }
});