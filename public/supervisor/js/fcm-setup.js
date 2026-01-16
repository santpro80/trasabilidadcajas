// public/js/fcm-setup.js
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db, auth } from './firebase-config.js';

const messaging = getMessaging(app);

// Function to save the FCM token to Firestore
async function saveTokenToFirestore(token) {
    const user = auth.currentUser;
    if (user) {
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { fcmToken: token }, { merge: true });
            console.log('FCM token saved to Firestore for user:', user.uid);
        } catch (error) {
            console.error('Error saving FCM token to Firestore:', error);
        }
    } else {
        console.log('No user logged in, cannot save FCM token.');
    }
}

// Function to request permission and get token
export async function requestNotificationPermission(swRegistration) {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            
            // Get the token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BG4QdDY4hAMlOvqumgnAEHS-7L7RIzYYrJAyHmYlnnHHQ7QDkW3rq8cIgiE4esI3i7zEpAhUWoLK8KN6aaRkcOk',
                serviceWorkerRegistration: swRegistration // Pass the registration object
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                await saveTokenToFirestore(currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
        }
    } catch (error) {
        console.error('An error occurred while requesting permission or getting token:', error);
    }
}

// Handle incoming messages when the app is in the foreground
onMessage(messaging, (payload) => {
    console.log('Message received in foreground.', payload);

    // Display a browser notification
    // ADAPTACIÓN: Buscamos en payload.data porque es una Data-Only Notification
    const notificationTitle = payload.data?.title || payload.notification?.title;
    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body,
        icon: '/assets/logo.png', // Icono fijo o payload.data.icon si lo enviaras
        data: payload.data // Pasamos los datos extra (como la URL)
    };

    const notification = new Notification(notificationTitle, notificationOptions);

    // Optional: add a click handler to the notification
    notification.onclick = (event) => {
        event.preventDefault(); // prevent the browser from focusing the Notification's tab
        // Implement custom logic, e.g., open a specific URL
        const url = payload.data?.url || '/';
        window.open(url, '_self');
        console.log('Notification clicked.');
    };
});
