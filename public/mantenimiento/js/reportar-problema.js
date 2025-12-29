import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const cajaSerialInput = document.getElementById('cajaSerialInput');
    const cajaModeloInput = document.getElementById('cajaModeloInput');
    const problemaCheckboxes = document.querySelectorAll('input[name="problema"]');
    const otroCheckbox = document.getElementById('problema_otro');
    const otroProblemaContainer = document.getElementById('otroProblemaContainer');
    const otroProblemaTextarea = document.getElementById('otroProblemaTextarea');
    const enviarReporteBtn = document.getElementById('enviarReporteBtn');
    const messageDiv = document.getElementById('message');
    const backBtn = document.getElementById('back-btn');

    let currentUser = null;

    // Forzar mayúsculas al escribir el serial
    if (cajaSerialInput) {
        cajaSerialInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            const urlParams = new URLSearchParams(window.location.search);
            const serial = urlParams.get('serial');
            const modelo = urlParams.get('modelo');
            if (serial) {
                cajaSerialInput.value = serial;
            }
            if (modelo) {
                cajaModeloInput.value = modelo;
            }
        } else {
            window.location.href = 'login.html';
        }
    });
    backBtn.addEventListener('click', () => {
        window.history.back();
    });
    otroCheckbox.addEventListener('change', () => {
        if (otroCheckbox.checked) {
            otroProblemaContainer.style.display = 'block';
        } else {
            otroProblemaContainer.style.display = 'none';
        }
    });
    enviarReporteBtn.addEventListener('click', async () => {
        const serial = cajaSerialInput.value.trim();
        const modelo = cajaModeloInput.value.trim();
        const selectedProblemas = document.querySelectorAll('input[name="problema"]:checked');
        const otroProblema = otroProblemaTextarea.value.trim();

        const tareas = [];
        if (!serial || !modelo) {
            messageDiv.textContent = 'El número de serie y el modelo son obligatorios.';
            messageDiv.style.color = 'red';
            return;
        }

        selectedProblemas.forEach(checkbox => {
            if (checkbox.value !== 'Otro') {
                tareas.push({ texto: checkbox.value, completada: false });
            }
        });

        if (otroCheckbox.checked) {
            if (!otroProblema) {
                messageDiv.textContent = 'Por favor, describe el problema en el campo "Otro".';
                messageDiv.style.color = 'red';
                return;
            }
            tareas.push({ texto: otroProblema, completada: false });
        }

        if (tareas.length === 0) {
            messageDiv.textContent = 'Por favor, selecciona al menos un tipo de problema.';
            messageDiv.style.color = 'red';
            return;
        }

        if (!currentUser) {
            messageDiv.textContent = 'Error: No se ha podido verificar al usuario.';
            messageDiv.style.color = 'red';
            return;
        }
        try {
            await addDoc(collection(db, 'problemas_cajas'), {
                cajaSerial: serial,
                cajaModelo: modelo,
                tareas: tareas, 
                reportadoPor: currentUser.uid,
                fechaReporte: serverTimestamp(),
                estado: 'nuevo'
            });

            messageDiv.textContent = '¡Reporte enviado con éxito!';
            messageDiv.style.color = 'green';
            cajaSerialInput.value = '';
            cajaModeloInput.value = '';
            problemaCheckboxes.forEach(checkbox => checkbox.checked = false);
            otroProblemaTextarea.value = '';
            otroProblemaContainer.style.display = 'none';

            setTimeout(() => {
                messageDiv.textContent = '';
            }, 3000);

        } catch (error) {
            console.error("Error al enviar el reporte: ", error);
            messageDiv.textContent = 'Error al enviar el reporte. Inténtalo de nuevo.';
            messageDiv.style.color = 'red';
        }
    });
});
