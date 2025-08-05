// public/js/menu.js

// Importa las instancias de Firebase desde el archivo de configuración centralizado
import { app, auth, db } from './firebase-config.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Configurar nombre de usuario en lugar de email
    onAuthStateChanged(auth, async (user) => {
        const userDisplayElement = document.getElementById('user-display-name'); // Nuevo ID para el nombre
        const userEmailElement = document.getElementById('user-email'); // Si aún quieres mostrar el email

        if (!user) {
            window.location.href = 'login.html';
        } else {
            // Obtenemos el nombre del usuario desde Firestore
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userDisplayElement) {
                        userDisplayElement.textContent = userData.name || user.email; // Muestra nombre o email si no hay nombre
                    }
                    if (userEmailElement) { // Si mantienes un elemento para el email
                        userEmailElement.textContent = user.email;
                    }
                } else {
                    if (userDisplayElement) {
                        userDisplayElement.textContent = user.email; // Si no hay datos en Firestore, muestra el email
                    }
                    console.warn("Datos de usuario no encontrados en Firestore para UID:", user.uid);
                }
            } catch (error) {
                console.error("Error al obtener datos del usuario de Firestore:", error);
                if (userDisplayElement) {
                    userDisplayElement.textContent = user.email; // En caso de error, muestra el email
                }
            }
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

    // CAMBIO AQUI: Redirige a la nueva página de historial
    document.getElementById('btn-historial')?.addEventListener('click', () => {
        window.location.href = 'lista-historial.html'; 
    });

    // Redirige a la página de cuenta
    document.getElementById('btn-cuenta')?.addEventListener('click', () => {
        window.location.href = 'cuenta.html'; 
    });

    // Nuevo event listener para el botón de Importar Datos
    document.getElementById('btn-importar-datos')?.addEventListener('click', () => {
        window.location.href = 'importar-datos.html'; // Redirige a la página de importación
    });
});
