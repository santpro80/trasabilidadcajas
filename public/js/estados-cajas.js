import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, getDocs } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const modelosList = document.getElementById('modelos-list');
    const loadingState = document.getElementById('loading-state');

    onAuthStateChanged(auth, async (user) => {
        if (user && userDisplayElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        } else if (!user) {
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => signOut(auth));
    }

    const loadAllModels = async () => {
        if (!modelosList || !loadingState) return;

        try {
            const cajasCollectionRef = collection(db, "Cajas");
            const querySnapshot = await getDocs(cajasCollectionRef);
            
            let allModels = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const modelsInZone = Object.keys(data);
                allModels.push(...modelsInZone);
            });

            // Usamos un Set para eliminar duplicados y luego lo convertimos de nuevo a array
            const uniqueModels = [...new Set(allModels)];
            uniqueModels.sort((a, b) => a.localeCompare(b));

            loadingState.style.display = 'none';
            modelosList.style.display = 'flex';
            modelosList.innerHTML = '';

            if (uniqueModels.length === 0) {
                modelosList.innerHTML = '<p>No se encontraron modelos de cajas.</p>';
                return;
            }

            uniqueModels.forEach(modelName => {
                const listItem = document.createElement('li');
                listItem.className = 'list-item';
                listItem.textContent = modelName;
                
                // ===== CAMBIO AQUÍ: Redirigir a la nueva página =====
                listItem.addEventListener('click', () => {
                    window.location.href = `series-por-modelo.html?modelName=${encodeURIComponent(modelName)}`;
                });
                modelosList.appendChild(listItem);
            });

        } catch (error) {
            console.error("Error al cargar los modelos de cajas:", error);
            loadingState.innerHTML = '<p style="color: red;">Error al cargar los modelos.</p>';
        }
    };

    loadAllModels();
});