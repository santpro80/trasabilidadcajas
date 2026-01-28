import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const cajaSerialInput = document.getElementById('cajaSerialInput');
    const cajaNumeroInput = document.getElementById('cajaNumeroInput');
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
            e.target.value = e.target.value.toUpperCase().slice(0, 6);
        });
    }

    // Validación input N° (Solo números, max 2)
    if (cajaNumeroInput) {
        cajaNumeroInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
        });
    }

    // Navegación con tecla Enter entre campos (Serial -> Número -> Modelo -> Checkboxes)
    if (cajaSerialInput) {
        cajaSerialInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Evita que se envíe el formulario o haga salto de línea
                if (cajaNumeroInput) {
                    cajaNumeroInput.focus();
                } else if (cajaModeloInput) {
                    cajaModeloInput.focus();
                }
            }
        });
    }

    if (cajaNumeroInput) {
        cajaNumeroInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (cajaModeloInput) cajaModeloInput.focus();
            }
        });
    }

    if (cajaModeloInput) {
        cajaModeloInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Intenta enfocar el primer checkbox de la lista
                if (problemaCheckboxes.length > 0) {
                    problemaCheckboxes[0].focus();
                } else if (otroCheckbox) {
                    otroCheckbox.focus();
                }
            }
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
        const numero = cajaNumeroInput ? cajaNumeroInput.value.trim() : '';
        const modelo = cajaModeloInput.value.trim();
        const selectedProblemas = document.querySelectorAll('input[name="problema"]:checked');
        const otroProblema = otroProblemaTextarea.value.trim();

        const tareas = [];

        // Validaciones de formato
        const serialRegex = /^[A-Z]{2}\d{4}$/; // 2 Letras + 4 Números
        if (!serialRegex.test(serial)) {
            messageDiv.textContent = 'El número de serie debe tener 2 letras y 4 números (Ej: AA1234).';
            messageDiv.style.color = 'red';
            return;
        }

        if (cajaNumeroInput && !/^\d{2}$/.test(numero)) {
            messageDiv.textContent = 'El campo N° debe tener exactamente 2 números.';
            messageDiv.style.color = 'red';
            return;
        }

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
            // 1. Verificar si ya existe un reporte "nuevo" para este serial
            const q = query(
                collection(db, 'problemas_cajas'),
                where('cajaSerial', '==', serial),
                where('estado', '==', 'nuevo')
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // YA EXISTE: Añadimos los problemas al reporte existente
                const existingDoc = querySnapshot.docs[0];
                const existingData = existingDoc.data();
                const existingTareas = existingData.tareas || [];
                const updatedTareas = [...existingTareas, ...tareas];

                await updateDoc(doc(db, 'problemas_cajas', existingDoc.id), {
                    tareas: updatedTareas,
                    cajaNumero: numero
                });
                messageDiv.textContent = 'Problemas añadidos al reporte existente (Estado: Nuevo).';
            } else {
                // NO EXISTE: Creamos uno nuevo
                await addDoc(collection(db, 'problemas_cajas'), {
                    cajaSerial: serial,
                    cajaNumero: numero,
                    cajaModelo: modelo,
                    tareas: tareas, 
                    reportadoPor: currentUser.uid,
                    fechaReporte: serverTimestamp(),
                    estado: 'nuevo'
                });
                messageDiv.textContent = '¡Reporte enviado con éxito!';
            }

            messageDiv.style.color = 'green';
            cajaSerialInput.value = '';
            if (cajaNumeroInput) cajaNumeroInput.value = '';
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
