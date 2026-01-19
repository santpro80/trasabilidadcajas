import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db, auth } from './firebase-config.js';

const messaging = getMessaging(app);
const VAPID_KEY = "BG4QdDY4hAMlOvqumgnAEHS-7L7RIzYYrJAyHmYlnnHHQ7QDkW3rq8cIgiE4esI3i7zEpAhUWoLK8KN6aaRkcOk";

async function saveTokenToFirestore(token) {
    const user = auth.currentUser;
    if (user) {
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { fcmToken: token }, { merge: true });
            console.log('✅ Token FCM guardado en Firestore para:', user.uid);
        } catch (error) {
            console.error('❌ Error guardando token en Firestore:', error);
            throw error;
        }
    } else {
        console.warn('⚠️ No hay usuario logueado, no se puede guardar el token.');
        // Si esto pasa, el usuario debería recargar la página para que auth se inicialice bien
    }
}

export async function requestNotificationPermission(swRegistration) {
    console.log('Solicitando permiso de notificaciones...');
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        console.log('Permiso concedido.');
        
        // Obtenemos el token
        const currentToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (currentToken) {
            console.log('Token obtenido:', currentToken);
            await saveTokenToFirestore(currentToken);
            return currentToken;
        } else {
            throw new Error("No se pudo generar el token (getToken devolvió null).");
        }
    } else {
        throw new Error("Permiso de notificaciones denegado.");
    }
}

// Manejo de mensajes en primer plano (para que suene si tienes la app abierta)
onMessage(messaging, (payload) => {
    console.log('Mensaje recibido en primer plano:', payload);
    const title = payload.data?.title || "Notificación";
    const options = {
        body: payload.data?.body || "",
        icon: '/assets/logo.png',
        data: payload.data
    };
    
    const notification = new Notification(title, options);
    notification.onclick = (event) => {
        event.preventDefault();
        const url = payload.data?.url || '/';
        window.open(url, '_self');
    };
});