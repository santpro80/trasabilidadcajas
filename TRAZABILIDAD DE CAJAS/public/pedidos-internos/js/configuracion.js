import { auth, signOut } from './firebase-config-pedidos.js';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { initApp } from './app.js';

initApp().then((user) => {

    const formPassword = document.getElementById('form-password');
    const inputCurrentPass = document.getElementById('input-current-pass');
    const inputNewPass = document.getElementById('input-new-pass');
    const inputConfirmPass = document.getElementById('input-confirm-pass');
    const btnSavePassword = document.getElementById('btn-save-password');
    const passwordFeedback = document.getElementById('password-feedback');

    formPassword.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPass = inputCurrentPass.value;
        const newPass = inputNewPass.value;
        const confirmPass = inputConfirmPass.value;

        // Reset feedback
        passwordFeedback.classList.add('hidden');
        passwordFeedback.classList.remove('text-emerald-500', 'text-rose-500');

        if (newPass !== confirmPass) {
            passwordFeedback.textContent = 'Las contraseñas no coinciden.';
            passwordFeedback.classList.add('text-rose-500');
            passwordFeedback.classList.remove('hidden');
            return;
        }

        if (newPass.length < 6) {
            passwordFeedback.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            passwordFeedback.classList.add('text-rose-500');
            passwordFeedback.classList.remove('hidden');
            return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
            alert("No hay sesión activa.");
            return;
        }

        btnSavePassword.disabled = true;
        btnSavePassword.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> Actualizando...';

        try {
            const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
            await reauthenticateWithCredential(currentUser, credential);

            await updatePassword(currentUser, newPass);

            passwordFeedback.textContent = 'Contraseña actualizada correctamente. Cierra sesión y vuelve a ingresar si es necesario.';
            passwordFeedback.classList.add('text-emerald-500');
            passwordFeedback.classList.remove('hidden');

            inputCurrentPass.value = '';
            inputNewPass.value = '';
            inputConfirmPass.value = '';

        } catch (error) {
            console.error("Error al actualizar la contraseña:", error);

            passwordFeedback.classList.add('text-rose-500');
            passwordFeedback.classList.remove('hidden');

            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                passwordFeedback.textContent = 'La contraseña actual no es correcta.';
            } else if (error.code === 'auth/requires-recent-login') {
                passwordFeedback.textContent = 'Sesión expirada. Por favor cierra sesión y vuelve a ingresar.';
            } else {
                passwordFeedback.textContent = 'Ocurrió un error al actualizar la contraseña.';
            }
        } finally {
            btnSavePassword.disabled = false;
            btnSavePassword.innerHTML = 'Actualizar';
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = '../login.html';
        } catch (error) {
            console.error("Error al cerrar sesión", error);
            alert("Ocurrió un error al intentar cerrar sesión.");
        }
    });

    // Inicialización del panel completada, quitamos el skeleton
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('settings-content').classList.remove('hidden');
});
