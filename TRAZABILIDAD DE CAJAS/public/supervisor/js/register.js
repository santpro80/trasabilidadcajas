import { auth, db, createUserWithEmailAndPassword, setDoc, doc, collection, query, where, getDocs, reauthenticateWithCredential, EmailAuthProvider, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const nameInput = document.getElementById('name');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    
    // Trazabilidad fields
    const chkTrazabilidad = document.getElementById('chk-trazabilidad');
    const trazabilidadConfig = document.getElementById('trazabilidad-config');
    const sectorTrazabilidad = document.getElementById('sector-trazabilidad');
    const roleTrazabilidad = document.getElementById('role-trazabilidad');
    const supervisorPasswordGroup = document.getElementById('supervisor-password-group');
    const supervisorPasswordInput = document.getElementById('supervisor-password');

    // Pedidos fields
    const chkPedidos = document.getElementById('chk-pedidos');
    const pedidosConfig = document.getElementById('pedidos-config');
    const sectorPedidosSelect = document.getElementById('sector-pedidos-select');
    const rolePedidosSelect = document.getElementById('role-pedidos-select');

    // Deposito fields
    const chkDeposito = document.getElementById('chk-deposito');
    const depositoConfig = document.getElementById('deposito-config');
    const roleDeposito = document.getElementById('role-deposito');

    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('submit-btn');

    const showMessage = (msg, type = 'error') => {
        if (messageArea) {
            messageArea.textContent = msg;
            messageArea.className = `message-area ${type}`;
            messageArea.style.display = 'block';
        }
    };

    // Toggle visibility based on checkboxes
    const toggleConfig = () => {
        if (chkTrazabilidad.checked) {
            trazabilidadConfig.style.display = 'block';
            document.getElementById('item-trazabilidad').classList.add('selected');
        } else {
            trazabilidadConfig.style.display = 'none';
            document.getElementById('item-trazabilidad').classList.remove('selected');
        }

        if (chkPedidos.checked) {
            pedidosConfig.style.display = 'block';
            document.getElementById('item-pedidos').classList.add('selected');
        } else {
            pedidosConfig.style.display = 'none';
            document.getElementById('item-pedidos').classList.remove('selected');
        }

        if (chkDeposito.checked) {
            depositoConfig.style.display = 'block';
            document.getElementById('item-deposito').classList.add('selected');
        } else {
            depositoConfig.style.display = 'none';
            document.getElementById('item-deposito').classList.remove('selected');
        }
    };

    chkTrazabilidad.addEventListener('change', toggleConfig);
    chkPedidos.addEventListener('change', toggleConfig);
    chkDeposito.addEventListener('change', toggleConfig);

    roleTrazabilidad.addEventListener('change', () => {
        supervisorPasswordGroup.style.display = roleTrazabilidad.value === 'supervisor' ? 'block' : 'none';
    });

    // Load sectors for Trazabilidad
    const loadSectorsTrazabilidad = async () => {
        try {
            const docRef = doc(db, "config", "sectors_list");
            const docSnap = await getDoc(docRef);
            let sectors = [];

            if (docSnap.exists()) {
                sectors = docSnap.data().list || [];
            } else {
                sectors = ['002', '004', '005', '007', '008'];
                await setDoc(docRef, { list: sectors });
            }

            sectorTrazabilidad.innerHTML = '<option value="" disabled selected>Sector Trazabilidad...</option>';
            sectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector;
                option.textContent = sector;
                sectorTrazabilidad.appendChild(option);
            });
        } catch (error) {
            console.error("Error cargando sectores trazabilidad:", error);
            showMessage("Error al cargar sectores de Trazabilidad.");
        }
    };

    loadSectorsTrazabilidad();

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedApps = [];
        if (chkTrazabilidad.checked) selectedApps.push('trazabilidad');
        if (chkPedidos.checked) selectedApps.push('pedidos');
        if (chkDeposito.checked) selectedApps.push('deposito');

        if (selectedApps.length === 0) {
            showMessage('Error: Debes seleccionar al menos una aplicación.');
            return;
        }

        const name = nameInput.value;
        const username = usernameInput.value.toUpperCase().replace(/\s+/g, '');
        const email = emailInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validaciones básicas
        if (password !== confirmPassword) {
            showMessage('Error: Las contraseñas no coinciden.');
            return;
        }

        if (!/^[A-Z0-9]+$/.test(username)) {
            showMessage('Error: El nombre de usuario solo puede contener letras y números.');
            return;
        }

        // Validaciones Trazabilidad
        let trazabilidadData = {};
        if (chkTrazabilidad.checked) {
            if (!sectorTrazabilidad.value || !roleTrazabilidad.value) {
                showMessage('Error: Completa el sector y rol de Trazabilidad.');
                return;
            }
            trazabilidadData = {
                sector: sectorTrazabilidad.value,
                role: roleTrazabilidad.value
            };
        }

        // Validaciones Pedidos
        let pedidosData = {};
        if (chkPedidos.checked) {
            if (!sectorPedidosSelect.value || !rolePedidosSelect.value) {
                showMessage('Error: Completa el sector y rol de Pedidos.');
                return;
            }
            pedidosData = {
                sector_pedidos: sectorPedidosSelect.value,
                role_pedidos: rolePedidosSelect.value
            };
        }

        // Validaciones Deposito
        let depositoData = {};
        if (chkDeposito.checked) {
            if (!roleDeposito.value) {
                showMessage('Error: Completa el rol de Depósito.');
                return;
            }
            depositoData = {
                role_deposito: roleDeposito.value
            };
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            showMessage('Error: No se detectó supervisor autenticado.');
            return;
        }

        submitBtn.disabled = true;
        showMessage('Procesando registro...', 'success');

        try {
            // Si el nuevo usuario es supervisor de trazabilidad, se requiere confirmar contraseña del actual supervisor
            if (chkTrazabilidad.checked && roleTrazabilidad.value === 'supervisor') {
                const supervisorPass = supervisorPasswordInput.value;
                if (!supervisorPass) {
                    throw new Error('Debes introducir tu contraseña de supervisor para confirmar el nuevo cargo.');
                }
                const credential = EmailAuthProvider.credential(currentUser.email, supervisorPass);
                await reauthenticateWithCredential(currentUser, credential);
            }

            // Verificar nombre de usuario único
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", username));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                throw new Error("El nombre de usuario ya está en uso.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            const userData = {
                name: name,
                username: username,
                email: email,
                apps: selectedApps,
                ...trazabilidadData,
                ...pedidosData,
                ...depositoData
            };

            await setDoc(doc(db, "users", userCredential.user.uid), userData);

            showMessage('¡Usuario registrado con éxito! Redirigiendo...', 'success');
            setTimeout(() => { window.location.href = 'menu.html'; }, 2000);

        } catch (error) {
            console.error(error);
            let userFriendlyMessage = error.message;
            if (error.code === "auth/email-already-in-use") {
                userFriendlyMessage = "El correo electrónico ya está en uso.";
            } else if (error.code === 'auth/wrong-password') {
                userFriendlyMessage = "Tu contraseña de supervisor es incorrecta.";
            }
            showMessage(userFriendlyMessage);
            submitBtn.disabled = false;
        }
    });
});