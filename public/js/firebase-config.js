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
    deleteDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    addDoc,
    serverTimestamp,
    where // <-- AÑADIDO AQUÍ
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

export const registrarHistorial = async (accion, detalles) => {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log("No hay usuario autenticado para registrar el historial.");
            return;
        }

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const userName = userDocSnap.exists() ? userDocSnap.data().name : user.email;

        const historialDoc = {
            timestamp: serverTimestamp(),
            usuarioEmail: user.email,
            usuarioNombre: userName,
            accion: accion,
            detalles: detalles
        };

        await addDoc(collection(db, "historial"), historialDoc);

    } catch (error) {
        console.error("Error al registrar en el historial:", error);
    }
};

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
    deleteDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    where // <-- AÑADIDO AQUÍ
};