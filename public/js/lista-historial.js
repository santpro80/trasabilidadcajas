import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, query, orderBy, getDocs, where } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
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
        if(loadingState) loadingState.style.display = 'none';
        if(emptyState) emptyState.style.display = 'none';
        if(historyTableContainer) historyTableContainer.style.display = 'none';
        if(state) state.style.display = 'block';
    };

    onAuthStateChanged(auth, async (user) => {
        if (user && userDisplayNameElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
            loadHistoryData();
        } else if (!user) {
            window.location.href = 'login.html';
        }
    });
    
    const loadHistoryData = async () => {
        showState(loadingState);
        try {
            const historyRef = collection(db, "historial");
            const q = query(historyRef, orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            allHistoryItems = querySnapshot.docs.map(doc => doc.data());
            applyFiltersAndRender();
        } catch (error) {
            console.error("Error al obtener el historial:", error);
            showState(emptyState);
        }
    };

    const applyFiltersAndRender = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        const searchTerm = searchInput.value.toLowerCase();

        if (startDate) startDate.setHours(0, 0, 0, 0);
        if (endDate) endDate.setHours(23, 59, 59, 999);

        const filteredItems = allHistoryItems.filter(item => {
            // Filtro por fecha
            if (item.timestamp) {
                const itemDate = item.timestamp.toDate();
                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate > endDate) return false;
            }

            // Filtro por término de búsqueda
            const user = (item.usuarioNombre || '').toLowerCase();
            const action = (item.accion || '').toLowerCase();
            // ===== CORRECCIÓN AQUÍ =====
            // Se usa el operador 'optional chaining' (?.) para leer 'mensaje' de forma segura.
            const message = (item.detalles?.mensaje || '').toLowerCase();
            
            if (searchTerm && !(user.includes(searchTerm) || action.includes(searchTerm) || message.includes(searchTerm))) {
                return false;
            }
            
            return true;
        });

        renderHistory(filteredItems);
    };

    const renderHistory = (items) => {
        if (items.length === 0) {
            showState(emptyState);
            return;
        }

        if(historyTbody) historyTbody.innerHTML = '';
        
        items.forEach(item => {
            const row = document.createElement('tr');
            const date = item.timestamp ? item.timestamp.toDate().toLocaleString('es-AR', { hour12: false }) : 'N/A';
            
            // ===== CORRECCIÓN AQUÍ =====
            // Si item.detalles.mensaje no existe, muestra 'Sin detalles'.
            const detalleMensaje = item.detalles?.mensaje || 'Sin detalles';

            row.innerHTML = `
                <td>${date}</td>
                <td>${item.usuarioNombre || item.usuarioEmail || 'N/A'}</td>
                <td>${item.accion || 'N/A'}</td>
                <td>${detalleMensaje}</td>
            `;
            if(historyTbody) historyTbody.appendChild(row);
        });

        showState(historyTableContainer);
    };

    if(filterBtn) filterBtn.addEventListener('click', applyFiltersAndRender);
    if(clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => {
            if(searchInput) searchInput.value = '';
            if(startDateInput) startDateInput.value = '';
            if(endDateInput) endDateInput.value = '';
            applyFiltersAndRender();
        });
    }
    if(searchInput) searchInput.addEventListener('input', applyFiltersAndRender);

    if (backBtn) backBtn.addEventListener('click', () => { window.location.href = 'menu.html'; });
    if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
});