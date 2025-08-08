// public/js/firebase-config.js

// 1. IMPORTAMOS TODO DESDE FIREBASE AQUÍ, Y SOLO AQUÍ
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    collection,
    query,
    orderBy,
    getDocs
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// 2. CONFIGURACIÓN DE TU PROYECTO
const firebaseConfig = {
    apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
    authDomain: "cajas-secuela.firebaseapp.com",
    projectId: "cajas-secuela",
    storageBucket: "cajas-secuela.firebasestorage.app",
    messagingSenderId: "551056516132",
    appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
    measurementId: "G-SZDRGMZS4X"
};

// 3. INICIALIZAMOS Y EXPORTAMOS LAS INSTANCIAS
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    // INSTANCIAS
    app, 
    auth, 
    db,
    // FUNCIONES DE AUTH
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    // FUNCIONES DE FIRESTORE
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    orderBy,
    getDocs
};