// public/js/firebase-config.js

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
    updateDoc,
    arrayUnion,
    deleteField,
    deleteDoc, // <-- HERRAMIENTA AÑADIDA AQUÍ
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Configuración de tu proyecto
const firebaseConfig = {
    apiKey: "AIzaSyBtj9fa0St2IMZgo4jfNPsz_3EMVtioyGU",
    authDomain: "cajas-secuela.firebaseapp.com",
    projectId: "cajas-secuela",
    storageBucket: "cajas-secuela.firebasestorage.app",
    messagingSenderId: "551056516132",
    appId: "1:551056516132:web:88b9da72dd8dd1a8e7a4b1",
    measurementId: "G-SZDRGMZS4X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    app, 
    auth, 
    db,
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion,
    deleteField,
    deleteDoc, // <-- Y LA EXPORTAMOS AQUÍ
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs
};