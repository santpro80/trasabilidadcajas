// js/register.js
import { registerUser } from './auth.js'; // Importa la función de registro desde auth.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById("registerForm");
    const submitBtn = document.getElementById("submit-btn");
    const btnText = document.getElementById("btn-text");
    const spinner = document.getElementById("spinner");
    const roleSelect = document.getElementById("role");
    const passwordSupervisorGroup = document.getElementById("password-supervisor-group");
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

    // Mostrar campo de contraseña solo para supervisor
    if (roleSelect && passwordSupervisorGroup) {
        roleSelect.addEventListener("change", () => {
            passwordSupervisorGroup.style.display = roleSelect.value === "supervisor" ? "block" : "none";
            if (roleSelect.value !== "supervisor") {
                document.getElementById("supervisor-password").value = "";
            }
        });
    } else {
        console.warn("Elementos 'roleSelect' o 'password-supervisor-group' no encontrados.");
    }
    
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            clearMessage(); // Limpiar mensajes anteriores

            try {
                // Mostrar spinner
                if (submitBtn) submitBtn.disabled = true;
                if (btnText) btnText.hidden = true;
                if (spinner) spinner.hidden = false;
                
                const userData = {
                    name: form.querySelector("#name")?.value.trim(),
                    email: form.querySelector("#email")?.value.trim(),
                    password: form.querySelector("#password")?.value,
                    role: form.querySelector("#role")?.value
                };
                
                // Validación para supervisor
                if (userData.role === "supervisor") {
                    const supervisorPasswordInput = form.querySelector("#supervisor-password");
                    const supervisorPassword = supervisorPasswordInput ? supervisorPasswordInput.value : '';
                    if (supervisorPassword !== "48482094") { // Contraseña de supervisor hardcodeada
                        throw new Error("Contraseña de supervisor incorrecta");
                    }
                }
                
                // Validación general
                if (!userData.role) throw new Error("Selecciona un rol");
                
                await registerUser(userData.email, userData.password, userData.name, userData.role);
                
                // La redirección ya está manejada en auth.js si el registro es exitoso
            } catch (error) {
                console.error("Error en registro:", error.message);
                showMessage("Error en registro: " + error.message, 'error');
                if (form.querySelector("#password")) form.querySelector("#password").value = "";
                if (userData.role === "supervisor" && form.querySelector("#supervisor-password")) {
                    form.querySelector("#supervisor-password").value = "";
                }
            } finally {
                // Restaurar botón
                if (submitBtn) submitBtn.disabled = false;
                if (btnText) btnText.hidden = false;
                if (spinner) spinner.hidden = true;
            }
        });
    } else {
        console.error("Error: Elemento 'registerForm' no encontrado.");
    }
});
