import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, query, where, getDocs } from './firebase-config.js';

const userDisplayElement = document.getElementById('user-display-name');
const logoutBtn = document.getElementById('logout-btn');
const serialInput = document.getElementById('serialInput');
const resultContainer = document.getElementById('result-container');
const loadingSpinner = document.getElementById('loadingSpinner');

// 1. Verificar Autenticación
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDisplayElement) {
            userDisplayElement.textContent = userDoc.exists() ? (userDoc.data().name || user.email) : user.email;
        }
        // Enfocar el input automáticamente al cargar
        serialInput.focus();
    } else {
        window.location.href = '../login.html';
    }
});

// 2. Cerrar Sesión
logoutBtn?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
});

// 3. Lógica de Búsqueda (Al presionar Enter)
serialInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
        const serial = serialInput.value.trim().toUpperCase();
        
        if (!serial) return;

        // UI: Mostrar carga
        serialInput.disabled = true;
        loadingSpinner.style.display = 'block';
        resultContainer.style.display = 'none';
        resultContainer.className = ''; // Limpiar clases anteriores

        try {
            // Consultar Firestore: Buscar reportes con estado 'nuevo' para esa caja
            const q = query(
                collection(db, "problemas_cajas"),
                where("cajaSerial", "==", serial),
                where("estado", "==", "nuevo")
            );

            const querySnapshot = await getDocs(q);

            resultContainer.style.display = 'block';
            if (!querySnapshot.empty) {
                // CASO: TIENE REPORTE
                resultContainer.textContent = "⚠️ Esta caja tiene un reporte de daños. Comunicarse con el sector de mantenimiento.";
                resultContainer.classList.add('result-danger');
            } else {
                // CASO: NO TIENE REPORTE
                resultContainer.textContent = "✅ Esta caja no tiene informes de daños.";
                resultContainer.classList.add('result-success');
            }
        } catch (error) {
            console.error("Error al buscar reporte:", error);
            resultContainer.style.display = 'block';
            resultContainer.textContent = "❌ Error al consultar la base de datos.";
            resultContainer.classList.add('result-danger');
        } finally {
            // UI: Restaurar estado
            loadingSpinner.style.display = 'none';
            serialInput.disabled = false;
            serialInput.value = ''; // Limpiar input para la siguiente lectura
            serialInput.focus(); // Volver a enfocar para escáner
        }
    }
});