// Importa las funciones necesarias de Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// ** CONFIGURACIÓN DE FIREBASE **
// Asegúrate de reemplazar estos valores con la configuración de tu proyecto Firebase.
// Puedes encontrar esto en tu consola de Firebase > Configuración del proyecto > Tus apps.
// Si ya tienes un archivo de inicialización de Firebase, puedes importarlo en lugar de definirlo aquí.
const firebaseConfig = {
  apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
  authDomain: "cajas-secuela.firebaseapp.com",
  projectId: "cajas-secuela",
  storageBucket: "cajas-secuela.firebasestorage.app",
  messagingSenderId: "551056516132",
  appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
  measurementId: "G-SZDRGMZS4X"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Inicializa Firestore para guardar roles y nombres

// Este código se ejecutará una vez que toda la página HTML esté cargada.
document.addEventListener('DOMContentLoaded', () => {
    // Obtenemos una referencia al formulario de registro.
    const registerForm = document.getElementById('registerForm');
    // Obtenemos una referencia a los campos de entrada.
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('password-supervisor-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password');

    // Obtenemos una referencia al botón de envío para manejar su estado.
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    // Área para mostrar mensajes al usuario.
    const messageArea = document.getElementById('message-area');

    // Lógica para mostrar/ocultar el campo de contraseña de supervisor.
    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            if (roleSelect.value === 'supervisor') {
                supervisorPasswordGroup.style.display = 'block';
                supervisorPasswordInput.setAttribute('required', 'true');
            } else {
                supervisorPasswordGroup.style.display = 'none';
                supervisorPasswordInput.removeAttribute('required');
                supervisorPasswordInput.value = ''; // Limpiar el campo si se oculta
            }
        });
    }

    // Agregamos un "escuchador de eventos" al formulario cuando se envía.
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            // Prevenimos el comportamiento por defecto del formulario (recargar la página).
            event.preventDefault();

            // Ocultar mensajes anteriores y deshabilitar el botón/mostrar spinner.
            hideMessage();
            submitBtn.disabled = true;
            btnText.hidden = true;
            spinner.hidden = false;

            // Obtenemos los valores actuales de los campos.
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value; // La contraseña no se trimea para mantener espacios si son intencionales
            const role = roleSelect.value;
            const supervisorPassword = supervisorPasswordInput.value;

            // --- Validaciones básicas (en el cliente) ---
            if (!name) {
                showMessage('Por favor, ingresa tu nombre completo.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }
            if (!email) {
                showMessage('Por favor, ingresa tu correo electrónico.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }
            // Validación de formato de email muy básica (puedes mejorarla con regex)
            if (!email.includes('@') || !email.includes('.')) {
                showMessage('Formato de correo electrónico inválido.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }
            if (password.length < 6) {
                showMessage('La contraseña debe tener al menos 6 caracteres.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }
            if (!role) {
                showMessage('Por favor, selecciona tu rol.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }
            // Validación simulada de contraseña de supervisor (se mantendrá por ahora)
            if (role === 'supervisor' && supervisorPassword !== '48482094') {
                showMessage('Contraseña de supervisor incorrecta.', 'error');
                submitBtn.disabled = false; btnText.hidden = false; spinner.hidden = true;
                return;
            }

            // --- Lógica de REGISTRO REAL con Firebase Authentication ---
            try {
                // 1. Crear el usuario en Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Guardar información adicional del usuario (nombre y rol) en Firestore
                // Usamos el UID (User ID) de Firebase como ID del documento en Firestore
                await setDoc(doc(db, "users", user.uid), {
                    name: name,
                    email: email,
                    role: role,
                    createdAt: new Date() // Opcional: para saber cuándo se creó el usuario
                });

                showMessage('¡Registro exitoso! Redirigiendo al inicio de sesión...', 'success');

                // Redirigimos a login.html después de un breve retraso.
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500); 
                
            } catch (error) {
                // Manejo de errores de Firebase Authentication
                console.error('Error durante el registro en Firebase:', error.code, error.message);
                let errorMessage = 'Error al registrar. Inténtalo de nuevo.';

                // Mensajes de error comunes de Firebase
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'El correo electrónico ya está registrado.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'El formato del correo electrónico es inválido.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
                        break;
                    default:
                        errorMessage = `Error: ${error.message}`;
                        break;
                }
                showMessage(errorMessage, 'error');
            } finally {
                // Aseguramos que el spinner se oculte y el botón se habilite si no hubo redirección.
                if (!messageArea.textContent.includes('Redirigiendo')) {
                    submitBtn.disabled = false;
                    btnText.hidden = false;
                    spinner.hidden = true;
                }
            }
        });
    } else {
        console.error('Error: No se encontró el formulario con el ID "registerForm".');
    }

    // Función para mostrar mensajes al usuario.
    function showMessage(message, type) {
        messageArea.textContent = message;
        messageArea.className = `message-area ${type}`; // Añade la clase 'success' o 'error'
        messageArea.style.display = 'block';
    }

    // Función para ocultar mensajes.
    function hideMessage() {
        messageArea.style.display = 'none';
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }
});
