import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js';
import { 
    getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, deleteField,
    deleteDoc, collection, query, orderBy, onSnapshot, getDocs, addDoc, serverTimestamp, where, increment, arrayUnion, limit
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js';
import { getMessaging, getToken } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js';

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

// Enable App Check debug mode
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = 'd29325f5-b651-4ccf-accc-620340596658';
}

// Initialize App Check
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LdcUP0rAAAAALVX9EZGz1Hw3u-ICSL3AmA_43W4'),

  // Optional: set to true if you want to allow clients without App Check
  // to access your backend resources. Default is false.
  isTokenAutoRefreshEnabled: true
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

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
        const fechaISO = fecha.toISOString().split('T')[0];
        const mesISO = fecha.toISOString().slice(0, 7); 

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

            // NUEVO: Crear un documento en la colección 'prestamos' para búsqueda rápida.
            const prestamoDocRef = doc(db, "prestamos", prestamoNum);
            await setDoc(prestamoDocRef, {
                cajaSerie: cajaSerie,
                modelName: modelName,
                usuarioNombre: userName,
                usuarioEmail: user.email,
                timestamp: serverTimestamp()
            });
        }

        await addDoc(collection(db, "movimientos_cajas"), movimientoData);
        console.log(`Movimiento de caja '${tipo}' para '${cajaSerie}' registrado.`);

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

        // Registrar en el historial general
        const accionHistorial = `CAJA: ${tipo.toUpperCase()}`;
        let mensajeHistorial = `Se registró la ${tipo.toLowerCase()} de la caja "${cajaSerie}".`;
        if (tipo === 'Salida' && prestamoNum) {
            mensajeHistorial += ` Asignada al préstamo N° ${prestamoNum}.`;
        }
        await registrarHistorial(accionHistorial, {
            cajaSerie: cajaSerie,
            tipoMovimiento: tipo,
            prestamoNum: prestamoNum || null,
            mensaje: mensajeHistorial
        });

    } catch (error) {
        console.error("Error al registrar movimiento de caja:", error);
        throw error;
    }
};

export const registrarConsumoItem = async (modelName, itemName) => {
    if (!modelName || !itemName) {
        console.error("registrarConsumoItem: modelName e itemName son requeridos.");
        return;
    }

    try {
        const fecha = new Date();
        const mesISO = fecha.toISOString().slice(0, 7); 
        const statsDocRef = doc(db, "estadisticas_consumo", mesISO);

        const sanitizedModel = sanitizeFieldName(modelName);
        const sanitizedItem = sanitizeFieldName(itemName);

        const updateData = {
            [sanitizedModel]: {
                [sanitizedItem]: increment(1)
            }
        };

        await setDoc(statsDocRef, updateData, { merge: true });

        console.log(`Consumo registrado para item: ${itemName} en modelo: ${modelName}`);

    } catch (error) {
        console.error("Error al registrar consumo de ítem:", error);
    }
};

let notificationTimeout;
export const showNotification = (message, type = 'success') => {
    const toast = document.getElementById('notification-toast');
    if (!toast) {
        console.warn("Elemento de notificación #notification-toast no encontrado.");
        return;
    }
    clearTimeout(notificationTimeout);
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type);
    notificationTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
};

export { 
    httpsCallable, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential,
    EmailAuthProvider, doc, getDoc, setDoc, updateDoc, deleteField, deleteDoc, limit, getMessaging, getToken,
    collection, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, addDoc, increment, arrayUnion
};