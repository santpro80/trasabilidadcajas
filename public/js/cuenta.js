import { auth, db, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, doc, getDoc, functions, httpsCallable } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Manejar la redirección de OneDrive
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('onedrive_auth') === 'success') {
        alert('¡Conexión con OneDrive exitosa!');
        // Limpiar el parámetro de la URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const userDisplayNameElement = document.getElementById('user-display-name');
    const userNameElement = document.getElementById('user-name');
    const userRoleElement = document.getElementById('user-role');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmNewPasswordInput = document.getElementById('confirm-new-password');
    const changePasswordBtn = document.getElementById('change-password-btn');
    const messageArea = document.getElementById('message-area');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // La lógica de OneDrive se mueve aquí para asegurar que el usuario está autenticado
        const connectOneDriveButton = document.getElementById('connectOneDriveButton');
        if (connectOneDriveButton) {
            connectOneDriveButton.addEventListener('click', async () => {
                console.log("Botón de OneDrive clickeado. Usuario autenticado:", user.email);
                try {
                    // Forzar la actualización del token para asegurar que esté fresco
                    await user.getIdToken(true);

                    const initiateOAuth = httpsCallable(functions, 'initiateOneDriveOAuth');
                    console.log("Llamando a la función de Firebase 'initiateOneDriveOAuth'...");
                    const result = await initiateOAuth({ 
                        redirectUri: 'https://handleonedriveredirect-dutd52zycq-uc.a.run.app',
                        origin: window.location.origin + window.location.pathname
                    });
                    console.log("Función de Firebase ejecutada con éxito. Resultado:", result);
                    const authUrl = result.data.authUrl;
                    window.location.href = authUrl;
                } catch (error) {
                    console.error('Error al iniciar la autenticación de OneDrive:', error);
                    console.error('Detalles del error:', error.code, error.message, error.details);
                    alert('Hubo un error al intentar conectar con OneDrive. Por favor, inténtalo de nuevo. Detalles: ' + (error.message || error.code || JSON.stringify(error)));
                }
            });
        }

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userNameElement) userNameElement.textContent = userData.name || 'N/A';
                if (userRoleElement) userRoleElement.textContent = userData.role || 'N/A';
                if (userDisplayNameElement) userDisplayNameElement.textContent = userData.name || user.email;

                // Check for OneDrive connection status
                const oneDriveStatusElement = document.getElementById('oneDriveStatus');
                const connectOneDriveButton = document.getElementById('connectOneDriveButton');

                if (connectOneDriveButton) {
                    connectOneDriveButton.style.display = 'block'; // Siempre mostrar el botón
                }

                if (userData.oneDriveRefreshToken) {
                    if (oneDriveStatusElement) oneDriveStatusElement.textContent = 'Conectado. Haz clic en el botón para refrescar la conexión o cambiar de cuenta.';
                } else {
                    if (oneDriveStatusElement) oneDriveStatusElement.textContent = 'No conectado a OneDrive';
                }
            } else {
                if (userDisplayNameElement) userDisplayNameElement.textContent = user.email;
                // Also handle UI for user doc not existing
                const oneDriveStatusElement = document.getElementById('oneDriveStatus');
                const connectOneDriveButton = document.getElementById('connectOneDriveButton');
                if (connectOneDriveButton) connectOneDriveButton.style.display = 'block';
                if (oneDriveStatusElement) oneDriveStatusElement.textContent = 'No conectado a OneDrive';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            if (userDisplayNameElement) userDisplayNameElement.textContent = user.email;
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
        });
    }
});