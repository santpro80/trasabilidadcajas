import { auth, db, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, doc, getDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {

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

        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (userNameElement) userNameElement.textContent = userData.name || 'N/A';
                if (userRoleElement) userRoleElement.textContent = userData.role || 'N/A';
                if (userDisplayNameElement) userDisplayNameElement.textContent = userData.name || user.email;
            } else {
                if (userDisplayNameElement) userDisplayNameElement.textContent = user.email;
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