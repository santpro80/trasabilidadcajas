// Import the Firebase app and messaging modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-sw.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
    authDomain: "cajas-secuela.firebaseapp.com",
    projectId: "cajas-secuela",
    storageBucket: "cajas-secuela.firebasestorage.app",
    messagingSenderId: "551056516132",
    appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
    measurementId: "G-SZDRGMZS4X"
};

// Initialize the Firebase app in the service worker
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/assets/logo.png' // Use icon from payload or default
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
