import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { app, db } from "./firebase-config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const auth = getAuth(app);

// Función de Login
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "menu.html";
  } catch (error) {
    alert("Error al iniciar sesión: " + error.message);
    throw error;
  }
}

// Función de Registro (optimizada con validación de supervisor)
export async function registerUser(email, password, name, role) {
  try {
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, "users", userCredential.user.uid), {
      name,
      email,
      role,
      createdAt: serverTimestamp()
    });
    
    alert("¡Registro exitoso!");
    window.location.href = "dashboard.html";
  } catch (error) {
    alert("Error en registro: " + error.message);
    throw error;
  }
}

// Función de Logout
export async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    alert("Error al cerrar sesión: " + error.message);
  }
}

// ----- Código para manejo del DOM -----
// (Esto debería moverse a los archivos HTML correspondientes)

// Verificación segura de elementos
const registerModal = document.getElementById("register-modal");
if (registerModal) {
  document.getElementById("open-register-btn")?.addEventListener("click", () => {
    registerModal.style.display = "block";
  });

  document.getElementById("close-modal-btn")?.addEventListener("click", () => {
    registerModal.style.display = "none";
  });

  document.getElementById("register-btn")?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("register-email")?.value;
    const password = document.getElementById("register-password")?.value;
    const name = document.getElementById("register-name")?.value;
    const role = document.getElementById("register-role")?.value;
    
    if (email && password && name && role) {
      await registerUser(email, password, name, role);
    }
  });
}