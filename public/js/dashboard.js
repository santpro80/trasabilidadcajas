import { 
  getAuth, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  getCountFromServer,
  query,
  where,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app, db } from './firebase-config.js';

// Elementos del DOM
const elements = {
  userEmail: document.getElementById('user-email'),
  logoutBtn: document.getElementById('logout-btn'),
  cajasCount: document.getElementById('cajas-count'),
  itemsCount: document.getElementById('items-count'),
  movimientosCount: document.getElementById('movimientos-count'),
  menuButtons: {
    cajas: document.getElementById('btn-cajas'),
    items: document.getElementById('btn-items'),
    historial: document.getElementById('btn-historial'),
    reportes: document.getElementById('btn-reportes')
  }
};

// Inicialización de Firebase
const auth = getAuth(app);
const firestore = getFirestore(app);

// Controlador de autenticación
const initAuthListener = () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      elements.userEmail.textContent = user.email;
      loadDashboardData();
    } else {
      window.location.href = 'login.html';
    }
  });
};

// Cargar datos del dashboard
const loadDashboardData = async () => {
  try {
    // Obtener conteo de cajas
    const cajasCol = collection(firestore, 'cajas');
    const cajasSnapshot = await getCountFromServer(cajasCol);
    elements.cajasCount.textContent = cajasSnapshot.data().count;

    // Obtener conteo de ítems
    const itemsCol = collection(firestore, 'items');
    const itemsSnapshot = await getCountFromServer(itemsCol);
    elements.itemsCount.textContent = itemsSnapshot.data().count;

    // Obtener movimientos de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const movimientosCol = collection(firestore, 'movimientos');
    const q = query(
      movimientosCol,
      where('fecha', '>=', Timestamp.fromDate(hoy))
    );
    
    const querySnapshot = await getDocs(q);
    elements.movimientosCount.textContent = querySnapshot.size;

  } catch (error) {
    console.error("Error cargando datos:", error);
    // Puedes mostrar un mensaje de error en la UI si lo prefieres
  }
};

// Controladores de eventos
const setupEventListeners = () => {
  // Logout
  elements.logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = 'login.html';
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert('Error al cerrar sesión');
    }
  });

  // Navegación del menú
  elements.menuButtons.cajas.addEventListener('click', () => {
    // Redirigir o cargar módulo de cajas
    console.log("Navegar a gestión de cajas");
    // window.location.href = 'cajas.html';
  });

  elements.menuButtons.items.addEventListener('click', () => {
    console.log("Navegar a gestión de ítems");
  });

  elements.menuButtons.historial.addEventListener('click', () => {
    console.log("Navegar a historial");
  });

  elements.menuButtons.reportes.addEventListener('click', () => {
    console.log("Navegar a reportes");
  });
};

// Inicialización de la aplicación
const initDashboard = () => {
  initAuthListener();
  setupEventListeners();
};

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initDashboard);