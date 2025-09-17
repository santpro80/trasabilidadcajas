import { auth, db, createUserWithEmailAndPassword, setDoc, doc, collection, query, where, getDocs, reauthenticateWithCredential, EmailAuthProvider } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('supervisor-password-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password'); // Este es el campo para la contraseña del supervisor
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('submit-btn');

    const showMessage = (msg, type = 'error') => {
        if(messageArea) {
            messageArea.textContent = msg;
            messageArea.className = `message-area ${type}`;
            messageArea.style.display = 'block';
        }
    };

    roleSelect.addEventListener('change', () => {
        supervisorPasswordGroup.style.display = roleSelect.value === 'supervisor' ? 'block' : 'none';
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        submitBtn.disabled = true;
        messageArea.style.display = 'none';

        const name = nameInput.value;
        const username = usernameInput.value.toUpperCase().replace(/\s+/g, '');
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const role = roleSelect.value;
        const supervisorPassword = supervisorPasswordInput.value;

        if (password !== confirmPassword) {
            showMessage('Error: Las contraseñas para el nuevo usuario no coinciden.');
            submitBtn.disabled = false;
            return;
        }

        if (!/^[A-Z0-9]+$/.test(username)) {
            showMessage('Error: El nombre de usuario solo puede contener letras y números, sin espacios.');
            submitBtn.disabled = false;
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            showMessage('Error: No hay un supervisor autenticado para realizar esta acción.');
            submitBtn.disabled = false;
            return;
        }

        try {
            // Si el nuevo rol es 'supervisor', requerir re-autenticación
            if (role === 'supervisor') {
                if (!supervisorPassword) {
                    throw new Error('Debes introducir tu contraseña de supervisor para confirmar.');
                }
                const credential = EmailAuthProvider.credential(currentUser.email, supervisorPassword);
                await reauthenticateWithCredential(currentUser, credential);
            }

            // --- Si la re-autenticación es exitosa (o no era necesaria), proceder a crear el usuario ---

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
            } else if (error.code === 'auth/wrong-password') {
                userFriendlyMessage = "La contraseña de supervisor es incorrecta.";
            } else if (error.code === 'auth/too-many-requests') {
                userFriendlyMessage = "Demasiados intentos fallidos. Inténtalo más tarde.";
            }
            showMessage(userFriendlyMessage);

        } finally {
            submitBtn.disabled = false;
        }
    });
});