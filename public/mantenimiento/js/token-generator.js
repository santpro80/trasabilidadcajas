import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { app } from './firebase-config.js';

const messaging = getMessaging(app);

const getTokenBtn = document.getElementById('getTokenBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');

getTokenBtn.addEventListener('click', async () => {
    statusDiv.textContent = 'Estado: Iniciando...';
    resultDiv.innerHTML = '';
    resultDiv.className = '';

    if (!('serviceWorker' in navigator)) {
        statusDiv.textContent = 'Error: El navegador no soporta Service Workers.';
        return;
    }

    try {
        // 1. Registrar el Service Worker desde la raíz de la carpeta 'mantenimiento'
        statusDiv.textContent = 'Estado: Registrando Service Worker...';
        const registration = await navigator.serviceWorker.register('../firebase-messaging-sw.js');
        statusDiv.textContent = `Estado: Service Worker registrado con éxito.`;
        console.log('Service Worker Registration:', registration);

        // 2. Pedir permiso de notificación
        statusDiv.textContent = 'Estado: Pidiendo permiso para notificaciones...';
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
            statusDiv.textContent = 'Estado: Permiso denegado.';
            resultDiv.textContent = 'El usuario no concedió permiso para recibir notificaciones.';
            resultDiv.className = 'error';
            return;
        }

        statusDiv.textContent = 'Estado: Permiso concedido. Obteniendo token...';

        // 3. Obtener el token
        const currentToken = await getToken(messaging, {
            vapidKey: 'BEh2_5vq3Q866vh4TsrE9kTQaUdYlN1CIT_YL8Vz-A01KJ1MV6iTa7T6ZAeUKZcs8K3rBS6Vmoy8dV08ZCeZ1j4',
            serviceWorkerRegistration: registration
        });

        statusDiv.textContent = '¡Proceso finalizado!';
        resultDiv.textContent = currentToken || 'No se pudo obtener el token. Revisa la consola para más detalles.';
        resultDiv.className = currentToken ? 'success' : 'error';
        console.log('FCM Token:', currentToken);

    } catch (err) {
        statusDiv.textContent = '¡Ocurrió un error grave!';
        resultDiv.innerHTML = `<strong>Error:</strong> ${err.name}<br><strong>Mensaje:</strong> ${err.message}<br><br>Revisa la consola (F12) para más detalles.`;
        resultDiv.className = 'error';
        console.error('Error detallado al obtener el token:', err);
    }
});