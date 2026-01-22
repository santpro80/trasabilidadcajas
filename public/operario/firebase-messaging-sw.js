// Importamos los scripts de Firebase usando la sintaxis compatible (no 'import')
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js");

// La configuración de tu app de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
    authDomain: "cajas-secuela.firebaseapp.com",
    projectId: "cajas-secuela",
    storageBucket: "cajas-secuela.firebasestorage.app",
    messagingSenderId: "551056516132",
    appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
    measurementId: "G-SZDRGMZS4X"
};

// Inicializamos la app de Firebase en el service worker
firebase.initializeApp(firebaseConfig);

// Obtenemos una instancia del servicio de Mensajería
const messaging = firebase.messaging();

// Añadimos un manejador para los mensajes que lleguen en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Personalizamos la notificación que se mostrará
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '../assets/logo.png',
    badge: '../assets/logo.png', // Icono pequeño para la barra de estado
    vibrate: [200, 100, 200],  // Patrón de vibración: vibra, pausa, vibra
    tag: 'renotify',           // Etiqueta para agrupar
    renotify: true,            // Vuelve a sonar si llega otra
    data: {
      url: payload.data?.url || '/' // Guardamos la URL para usarla al hacer clic
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejamos el clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Click en notificación recibido.');
  
  event.notification.close(); // Cerramos la notificación visualmente

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});