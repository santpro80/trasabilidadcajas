import { auth, onAuthStateChanged } from './firebase-config-pedidos.js';
import { renderSideDrawer, initApp } from './app.js';

initApp().then((user) => {
    // Current user ya está disponible si la app se inicializó
    const isSupervisor = user?.role === 'supervisor';

    // Rellenamos el rol
    const subtituloContainer = document.getElementById('dashboard-subtitle');
    if (subtituloContainer) {
        subtituloContainer.innerText = `PEDIDOS INTERNOS - ${user?.role || 'OPERADOR'}`;
    }

    // Ocultar botones que no correspondan (TEMPORAL: Apagado para acceder a todo)
    /*
    if (!isSupervisor) {
        const gestionBtn = document.getElementById('btn-gestion');
        if (gestionBtn) gestionBtn.classList.add('hidden');

        const reportesBtn = document.getElementById('btn-reportes');
        if (reportesBtn) reportesBtn.classList.add('hidden');

        const adminBtn = document.getElementById('btn-admin');
        if (adminBtn) adminBtn.classList.add('hidden');
    }
    */

    // Inicialización del panel completada, quitamos el skeleton si lo hubiera o mostramos el panel
    document.getElementById('dashboard-content').classList.remove('hidden');
    document.getElementById('loading-state').classList.add('hidden');
});
