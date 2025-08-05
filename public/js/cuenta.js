// public/js/cuenta.js

import { app, auth, db } from './firebase-config.js'; 
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Declarar las variables de los elementos DOM aquí, pero sin asignarles valor aún.
// Se asignarán dentro de DOMContentLoaded.
let userDisplayNameElement;
let userNameElement;
let userEmailDisplayElement; // Elemento para mostrar el email en los detalles
let userRoleElement;
let logoutBtn;
let backBtn;
let changePasswordForm;
let currentPasswordInput;
let newPasswordInput;
let confirmNewPasswordInput;
let changePasswordBtn;
let btnText;
let spinner;
let messageArea;

// Function to show messages to the user
const showMessage = (message, type) => {
    if (messageArea) { // Asegurarse de que messageArea no sea null
        messageArea.textContent = message;
        messageArea.className = `message-area ${type}`;
        messageArea.style.display = 'block';
    } else {
        console.error("Error: messageArea element not found to display message:", message);
    }
};

// Function to hide messages
const hideMessage = () => {
    if (messageArea) { // Asegurarse de que messageArea no sea null
        messageArea.textContent = '';
        messageArea.className = 'message-area';
        messageArea.style.display = 'none';
    }
};

// Function to toggle loading state
const toggleLoading = (isLoading) => {
    // Asegurarse de que los elementos existan antes de manipularlos
    if (btnText) btnText.hidden = isLoading;
    if (spinner) spinner.hidden = !isLoading;
    if (changePasswordBtn) changePasswordBtn.disabled = isLoading;
    // También deshabilitar los inputs durante la carga
    if (currentPasswordInput) currentPasswordInput.disabled = isLoading;
    if (newPasswordInput) newPasswordInput.disabled = isLoading;
    if (confirmNewPasswordInput) confirmNewPasswordInput.disabled = isLoading;
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired for cuenta.js.");

    // *** MOVER LA OBTENCIÓN DE ELEMENTOS DOM AQUÍ ***
    userDisplayNameElement = document.getElementById('user-display-name');
    userNameElement = document.getElementById('user-name');
    userEmailDisplayElement = document.getElementById('user-email-display'); // Obtener referencia al nuevo elemento
    userRoleElement = document.getElementById('user-role');
    logoutBtn = document.getElementById('logout-btn');
    backBtn = document.getElementById('back-btn');
    changePasswordForm = document.getElementById('changePasswordForm');
    currentPasswordInput = document.getElementById('current-password');
    newPasswordInput = document.getElementById('new-password');
    confirmNewPasswordInput = document.getElementById('confirm-new-password');
    changePasswordBtn = document.getElementById('change-password-btn');
    btnText = document.getElementById('btn-text');
    spinner = document.getElementById('spinner');
    messageArea = document.getElementById('message-area');
    // *** FIN DE MOVER LA OBTENCIÓN DE ELEMENTOS DOM ***

    // Authentication state listener
    onAuthStateChanged(auth, async (user) => {
        console.log("onAuthStateChanged triggered for cuenta.js. User:", user ? user.email : 'null');
        if (!user) {
            // No user is logged in, redirect to login page
            window.location.href = 'login.html';
            return;
        }

        // Get user data from Firestore
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userNameElement) {
                    userNameElement.textContent = userData.name || 'N/A';
                }
                // Rellenar el nuevo campo de email
                if (userEmailDisplayElement) {
                    userEmailDisplayElement.textContent = user.email || 'N/A';
                    console.log("Email set to:", user.email); // Debugging log
                }
                if (userRoleElement) {
                    userRoleElement.textContent = userData.role || 'N/A';
                }
                // Display name in header (prioriza el nombre de Firestore, si no, el email)
                if (userDisplayNameElement) {
                    userDisplayNameElement.textContent = userData.name || user.email;
                }
            } else {
                console.warn("No user data found in Firestore for UID:", user.uid);
                if (userNameElement) userNameElement.textContent = 'N/A';
                if (userEmailDisplayElement) {
                    userEmailDisplayElement.textContent = user.email || 'N/A'; // Fallback para email
                    console.log("Email set to (fallback):", user.email); // Debugging log
                }
                if (userRoleElement) userRoleElement.textContent = 'N/A';
                if (userDisplayNameElement) userDisplayNameElement.textContent = user.email; // Fallback para header
            }
        } catch (error) {
            console.error("Error fetching user data from Firestore:", error);
            if (userNameElement) userNameElement.textContent = 'Error';
            if (userEmailDisplayElement) {
                userEmailDisplayElement.textContent = user.email || 'Error'; // Fallback para email
                console.log("Email set to (error fallback):", user.email); // Debugging log
            }
            if (userRoleElement) userRoleElement.textContent = 'Error';
            if (userDisplayNameElement) userDisplayNameElement.textContent = user.email; // Fallback para header
        }
    });

    // Logout button event listener
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log("Logout button clicked from cuenta.js");
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
                showMessage('Error al cerrar sesión. Por favor, inténtalo de nuevo.', 'error');
            }
        });
    }

    // Back button event listener
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("Back button clicked from cuenta.js. Redirecting to menu.html");
            window.location.href = 'menu.html';
        });
    }

    // Change password form submission
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMessage();
            toggleLoading(true);

            const user = auth.currentUser;
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (!user) {
                showMessage('No hay usuario autenticado.', 'error');
                toggleLoading(false);
                return;
            }

            if (newPassword !== confirmNewPassword) {
                showMessage('Las nuevas contraseñas no coinciden.', 'error');
                toggleLoading(false);
                return;
            }

            if (newPassword.length < 6) {
                showMessage('La nueva contraseña debe tener al menos 6 caracteres.', 'error');
                toggleLoading(false);
                return;
            }

            try {
                // Reauthenticate user before changing password
                const credential = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                
                // Update password
                await updatePassword(user, newPassword);
                showMessage('Contraseña actualizada con éxito.', 'success');
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmNewPasswordInput.value = '';

            } catch (error) {
                console.error('Error al cambiar contraseña:', error);
                let errorMessage = 'Error al cambiar la contraseña.';
                if (error.code === 'auth/wrong-password') {
                    errorMessage = 'Contraseña actual incorrecta.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'La nueva contraseña es demasiado débil.';
                } else if (error.code === 'auth/requires-recent-login') {
                    errorMessage = 'Por favor, inicia sesión de nuevo para cambiar tu contraseña.';
                }
                showMessage(errorMessage, 'error');
            } finally {
                toggleLoading(false);
            }
        });
    } else {
        console.error('Error: No se encontró el formulario con el ID "changePasswordForm".');
    }
});
