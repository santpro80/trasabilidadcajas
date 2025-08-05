// js/login.js
// Importa las funciones necesarias de Firebase SDK
// Asegúrate de que tu auth.js también inicialice Firebase y exporte loginUser correctamente.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'; // Necesario para obtener el rol del usuario

// ** CONFIGURACIÓN DE FIREBASE **
// Asegúrate de reemplazar estos valores con la configuración de tu proyecto Firebase.
// Puedes encontrar esto en tu consola de Firebase > Configuración del proyecto > Tus apps.
// Si ya tienes un archivo de inicialización de Firebase (ej. firebase-config.js),
// es mejor importarlo una sola vez en auth.js y usar esas instancias.
// Por ahora, lo definimos aquí si no lo tienes centralizado.
const firebaseConfig = {
  apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
  authDomain: "cajas-secuela.firebaseapp.com",
  projectId: "cajas-secuela",
  storageBucket: "cajas-secuela.firebasestorage.app",
  messagingSenderId: "551056516132",
  appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
  measurementId: "G-SZDRGMZS4X"
};

// Inicializa Firebase (solo si no se inicializa ya en auth.js y se exportan las instancias)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Función para iniciar sesión (si no la tienes en auth.js o quieres redefinirla aquí)
// Si ya la tienes en auth.js, asegúrate de que maneje los errores de Firebase
// y simplemente la importas y usas.
async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Opcional: Obtener el rol del usuario desde Firestore si lo guardaste durante el registro
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            console.log("Usuario logueado:", user.email, "Rol:", userData.role);
            // Aquí podrías guardar el rol en localStorage/sessionStorage o un Context si usaras React
        } else {
            console.log("No se encontró el rol del usuario en Firestore.");
        }

        // Redirige a la página principal después del login exitoso
        window.location.href = 'menu.html'; // O la página que sea tu destino principal
        
    } catch (error) {
        // Relanza el error para que el event listener en DOMContentLoaded lo capture
        throw error;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const messageArea = document.getElementById("message-area"); // Asumiendo que tienes un área para mensajes

    // Función para mostrar mensajes
    const showMessage = (msg, type = 'info') => {
        if (messageArea) {
            messageArea.textContent = msg;
            messageArea.className = `message-area ${type}`;
            messageArea.style.display = 'block';
        }
    };

    // Función para limpiar mensajes
    const clearMessage = () => {
        if (messageArea) {
            messageArea.textContent = '';
            messageArea.className = 'message-area';
            messageArea.style.display = 'none';
        }
    };

    if (loginForm && emailInput && passwordInput) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearMessage(); // Limpiar mensajes anteriores

            try {
                // Llama a la función de login (ya sea la importada o la definida aquí)
                await loginUser(emailInput.value, passwordInput.value);
                
            } catch (error) {
                console.error("Error en login:", error.code, error.message);
                let userFriendlyMessage = "Error al iniciar sesión. Por favor, inténtalo de nuevo.";

                // Personaliza los mensajes de error de Firebase
                switch (error.code) {
                    case 'auth/invalid-email':
                        userFriendlyMessage = "El formato del correo electrónico es inválido.";
                        break;
                    case 'auth/user-disabled':
                        userFriendlyMessage = "Tu cuenta ha sido deshabilitada. Contacta al administrador.";
                        break;
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential': // Este es el que viste en la imagen
                        userFriendlyMessage = "Correo electrónico o contraseña incorrectos.";
                        break;
                    case 'auth/too-many-requests':
                        userFriendlyMessage = "Demasiados intentos fallidos. Inténtalo de nuevo más tarde.";
                        break;
                    default:
                        userFriendlyMessage = `Error desconocido: ${error.message}`;
                        break;
                }
                
                showMessage(userFriendlyMessage, 'error');
                passwordInput.value = ""; // Limpia el campo de contraseña
                emailInput.focus(); // Devuelve el foco al email
            }
        });
    } else {
        console.error("Error: Elementos del formulario de login no encontrados.");
    }
});
