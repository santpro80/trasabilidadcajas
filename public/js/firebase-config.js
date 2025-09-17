import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteField,
    deleteDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, serverTimestamp, where
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

export function sanitizeFieldName(name) { return name.replace(/\//g, '_slash_').replace(/\./g, '_dot_').replace(/,/g, '_comma_'); }
export function unSanitizeFieldName(name) { return name.replace(/_comma_/g, ',').replace(/_dot_/g, '.').replace(/_slash_/g, '/'); }

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

export const registrarMovimientoCaja = async (tipo, cajaSerie, modelName, prestamoNum = null) => {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("No hay usuario autenticado para registrar el movimiento.");
        }
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        const userName = userDocSnap.exists() ? userDocSnap.data().name : user.email;
        const fecha = new Date();
        const fechaISO = fecha.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const mesISO = fecha.toISOString().slice(0, 7); // Formato YYYY-MM

        // 1. Registrar el movimiento (lógica existente)
        const movimientoData = {
            cajaSerie: cajaSerie,
            modelName: modelName,
            tipo: tipo,
            fecha: fechaISO,
            mes: mesISO,
            timestamp: serverTimestamp(),
            usuarioNombre: userName,
            usuarioEmail: user.email
        };

        if (tipo === 'Salida' && prestamoNum) {
            movimientoData.prestamoNum = prestamoNum;
        }

        await addDoc(collection(db, "movimientos_cajas"), movimientoData);
        console.log(`Movimiento de caja '${tipo}' para '${cajaSerie}' registrado.`);

        // 2. Actualizar el estado de la caja (nueva lógica)
        const nuevoEstado = tipo === 'Salida' ? 'Prestada' : 'Disponible';
        const estadoDocRef = doc(db, "caja_estados", cajaSerie);
        const estadoData = {
            status: nuevoEstado,
            modelName: modelName,
            last_update: serverTimestamp(),
            last_changed_by: userName
        };
        
        await setDoc(estadoDocRef, estadoData, { merge: true });
        console.log(`Estado de la caja '${cajaSerie}' actualizado a '${nuevoEstado}'.`);

    } catch (error) {
        console.error("Error al registrar movimiento de caja:", error);
        throw error;
    }
};

export { 
    app, auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential,
    EmailAuthProvider, doc, getDoc, setDoc, updateDoc, deleteField, deleteDoc,
    collection, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, addDoc
};