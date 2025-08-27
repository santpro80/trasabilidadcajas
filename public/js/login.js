import { auth, db, signInWithEmailAndPassword, collection, query, where, getDocs } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById("loginForm");
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const messageArea = document.getElementById("message-area");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim(); // Obtenemos el valor tal cual lo escribe el usuario por ahora
            const password = passwordInput.value;

            if (messageArea) messageArea.style.display = 'none';

            console.log(`--- INICIO DE DEPURACIÓN ---`);
            console.log(`Buscando usuario con username: "${username}"`);
            
            try {
                // Forzamos la búsqueda en mayúsculas, como en el registro
                const usernameInUpperCase = username.toUpperCase();
                console.log(`Buscando en Firestore con el valor en mayúsculas: "${usernameInUpperCase}"`);

                const usersRef = collection(db, "users");
                const q = query(usersRef, where("username", "==", usernameInUpperCase));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    console.log("Firestore no encontró ningún documento con ese username.");
                    throw new Error("Usuario o contraseña incorrectos.");
                }

                let userEmail = '';
                querySnapshot.forEach((doc) => {
                    console.log("Documento encontrado:", doc.id, "=>", doc.data());
                    userEmail = doc.data().email;
                });

                console.log(`Email encontrado: "${userEmail}". Intentando iniciar sesión...`);
                await signInWithEmailAndPassword(auth, userEmail, password);
                
                console.log("¡Inicio de sesión exitoso!");
                window.location.href = 'menu.html';

            } catch (error) {
                console.error("Error detallado:", error);
                let userFriendlyMessage = "Usuario o contraseña incorrectos.";
                if (error.code === 'auth/too-many-requests') {
                    userFriendlyMessage = "Demasiados intentos. Inténtalo de nuevo más tarde.";
                }
                if (messageArea) {
                    messageArea.textContent = userFriendlyMessage;
                    messageArea.style.display = 'block';
                }
            } finally {
                console.log(`--- FIN DE DEPURACIÓN ---`);
            }
        });
    }
});