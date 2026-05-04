import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where, addDoc, serverTimestamp, onSnapshot, orderBy, limit, deleteDoc, startAfter } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Import auth and helpers from the existing Principal App for single sign-on
import { auth, onAuthStateChanged, signOut, db as principalDb } from '../../supervisor/js/firebase-config.js';

// Initialize the NEW Deposito Firebase App
const firebaseConfig = {
  apiKey: "AIzaSyDMMWGdRufoYA7I3rMKv_PvySLjs5aGfTc",
  authDomain: "deposito-a7a3d.firebaseapp.com",
  projectId: "deposito-a7a3d",
  storageBucket: "deposito-a7a3d.firebasestorage.app",
  messagingSenderId: "452553052836",
  appId: "1:452553052836:web:2105ba44c33a175b5ccc31"
};

const appDeposito = initializeApp(firebaseConfig, "deposito_app");
const db = getFirestore(appDeposito);

// Rol-based redirection logic for Depósito
export const requireDepositoAuth = (allowedRoles = ['supervisor', 'operario']) => {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '../login.html';
                reject('Unauthenticated');
                return;
            }
            
            try {
                // Fetch user role from the principal database!
                const userDoc = await getDoc(doc(principalDb, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const role = userData.role || 'operario'; // Default
                    
                    if (!allowedRoles.includes(role)) {
                        if (role === 'operario') {
                            window.location.href = 'carga-datos.html';
                        } else {
                            window.location.href = '../menu-principal.html'; 
                        }
                        reject('Unauthorized');
                    } else {
                        resolve({ user, userData });
                    }
                } else {
                    if (allowedRoles.includes('operario')) {
                        resolve({ user, userData: { role: 'operario', name: user.email }});
                    } else {
                        window.location.href = 'carga-datos.html';
                        reject('Unauthorized');
                    }
                }
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    });
};

export {
    auth,
    db, // Esto ahora apunta a deposito-a7a3d
    principalDb, // Exportamos también la principal por si acaso (para traer los usuarios en Auth)
    appDeposito as app,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc,
    setDoc,
    getDocs,
    collection,
    query,
    where,
    addDoc,
    serverTimestamp,
    onSnapshot,
    orderBy,
    limit,
    deleteDoc,
    startAfter
};
