import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './firebase-config.js';

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Configurar email de usuario
    onAuthStateChanged(auth, (user) => {
        const userEmail = document.getElementById('user-email');
        if (!user) {
            window.location.href = 'login.html';
        } else if (userEmail) {
            userEmail.textContent = user.email;
        }
    });

    // Botón de cerrar sesión
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error al cerrar sesión: ' + error.message);
            // Considera usar un modal personalizado en lugar de alert()
        }
    });

    // Botones del menú
    document.getElementById('btn-cajas')?.addEventListener('click', () => {
        window.location.href = 'modelos-de-cajas.html'; // Redirige a la página de modelos de cajas
    });

    document.getElementById('btn-historial')?.addEventListener('click', () => {
        // window.location.href = 'historial.html'; // Descomentar cuando exista
        // Considera usar un modal personalizado en lugar de alert()
        console.log('Sección de Historial - En desarrollo');
    });

    document.getElementById('btn-cuenta')?.addEventListener('click', () => {
        // window.location.href = 'cuenta.html'; // Descomentar cuando exista
        // Considera usar un modal personalizado en lugar de alert()
        console.log('Sección de Cuenta - En desarrollo');
    });

    // Nuevo event listener para el botón de Importar Datos
    document.getElementById('btn-importar-datos')?.addEventListener('click', () => {
        window.location.href = 'importar-datos.html'; // Redirige a la página de importación
    });
});
