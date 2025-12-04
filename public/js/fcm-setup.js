// public/js/fcm-setup.js
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './app.js'; // Assuming app is exported from app.js

const messaging = getMessaging(app);
const db = getFirestore(app);
const auth = getAuth(app);

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
export async function requestNotificationPermission() {
    console.log('Requesting notification permission...');
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            
            // Get the token
            const currentToken = await getToken(messaging, {
                vapidKey: 'BF7SA1q5HqzeYubSor2J2YHOca5EIKKeXhSuKxIWq5519jAeLZCvhC6l1MlN71bUn8UVArCXpy4SN-UeS1b9xqg' // Replace with your VAPID key
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
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/assets/logo.png', // Use icon from payload or default
    };

    const notification = new Notification(notificationTitle, notificationOptions);

    // Optional: add a click handler to the notification
    notification.onclick = (event) => {
        event.preventDefault(); // prevent the browser from focusing the Notification's tab
        // Implement custom logic, e.g., open a specific URL
        // window.open(payload.data.url, '_blank');
        console.log('Notification clicked.');
    };
});
