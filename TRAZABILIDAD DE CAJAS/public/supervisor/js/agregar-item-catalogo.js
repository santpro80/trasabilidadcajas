import { db, auth, onAuthStateChanged, doc, getDoc, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayName = document.getElementById('user-display-name');
    const backBtn = document.getElementById('back-btn');
    const saveBtn = document.getElementById('save-btn');
    const textarea = document.getElementById('items-textarea');
    const statusMessage = document.getElementById('status-message');

    // Autenticación
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../login.html';
        } else if (userDisplayName) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                userDisplayName.textContent = userDoc.exists() ? (userDoc.data().name || user.email) : user.email;
            } catch (error) {
                userDisplayName.textContent = user.email;
            }
        }
    });

    // Navegación
    if (backBtn) {
        backBtn.addEventListener('click', () => window.location.href = 'redir-import.html');
    }

    // Utilidad para notificaciones
    const showStatus = (msg, type) => {
        if (!statusMessage) return;
        
        statusMessage.textContent = msg;
        statusMessage.style.display = 'block';
        
        // Reset effects
        statusMessage.classList.remove('opacity-0', 'translate-y-4');
        statusMessage.classList.add('opacity-100', 'translate-y-0');

        if (type === 'success') {
            statusMessage.className = 'mt-6 text-[13px] font-black tracking-widest rounded-xl p-4 block transition-all duration-300 border bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400 opacity-100 translate-y-0';
        } else if (type === 'error') {
            statusMessage.className = 'mt-6 text-[13px] font-black tracking-widest rounded-xl p-4 block transition-all duration-300 border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 opacity-100 translate-y-0';
        } else {
            statusMessage.className = 'mt-6 text-[13px] font-black tracking-widest rounded-xl p-4 block transition-all duration-300 border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400 opacity-100 translate-y-0';
        }

        // Esconder después de unos segundos
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusMessage.classList.remove('opacity-100', 'translate-y-0');
                statusMessage.classList.add('opacity-0', 'translate-y-4');
                setTimeout(() => statusMessage.style.display = 'none', 300);
            }, 5000);
        }
    };

    // Procesamiento
    if (saveBtn && textarea) {
        saveBtn.addEventListener('click', async () => {
            const text = textarea.value.trim();
            if (!text) {
                showStatus('Por favor, ingresa al menos un ítem o código válido.', 'error');
                return;
            }

            // Deshabilitar botón durante carga
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-70', 'scale-95', 'pointer-events-none');
            const originalBtnContent = saveBtn.innerHTML;
            saveBtn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> PROCESANDO...`;
            
            showStatus('Guardando en Firestore...', 'info');

            const lines = text.split('\n').filter(line => line.trim() !== '');
            let successRaw = 0;
            let errorsRaw = 0;

            for (const line of lines) {
                // Soportar con punto y coma
                const parts = line.split(';');
                let codigo, descripcion, estado;

                if (parts.length >= 2) {
                    codigo = parts[0].trim();
                    descripcion = parts[1].trim();
                    estado = parts[2] ? parts[2].trim() : 'ACTIVO';
                } else if (parts.length === 1) {
                    // Si el usuario solo puso un código o algo incompleto
                    codigo = parts[0].trim();
                    descripcion = "Ítem Carga Rápida";
                    estado = 'ACTIVO';
                }

                if (!codigo) {
                    errorsRaw++;
                    continue;
                }

                try {
                    await setDoc(doc(db, "catalogo_items", codigo), {
                        codigo: codigo,
                        descripcion: descripcion,
                        estado: estado
                    }, { merge: true }); // Merge true evita sobreescribir campos extra si ya existía
                    successRaw++;
                } catch (error) {
                    console.error('Error guardando:', codigo, error);
                    errorsRaw++;
                }
            }

            // Reportar resultado final
            if (successRaw > 0 && errorsRaw === 0) {
                showStatus(`¡Éxito! Se añadieron o actualizaron ${successRaw} ítem(s) en el catálogo.`, 'success');
                textarea.value = '';
            } else if (successRaw > 0 && errorsRaw > 0) {
                showStatus(`Carga parcial: ${successRaw} correcto(s), pero ${errorsRaw} fallaron por problemas de red o formato.`, 'info');
            } else {
                showStatus(`Error crítico al procesar. Verifica tu conexión y el formato delimitado por ";".`, 'error');
            }

            // Restaurar estado del botón
            saveBtn.disabled = false;
            saveBtn.classList.remove('opacity-70', 'scale-95', 'pointer-events-none');
            saveBtn.innerHTML = originalBtnContent;
        });
    }
});
