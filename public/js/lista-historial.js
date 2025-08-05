// public/js/lista-historial.js

// Importa las instancias de Firebase desde el archivo de configuración centralizado
import { app, auth, db } from './firebase-config.js'; 
import { 
    onAuthStateChanged, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'; // Importa getDocs y orderBy

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayName = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const historyListContainer = document.getElementById('history-list-container');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');

    // Función para mostrar mensajes (aunque no hay un message-area específico aquí, es buena práctica)
    const showMessage = (message, type) => {
        console.log(`Mensaje (${type}): ${message}`);
        // Si quisieras un message-area aquí, tendrías que agregarlo al HTML
    };

    // Escucha los cambios en el estado de autenticación
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Usuario logueado, carga su nombre y el historial
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    userDisplayName.textContent = userData.name || user.email;
                } else {
                    userDisplayName.textContent = user.email;
                    console.warn("Datos de usuario no encontrados en Firestore para UID:", user.uid);
                }

                // Cargar y mostrar historial de movimientos
                await loadHistoryData();

            } catch (error) {
                console.error("Error al cargar datos de usuario o historial:", error);
                userDisplayName.textContent = 'Error';
                showMessage('Error al cargar la información del usuario o el historial.', 'error');
            }
        } else {
            // Usuario no logueado, redirige a la página de login
            window.location.href = 'login.html';
        }
    });

    // Función para cargar y mostrar el historial de movimientos
    async function loadHistoryData() {
        historyListContainer.innerHTML = '<p>Cargando historial...</p>'; // Mensaje de carga

        try {
            // Simulación de datos de historial
            const dummyHistoryData = [
                {
                    date: '2023-10-26 10:30',
                    user: 'Juan Pérez',
                    action: 'Caja "BLOQUEADO 3,5" movida a "Almacén A"',
                    detail: 'Serie: AX2002, Cantidad: 1'
                },
                {
                    date: '2023-10-25 15:00',
                    user: 'María Gómez',
                    action: 'Caja "BLOQUEADO 4,5" registrada',
                    detail: 'Nueva caja creada'
                },
                {
                    date: '2023-10-24 09:15',
                    user: 'Juan Pérez',
                    action: 'Item "CALCANEO" añadido a "BLOQUEADO 3,5"',
                    detail: 'Item ID: ITEM001'
                },
                {
                    date: '2023-10-23 11:45',
                    user: 'Carlos Ruiz',
                    action: 'Caja "FEMUR DISTAL" eliminada',
                    detail: 'Motivo: Dañada'
                },
                {
                    date: '2023-10-22 14:00',
                    user: 'María Gómez',
                    action: 'Caja "HUMERO DISTAL" verificada',
                    detail: 'Estado: OK'
                }
            ];

            // En un futuro, aquí iría la lógica para obtener datos de Firestore.
            // Ejemplo (descomentar y adaptar cuando tengas la colección 'history'):
            /*
            const historyCollectionRef = collection(db, "history");
            const q = query(historyCollectionRef, orderBy("timestamp", "desc")); // Ordenar por fecha descendente
            const querySnapshot = await getDocs(q);

            const historyItems = [];
            querySnapshot.forEach((doc) => {
                historyItems.push(doc.data());
            });
            renderHistory(historyItems);
            */

            // Por ahora, renderizamos los datos de ejemplo
            renderHistory(dummyHistoryData);

        } catch (error) {
            console.error("Error al obtener el historial de Firestore (simulado):", error);
            historyListContainer.innerHTML = '<p class="message-area error">Error al cargar el historial.</p>';
        }
    }

    // Función para renderizar los elementos del historial
    function renderHistory(items) {
        if (items.length === 0) {
            historyListContainer.innerHTML = '<p>No hay movimientos registrados.</p>';
            return;
        }

        historyListContainer.innerHTML = ''; // Limpiar el contenedor
        items.forEach(item => {
            const listItem = document.createElement('div');
            listItem.classList.add('list-item');
            listItem.innerHTML = `
                <p><strong>Fecha:</strong> ${item.date}</p>
                <p><strong>Usuario:</strong> ${item.user}</p>
                <p><strong>Acción:</strong> ${item.action}</p>
                <p><strong>Detalle:</strong> ${item.detail}</p>
            `;
            historyListContainer.appendChild(listItem);
        });
    }

    // Botón de cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión: ' + error.message);
                showMessage('Error al cerrar sesión.', 'error');
            }
        });
    }

    // Botón para volver al menú
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }
});
