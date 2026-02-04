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
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const userName = userData.name || user.email;
        const userSector = userData.sector || 'N/A';

        const historialDoc = {
            timestamp: serverTimestamp(),
            usuarioEmail: user.email,
            usuarioNombre: userName,
            sector: userSector,
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
                usuarioNombre: userName,
                usuarioEmail: user.email,
                timestamp: serverTimestamp(),
                cajas: arrayUnion({
                    cajaSerie: cajaSerie,
                    modelName: modelName
                }),
                cajaSerie: cajaSerie, // Mantenemos la última caja en la raíz para compatibilidad
                modelName: modelName
            }, { merge: true });
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

export const uploadToOneDrive = async (fileName, blob, folderPath) => {
    console.log(`[uploadToOneDrive] Iniciando subida real: ${fileName}`);
    const user = auth.currentUser;
    if (!user) {
        console.error("Usuario no autenticado.");
        return false;
    }

    try {
        // 1. Obtener tokens de Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) throw new Error("Usuario no encontrado en BD");
        
        const data = userDoc.data();
        // Intentamos obtener el token de acceso (soporta estructura plana u objeto)
        let accessToken = data.oneDriveAccessToken || (data.oneDriveTokenData ? data.oneDriveTokenData.access_token : null);
        const refreshToken = data.oneDriveRefreshToken;

        if (!accessToken || !refreshToken) {
            console.error("Faltan tokens de OneDrive en el perfil del usuario.");
            return false;
        }

        // Función interna para subir
        const performUpload = async (token) => {
            const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`;
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/pdf' },
                body: blob
            });
            if (response.status === 401) throw new Error("UNAUTHORIZED");
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return true;
        };

        try {
            await performUpload(accessToken);
            console.log("✅ Archivo subido a OneDrive correctamente.");
            return true;
        } catch (error) {
            if (error.message === "UNAUTHORIZED") {
                console.warn("⚠️ Token vencido. Renovando...");
                const refreshUrl = 'https://us-central1-cajas-secuela.cloudfunctions.net/refrescarTokenOneDrive';
                const res = await fetch(refreshUrl, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ refreshToken }) });
                if (!res.ok) throw new Error("Error al renovar token");
                
                const newTokens = await res.json();
                console.log("🔄 Token renovado exitosamente."); // ¡Aquí volverá a aparecer tu mensaje!
                
                await updateDoc(userDocRef, { oneDriveAccessToken: newTokens.access_token, oneDriveRefreshToken: newTokens.refresh_token || refreshToken });
                await performUpload(newTokens.access_token);
                console.log("✅ Archivo subido tras renovación.");
                return true;
            }
            throw error;
        }
    } catch (e) {
        console.error("❌ Error en uploadToOneDrive:", e);
        return false;
    }
};

export { 
    httpsCallable, onAuthStateChanged, signOut, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential,
    EmailAuthProvider, doc, getDoc, setDoc, updateDoc, deleteField, deleteDoc, limit, getMessaging, getToken,
    collection, query, orderBy, onSnapshot, getDocs, where, serverTimestamp, addDoc, increment, arrayUnion
};