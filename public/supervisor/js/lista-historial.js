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
        let startDate = null;
        if (startDateInput.value) {
            startDate = new Date(startDateInput.value);
            startDate.setHours(0, 0, 0, 0); 
        }

        let endDate = null;
        if (endDateInput.value) {
            endDate = new Date(endDateInput.value);
            endDate.setHours(23, 59, 59, 999); 
        }

        const searchTerm = searchInput.value.toLowerCase();

        console.log("Filtro - Fecha Inicio (Local):", startDate ? startDate.toLocaleString() : "N/A");
        console.log("Filtro - Fecha Fin (Local):", endDate ? endDate.toLocaleString() : "N/A");

        const filteredItems = allHistoryItems.filter(item => {
            if (item.timestamp) {
                const itemDate = item.timestamp.toDate(); 
                
                console.log("  Item - Fecha (Local):", itemDate.toLocaleString());
                console.log("  Item - Fecha (UTC):", itemDate.toUTCString());
                console.log("  Comparando:", itemDate.getTime(), "con", startDate ? startDate.getTime() : "N/A", "y", endDate ? endDate.getTime() : "N/A");

                if (startDate && itemDate < startDate) {
                    console.log("    Filtrado: itemDate < startDate");
                    return false;
                }
                if (endDate && itemDate > endDate) {
                    console.log("    Filtrado: itemDate > endDate");
                    return false;
                }
            }

            const user = (item.usuarioNombre || '').toLowerCase();
            const action = (item.accion || '').toLowerCase();
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
            const detalleMensaje = item.detalles?.mensaje || 'Sin detalles';

            row.innerHTML = `
                <td>${date}</td>
                <td>${item.usuarioNombre || item.usuarioEmail || 'N/A'}</td>
                <td>${item.sector || 'N/A'}</td>
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