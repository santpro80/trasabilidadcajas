import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };