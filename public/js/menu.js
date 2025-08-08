import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userEmailElement = document.getElementById('user-email');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                userEmailElement.textContent = userDocSnap.data().name || user.email;
            } else {
                userEmailElement.textContent = user.email;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    });

    document.getElementById('btn-cajas')?.addEventListener('click', () => {
        window.location.href = 'modelos-de-cajas.html';
    });
    // ... (resto de listeners para los botones del menú)
});