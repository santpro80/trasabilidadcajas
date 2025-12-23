import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
    authDomain: "cajas-secuela.firebaseapp.com",
    projectId: "cajas-secuela",
    storageBucket: "cajas-secuela.firebasestorage.app",
    messagingSenderId: "551056516132",
    appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
    measurementId: "G-SZDRGMZS4X"
};

export const app = initializeApp(firebaseConfig);

// Function to register the service worker
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Path to the service worker file
            // Using '/trasabilidadcajas/firebase-messaging-sw.js' to match the GitHub Pages subdirectory
            const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', {
                scope: './'
            });
            console.log('Firebase Messaging Service Worker registered with scope:', registration.scope);
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }
    return null;
}