// public/js/menu.js

// 1. IMPORTACIÓN CENTRALIZADA
// Todas las herramientas de Firebase se piden a nuestro archivo de configuración.
import {
    auth,
    db,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Captura de elementos del DOM ---
    // Asegúrate de que el ID en tu menu.html coincida (puede ser 'user-email' o 'user-display-name')
    const userDisplayElement = document.getElementById('user-email') || document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const btnCajas = document.getElementById('btn-cajas');
    const btnHistorial = document.getElementById('btn-historial');
    const btnCuenta = document.getElementById('btn-cuenta');
    const btnImportarDatos = document.getElementById('btn-importar-datos');

    // --- Verificación de estado de autenticación ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Si el usuario está logueado, buscamos su nombre en Firestore
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    // Mostramos el nombre; si no tiene, mostramos el email
                    if (userDisplayElement) {
                        userDisplayElement.textContent = userData.name || user.email;
                    }
                } else {
                    // Si no hay datos en Firestore, mostramos el email
                    if (userDisplayElement) {
                        userDisplayElement.textContent = user.email;
                    }
                }
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                // En caso de error, mostramos el email como fallback
                if (userDisplayElement) {
                    userDisplayElement.textContent = user.email;
                }
            }
        } else {
            // Si no hay usuario, redirigir a la página de login
            // 2. RUTA RELATIVA
            window.location.href = 'login.html';
        }
    });

    // --- Listeners para los botones del menú ---

    // Botón de cerrar sesión
    logoutBtn?.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html'; // RUTA RELATIVA
        } catch (error) {
            console.error('Error al cerrar sesión: ', error);
        }
    });

    // Botón de Gestión de Cajas
    btnCajas?.addEventListener('click', () => {
        window.location.href = 'modelos-de-cajas.html'; // RUTA RELATIVA
    });

    // Botón de Historial
    btnHistorial?.addEventListener('click', () => {
        window.location.href = 'lista-historial.html'; // RUTA RELATIVA
    });

    // Botón de Cuenta
    btnCuenta?.addEventListener('click', () => {
        window.location.href = 'cuenta.html'; // RUTA RELATIVA
    });

    // Botón de Importar Datos
    btnImportarDatos?.addEventListener('click', () => {
        // Esta página redirige a las dos opciones de importación
        window.location.href = 'redir-import.html'; // RUTA RELATIVA
    });
});