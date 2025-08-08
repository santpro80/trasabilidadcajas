import { auth, signInWithEmailAndPassword } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const messageArea = document.getElementById("message-area");

    const showMessage = (msg, type = 'error') => {
        if (messageArea) {
            messageArea.textContent = msg;
            messageArea.className = `message-area ${type}`;
            messageArea.style.display = 'block';
        }
    };

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (messageArea) messageArea.style.display = 'none';

            try {
                await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
                window.location.href = 'menu.html';
            } catch (error) {
                let userFriendlyMessage = "Correo electrónico o contraseña incorrectos.";
                if (error.code === 'auth/too-many-requests') {
                    userFriendlyMessage = "Demasiados intentos. Inténtalo de nuevo más tarde.";
                }
                showMessage(userFriendlyMessage);
            }
        });
    }
});