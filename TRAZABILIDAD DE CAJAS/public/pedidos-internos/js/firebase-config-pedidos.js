import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, doc, collection, addDoc, getDocs, getDoc, setDoc, deleteDoc, updateDoc, query, where, serverTimestamp, onSnapshot, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// ---- PRIMER PROYECTO (TRAZABILIDAD) PARA AUTH ----
// Importamos la auth directamente del archivo de configuración global
import { auth, app as appPrincipal } from '../../supervisor/js/firebase-config.js';

// ---- SEGUNDO PROYECTO (PEDIDOS INTERNOS) PARA DATOS ----
const firebaseConfigPedidos = {
  apiKey: "AIzaSyAYIpj9TLO1i-Y5DP7s-rL-yNMCHj8k5Nk",
  authDomain: "pedidos-internos-villalba.firebaseapp.com",
  projectId: "pedidos-internos-villalba",
  storageBucket: "pedidos-internos-villalba.firebasestorage.app",
  messagingSenderId: "75158915851",
  appId: "1:75158915851:web:5d0ac90577afb1bd72b00e",
  measurementId: "G-77F4GEG5C6"
};

// Inicializamos la SEGUNDA app dándole un nombre explícito para que no colisione con la principal
const appPedidos = initializeApp(firebaseConfigPedidos, "pedidos_internos_app");

// Sacamos Firestore de esa segunda app
const dbPedidos = getFirestore(appPedidos);

export {
  auth,
  appPrincipal,
  appPedidos,
  dbPedidos,
  doc,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  orderBy,
  onAuthStateChanged,
  signOut
};
