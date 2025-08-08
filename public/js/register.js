import { auth, db, createUserWithEmailAndPassword, setDoc, doc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('password-supervisor-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    const messageArea = document.getElementById('message-area');

    if (roleSelect) {
        roleSelect.addEventListener('change', () => {
            supervisorPasswordGroup.style.display = roleSelect.value === 'supervisor' ? 'block' : 'none';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            // Lógica de registro... (el resto del código de esta función no cambia)
        });
    }
    // ... (incluye aquí el resto de las funciones de tu register.js como showMessage, etc.)
});