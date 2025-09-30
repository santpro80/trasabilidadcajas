import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Elementos de la UI
    const userDisplayElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const problemasList = document.getElementById('problemas-list');

    // Elementos del Modal
    const modal = document.getElementById('problema-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSerialModelo = document.getElementById('modal-serial-modelo');
    const modalReportadoPor = document.getElementById('modal-reportado-por');
    const modalFecha = document.getElementById('modal-fecha');
    const modalDescripcion = document.getElementById('modal-descripcion');
    const modalStatusSelect = document.getElementById('modal-status-select');

    let currentUser = null;
    let userRole = null;
    let allProblemas = []; // Almacenar todos los problemas

    // Autenticación y carga inicial
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userRole = userData.role;
                userDisplayElement.textContent = userData.name;

                if (userRole !== 'mantenimiento' && userRole !== 'supervisor') {
                    window.location.href = 'menu.html';
                } else {
                    loadProblemas();
                }
            } else {
                window.location.href = 'login.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // Navegación y cierre de sesión
    backBtn.addEventListener('click', () => window.location.href = 'menu.html');
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = 'login.html');
    });

    // Cargar y mostrar los problemas
    async function loadProblemas() {
        loadingState.style.display = 'flex';
        problemasList.style.display = 'none';
        emptyState.style.display = 'none';
        
        try {
            const querySnapshot = await getDocs(collection(db, "problemas_cajas"));
            allProblemas = []; // Limpiar antes de cargar

            if (querySnapshot.empty) {
                emptyState.style.display = 'flex';
                return;
            }

            for (const problemDoc of querySnapshot.docs) {
                const problema = problemDoc.data();
                const userDoc = await getDoc(doc(db, "users", problema.reportadoPor));
                const reportadoPorNombre = userDoc.exists() ? userDoc.data().name : 'Desconocido';
                
                allProblemas.push({
                    id: problemDoc.id,
                    ...problema,
                    reportadoPorNombre
                });
            }
            
            // Ordenar problemas: 'nuevo' y 'en proceso' primero, 'resuelto' al final
            allProblemas.sort((a, b) => {
                const order = { 'nuevo': 1, 'en proceso': 2, 'resuelto': 3 };
                return (order[a.estado] || 99) - (order[b.estado] || 99);
            });

            displayProblemas(allProblemas);

        } catch (error) {
            console.error("Error cargando problemas: ", error);
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = 'Error al cargar los problemas.';
        } finally {
            loadingState.style.display = 'none';
        }
    }

    // Renderizar los items de la lista de problemas
    function displayProblemas(problemas) {
        problemasList.innerHTML = '';
        if (problemas.length === 0) {
            emptyState.style.display = 'flex';
            problemasList.style.display = 'none';
            return;
        }

        problemas.forEach(problema => {
            const listItem = document.createElement('li');
            listItem.className = 'problema-list-item';
            listItem.dataset.id = problema.id;

            const estadoClass = problema.estado.replace(' ', '-').toLowerCase();

            listItem.innerHTML = `
                <div class="problema-info">
                    <span class="serial">${problema.cajaSerial}</span>
                    <span class="modelo">- ${problema.cajaModelo}</span>
                </div>
                <div class="problema-details">
                    <span class="fecha">${problema.fechaReporte.toDate().toLocaleDateString()}</span>
                    <span class="estado ${estadoClass}">${problema.estado}</span>
                </div>
            `;

            listItem.addEventListener('click', () => openModal(problema));
            problemasList.appendChild(listItem);
        });

        problemasList.style.display = 'block';
        emptyState.style.display = 'none';
    }

    // Abrir y poblar el modal
    function openModal(problema) {
        modalSerialModelo.textContent = `${problema.cajaSerial} / ${problema.cajaModelo}`;
        modalReportadoPor.textContent = problema.reportadoPorNombre;
        modalFecha.textContent = problema.fechaReporte.toDate().toLocaleString();
        modalDescripcion.textContent = problema.descripcion;

        // Poblar y seleccionar el estado actual en el select
        modalStatusSelect.innerHTML = `
            <option value="nuevo" ${problema.estado === 'nuevo' ? 'selected' : ''}>Nuevo</option>
            <option value="en proceso" ${problema.estado === 'en proceso' ? 'selected' : ''}>En Proceso</option>
            <option value="resuelto" ${problema.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
        `;
        modalStatusSelect.dataset.id = problema.id; // Guardar id para la actualización

        modal.style.display = 'flex';
    }

    // Cerrar el modal
    function closeModal() {
        modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Actualizar estado desde el modal
    modalStatusSelect.addEventListener('change', async (e) => {
        const problemId = e.target.dataset.id;
        const newStatus = e.target.value;
        const problemRef = doc(db, 'problemas_cajas', problemId);

        try {
            await updateDoc(problemRef, { estado: newStatus });
            // Actualizar la UI instantáneamente
            const changedProblem = allProblemas.find(p => p.id === problemId);
            if (changedProblem) {
                changedProblem.estado = newStatus;
            }
            
            // Re-renderizar toda la lista para reflejar el cambio de estado
            displayProblemas(allProblemas);
            closeModal(); // Cierra el modal después de actualizar

        } catch (error) {
            console.error("Error al actualizar estado: ", error);
        }
    });

});