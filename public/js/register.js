import { auth, db, createUserWithEmailAndPassword, setDoc, doc, collection, query, where, getDocs } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password'); // Campo nuevo
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('supervisor-password-group'); // Grupo del campo nuevo
    const supervisorPasswordInput = document.getElementById('supervisor-password'); // Campo nuevo
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('submit-btn');

    const showMessage = (msg, type = 'error') => {
        if(messageArea) {
            messageArea.textContent = msg;
            messageArea.className = `message-area ${type}`;
            messageArea.style.display = 'block';
        }
    };

    // Lógica para mostrar/ocultar el campo de contraseña de supervisor
    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'supervisor') {
            supervisorPasswordGroup.style.display = 'block';
        } else {
            supervisorPasswordGroup.style.display = 'none';
        }
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        if(submitBtn) submitBtn.disabled = true;
        if(messageArea) messageArea.style.display = 'none';

        const name = nameInput.value;
        const username = usernameInput.value.toUpperCase().replace(/\s+/g, '');
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const role = roleSelect.value;
        const supervisorPassword = supervisorPasswordInput.value;

        // ===== VALIDACIÓN: Contraseñas de usuario coinciden =====
        if (password !== confirmPassword) {
            showMessage('Error: Las contraseñas no coinciden.');
            if(submitBtn) submitBtn.disabled = false;
            return;
        }

        // ===== VALIDACIÓN: Formato de username =====
        if (!/^[A-Z0-9]+$/.test(username)) {
            showMessage('Error: El nombre de usuario solo puede contener letras y números, sin espacios.');
            if(submitBtn) submitBtn.disabled = false;
            return;
        }

        // ===== VALIDACIÓN: Contraseña de supervisor =====
        if (role === 'supervisor' && supervisorPassword !== '48482094') {
            showMessage('Error: La contraseña de supervisor es incorrecta.');
            if(submitBtn) submitBtn.disabled = false;
            return;
        }

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                throw new Error("El nombre de usuario ya está en uso. Por favor, elige otro.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            
            await setDoc(doc(db, "users", userCredential.user.uid), {
                name: name,
                username: username,
                email: email,
                role: role
            });

            showMessage('¡Usuario registrado con éxito! Redirigiendo...', 'success');
            setTimeout(() => { window.location.href = 'menu.html'; }, 2000);

        } catch (error) {
            let userFriendlyMessage = error.message;
            if (error.code === "auth/email-already-in-use") {
                userFriendlyMessage = "El correo electrónico ya está en uso.";
            }
            showMessage(userFriendlyMessage);

        } finally {
            if(submitBtn) submitBtn.disabled = false;
        }
    });
});