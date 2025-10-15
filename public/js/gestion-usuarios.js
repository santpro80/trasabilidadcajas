import { auth, db, onAuthStateChanged, signOut, getDoc, doc, functions, httpsCallable } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const assignRoleBtn = document.getElementById('assign-role-btn');
    const messageDiv = document.getElementById('message');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
    const userEmailInput = document.getElementById('user-email');
    const userRoleSelect = document.getElementById('user-role');

    let notificationTimeout;

    const showMessage = (message, type = 'error') => {
        messageDiv.textContent = message;
        messageDiv.className = type === 'success' ? 'message-success' : 'message-error';
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 5000);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                console.log("Datos del usuario desde Firestore:", userData); // <-- DEBUG LOG
                userDisplayName.textContent = userData.name || user.email;
                console.log ("hasta aca tamo chelo") ; // <-- DEBUG LOG
                // Habilitar el botón solo si el usuario es supervisor
                if (userData.role === "supervisor") {
                    assignRoleBtn.disabled = false;

                    assignRoleBtn.addEventListener('click', async () => {
                        console.log("el botón ha sido presionado"); 
                        const email = userEmailInput.value;
                        const role = userRoleSelect.value;

                        if (!email) {
                            showMessage('Por favor, introduce un correo electrónico.', 'error');
                            return;
                        }

                        showMessage('Asignando rol...', 'info');

                        try {
                            //INICIO CÓDIGO DE DEPURACIÓN DE TOKEN
                            console.log("Forzando actualización del token para depuración...");
                            await auth.currentUser.getIdToken(true);
                            const idToken = await auth.currentUser.getIdToken();
                            try {
                                const payload = JSON.parse(atob(idToken.split('.')[1]));
                                console.log("CONTENIDO COMPLETO DEL TOKEN (CLAIMS):", payload);
                            } catch (e) {
                                console.error("No se pudo decodificar el token:", e);
                            }
                            //FIN CÓDIGO DE DEPURACIÓN DE TOKEN

                            const setCustomUserRole = httpsCallable(functions, 'setCustomUserRole');
                            const result = await setCustomUserRole({ email: email, role: role });
                            
                            showMessage(result.data.message, 'success');
                            userEmailInput.value = ''; 

                        } catch (error) {
                            console.error('Error al asignar rol:', error);
                            if (error.code === 'functions/permission-denied') {
                                showMessage('Error: No tienes permiso para realizar esta acción.', 'error');
                            } else if (error.code === 'functions/internal') {
                                showMessage('Error interno del servidor. Revisa los logs de la función.', 'error');
                            } else {
                                showMessage(`Error: ${error.message}`, 'error');
                            }
                        }
                    });
                } console.log ("llego hasta aca"); 
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            userDisplayName.textContent = user.email; 
        }
    });

    backBtn.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});
