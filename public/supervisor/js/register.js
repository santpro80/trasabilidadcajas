import { auth, db, createUserWithEmailAndPassword, setDoc, doc, collection, query, where, getDocs, reauthenticateWithCredential, EmailAuthProvider, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const sectorSelect = document.getElementById('sector');
    const roleSelect = document.getElementById('role');
    const supervisorPasswordGroup = document.getElementById('supervisor-password-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password'); 
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

    // Función para cargar los sectores desde Firebase
    const loadSectors = async () => {
        if (!sectorSelect) return;
        
        try {
            // Referencia a la configuración de sectores en la colección 'config'
            const docRef = doc(db, "config", "sectors_list");
            const docSnap = await getDoc(docRef);
            let sectors = [];

            if (docSnap.exists()) {
                sectors = docSnap.data().list || [];
            } else {
                // Si no existe, creamos la lista inicial en Firebase
                sectors = ['002', '004', '005', '007', '008'];
                await setDoc(docRef, { list: sectors });
            }

            sectorSelect.innerHTML = '<option value="" disabled selected>Selecciona un sector</option>';
            sectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector;
                option.textContent = sector;
                sectorSelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error cargando sectores:", error);
            showMessage("Error al cargar la lista de sectores.");
        }
    };

    loadSectors();

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        submitBtn.disabled = true;
        messageArea.style.display = 'none';

        const name = nameInput.value;
        const username = usernameInput.value.toUpperCase().replace(/\s+/g, '');
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const sector = sectorSelect ? sectorSelect.value : '';
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

        if (sectorSelect && !sector) {
            showMessage('Error: Debes seleccionar un sector.');
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
            if (role === 'supervisor') {
                if (!supervisorPassword) {
                    throw new Error('Debes introducir tu contraseña de supervisor para confirmar.');
                }
                const credential = EmailAuthProvider.credential(currentUser.email, supervisorPassword);
                await reauthenticateWithCredential(currentUser, credential);
            }
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
                role: role,
                sector: sector
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