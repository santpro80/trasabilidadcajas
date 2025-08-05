    // public/js/firebase-config.js

    // Importa las funciones necesarias para inicializar Firebase
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
    import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
    import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

    // ** TU CONFIGURACIÓN DE FIREBASE **
    // ¡¡¡ASEGÚRATE DE QUE ESTOS VALORES SEAN LOS REALES DE TU PROYECTO FIREBASE!!!
    const firebaseConfig = {
        apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
        authDomain: "cajas-secuela.firebaseapp.com",
        projectId: "cajas-secuela",
        storageBucket: "cajas-secuela.firebasestorage.app",
        messagingSenderId: "551056516132",
        appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
        measurementId: "G-SZDRGMZS4X"
    };

    // Inicializa Firebase
    const app = initializeApp(firebaseConfig);

    // Obtiene las instancias de los servicios de Firebase
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Exporta las instancias para que puedan ser usadas en otros archivos
    export { app, auth, db };
    