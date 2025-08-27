import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');

    onAuthStateChanged(auth, async (user) => {
        if (user && userDisplayElement) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                userDisplayElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                userDisplayElement.textContent = user.email;
            }
        } else if (!user) {
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'login.html';
            });
        });
    }
});