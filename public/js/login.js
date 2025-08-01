// js/login.js
import { loginUser } from './auth.js'; // Importa la función de login desde auth.js

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
                await loginUser(emailInput.value, passwordInput.value);
                // La redirección a menu.html ya está manejada en auth.js si el login es exitoso
            } catch (error) {
                console.error("Error en login:", error.message);
                showMessage("Error al iniciar sesión: " + error.message, 'error');
                passwordInput.value = ""; // Limpia el campo de contraseña
                emailInput.focus(); // Devuelve el foco al email
            }
        });
    } else {
        console.error("Error: Elementos del formulario de login no encontrados.");
    }
});
