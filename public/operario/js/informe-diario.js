import {
    db, auth, onAuthStateChanged, signOut,
    getDoc, doc, collection, query, where, getDocs, orderBy, onSnapshot
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

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showState(emptyState);
            return;
        }

        let entradas = 0;
        let salidas = 0;
        querySnapshot.forEach(docSnap => {
            const movimiento = docSnap.data();
            const modeloCaja = serialToModelMap.get(movimiento.cajaSerie) || ''; 

            const listItem = document.createElement('li');
            listItem.className = 'list-item';

            const prestamoInfo = movimiento.prestamoNum ? `<div class="prestamo-info">Préstamo: ${movimiento.prestamoNum}</div>` : '';

            listItem.innerHTML = `
                <div class="item-info">
                    <span class="caja-serie">${movimiento.cajaSerie} ${modeloCaja}</span>
                    <span class="usuario-info">Por: ${movimiento.usuarioNombre || 'N/A'}</span>
                    ${prestamoInfo}
                </div>
                <span class="item-timestamp">${formatDate(movimiento.timestamp)}</span>
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

            const uidUsuarioEspecial = "k2PzZ3iXA4YNrhBADWj2DC6Or202";

            if (userRole === 'supervisor' || user.uid === uidUsuarioEspecial) {
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
    fetchAndRenderReport(today);
    reportDateInput.addEventListener('change', () => {
        fetchAndRenderReport(reportDateInput.value);
    });
};
logoutBtn?.addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
});

menuBtn?.addEventListener('click', () => {
    window.location.href = 'menu.html';
});
