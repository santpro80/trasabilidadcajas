import {
    db, auth, onAuthStateChanged, signOut,
    getDoc, doc, collection, query, where, getDocs, orderBy, onSnapshot, setDoc
} from './firebase-config.js';
import { setupTicketNotifications } from './global-notifications.js';

let notificationTimeout;
const showNotification = (message, type = 'success') => {
    const toast = document.getElementById('notification-toast');
    if (!toast) return;
    clearTimeout(notificationTimeout);
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type);
    notificationTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
};

const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'Hora no disponible';
    return timestamp.toDate().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const userDisplayNameElement = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const menuBtn = document.getElementById('menu-btn');
const mainContent = document.getElementById('main-content');
const unauthorizedState = document.getElementById('unauthorized-state');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const reportDateInput = document.getElementById('report-date');
const sectorFilter = document.getElementById('sector-filter');
const entradasList = document.getElementById('entradas-list');
const salidasList = document.getElementById('salidas-list');
const entradasCount = document.getElementById('entradas-count');
const salidasCount = document.getElementById('salidas-count');

const showPageContent = () => {
    mainContent.style.display = 'flex';
    unauthorizedState.style.display = 'none';
};

const showUnauthorized = () => {
    mainContent.style.display = 'none';
    unauthorizedState.style.display = 'block';
};

const showState = (stateElement) => {
    const allStates = [loadingState, emptyState, errorState];
    allStates.forEach(el => { if (el) el.style.display = 'none'; });
    if (stateElement) stateElement.style.display = 'block';
};


const buildSerialToModelMap = async () => {
    const serialMap = new Map();
    try {
        const zonasSnapshot = await getDocs(collection(db, "Cajas"));
        zonasSnapshot.forEach(zonaDoc => {
            const zonaData = zonaDoc.data();
            for (const modelName in zonaData) {
                if (typeof zonaData[modelName] === 'string') {
                    const serials = zonaData[modelName].split(',').filter(Boolean);
                    serials.forEach(serial => {
                        serialMap.set(serial.trim(), modelName);
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error building the serial-to-model map:", error);
    }
    return serialMap;
};

// Función para cargar los sectores (Igual que en las otras páginas)
const loadSectors = async () => {
    if (!sectorFilter) return;
    
    try {
        const docRef = doc(db, "config", "sectors_list");
        const docSnap = await getDoc(docRef);
        let sectors = [];

        if (docSnap.exists()) {
            sectors = docSnap.data().list || [];
        } else {
            sectors = ['002', '004', '005', '007', '008'];
            await setDoc(docRef, { list: sectors });
        }

        sectors.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = `Sector ${sector}`;
            sectorFilter.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando sectores:", error);
    }
};

const fetchAndRenderReport = async (fecha) => {
    if (!entradasList || !salidasList) return;

    showState(loadingState);
    entradasList.innerHTML = '';
    salidasList.innerHTML = '';
    entradasCount.textContent = '0';
    salidasCount.textContent = '0';

    try {
        const serialToModelMap = await buildSerialToModelMap();
        const q = query(
            collection(db, "movimientos_cajas"), 
            where("fecha", "==", fecha), 
            orderBy("timestamp", "desc")
        );

        // Cargamos movimientos y usuarios (para mapear sectores antiguos) en paralelo
        const [querySnapshot, usersSnapshot] = await Promise.all([
            getDocs(q),
            getDocs(collection(db, "users"))
        ]);

        // Mapa de email -> sector
        const usersMap = {};
        usersSnapshot.forEach(doc => {
            const d = doc.data();
            if (d.email && d.sector) usersMap[d.email] = d.sector;
        });

        const selectedSector = sectorFilter ? sectorFilter.value : '';

        // Filtramos en memoria
        const filteredDocs = querySnapshot.docs.filter(docSnap => {
            if (!selectedSector) return true; // Si no hay filtro, mostrar todo
            const data = docSnap.data();
            // Usamos el sector del documento O el del usuario actual si es un registro viejo
            const docSector = data.sector || usersMap[data.usuarioEmail];
            return docSector === selectedSector;
        });

        if (filteredDocs.length === 0) {
            showState(emptyState);
            return;
        }

        let entradas = 0;
        let salidas = 0;
        filteredDocs.forEach(docSnap => {
            const movimiento = docSnap.data();
            const modeloCaja = serialToModelMap.get(movimiento.cajaSerie) || ''; 

            const listItem = document.createElement('li');
            listItem.className = 'px-6 py-4 border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex justify-between items-center group';

            const prestamoInfo = movimiento.prestamoNum ? `<span class="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md self-start mt-1 uppercase tracking-widest border border-indigo-500/20">Préstamo: ${movimiento.prestamoNum}</span>` : '';
            const sectorInfo = movimiento.sector || usersMap[movimiento.usuarioEmail] || 'N/A';

            listItem.innerHTML = `
                <div class="flex flex-col gap-1 w-full overflow-hidden">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight truncate">${movimiento.cajaSerie} ${modeloCaja}</span>
                        <span class="inline-block font-bold text-[9px] bg-villalba-blue/10 dark:bg-villalba-blue/20 text-villalba-blue dark:text-blue-400 px-2 py-0.5 rounded uppercase tracking-wider self-start sm:self-auto border border-villalba-blue/20 shadow-sm">${sectorInfo}</span>
                    </div>
                    <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Por: <span class="font-bold text-slate-600 dark:text-slate-300">${movimiento.usuarioNombre || 'N/A'}</span></span>
                    ${prestamoInfo}
                </div>
                <div class="flex flex-col items-end shrink-0 ml-4">
                    <span class="text-xs font-black text-villalba-blue tracking-widest bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-105 transition-transform">${formatDate(movimiento.timestamp)}</span>
                </div>
            `;

            if (movimiento.tipo === 'Entrada') {
                entradasList.appendChild(listItem);
                entradas++;
            } else {
                salidasList.appendChild(listItem);
                salidas++;
            }
        });

        entradasCount.textContent = entradas;
        salidasCount.textContent = salidas;
        showState(null); 

    } catch (error) {
        console.error("Error al cargar el informe:", error);
        showState(errorState);
        showNotification('No se pudo cargar el informe.', 'error');
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userRole = userDocSnap.data().role;
            setupTicketNotifications(db, collection, query, where, onSnapshot, user, userRole);

            if (userRole === 'supervisor') {
                const userName = userDocSnap.data().name || user.email;
                if (userDisplayNameElement) userDisplayNameElement.textContent = userName;
                showPageContent();
                initializePage();
            } else {
                showUnauthorized();
                if (userDisplayNameElement) userDisplayNameElement.textContent = userDocSnap.data()?.name || user.email;
            }
        } else {
            showUnauthorized();
        }
    } else {
        window.location.href = 'login.html';
    }
});

const initializePage = () => {
    const today = new Date().toISOString().split('T')[0];
    reportDateInput.value = today;
    loadSectors(); // Cargar lista de sectores
    fetchAndRenderReport(today);
    reportDateInput.addEventListener('change', () => {
        fetchAndRenderReport(reportDateInput.value);
    });
    if (sectorFilter) {
        sectorFilter.addEventListener('change', () => {
            fetchAndRenderReport(reportDateInput.value);
        });
    }
};
logoutBtn?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = '../login.html';
    });
});

menuBtn?.addEventListener('click', () => {
    window.location.href = 'menu.html';
});
