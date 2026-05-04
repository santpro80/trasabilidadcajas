import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { app, db } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const backBtn = document.getElementById('back-btn');
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const problemasList = document.getElementById('problemas-list');
    const searchInput = document.getElementById('search-input');

    const modal = document.getElementById('problema-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalSerialModelo = document.getElementById('modal-serial-modelo');
    const modalFecha = document.getElementById('modal-fecha');
    const modalTasksList = document.getElementById('modal-tasks-list');
    const reactivarContainer = document.getElementById('reactivar-container');
    const reactivarBtn = document.getElementById('reactivar-btn');

    let currentUser = null;
    let userRole = null;
    let allProblemas = [];

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

    backBtn.addEventListener('click', () => window.location.href = 'menu.html');
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = '../login.html');
    });

    async function loadProblemas() {
        loadingState.style.display = 'flex';
        problemasList.style.display = 'none';
        emptyState.style.display = 'none';
        
        try {
            const querySnapshot = await getDocs(collection(db, "problemas_cajas"));
            allProblemas = [];

            if (querySnapshot.empty) {
                emptyState.style.display = 'flex';
                return;
            }

            for (const problemDoc of querySnapshot.docs) {
                allProblemas.push({ id: problemDoc.id, ...problemDoc.data() });
            }
            if (userRole === 'mantenimiento') {
                allProblemas = allProblemas.filter(p => p.estado !== 'resuelto');
            }
            
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

            const estadoClass = (problema.estado || 'desconocido').replace(' ', '-').toLowerCase();

            listItem.innerHTML = `
                <div class="problema-info">
                    <span class="serial">${problema.cajaSerial}</span>
                    <span class="modelo">${problema.cajaModelo}</span>
                </div>
                <div class="problema-details">
                    <span class="fecha">${problema.fechaReporte.toDate().toLocaleDateString()}</span>
                    <span class="estado ${estadoClass}">${problema.estado}</span>
                </div>
            `;

            listItem.addEventListener('click', () => openModal(problema.id));
            problemasList.appendChild(listItem);
        });

        problemasList.style.display = 'flex';
        emptyState.style.display = 'none';
    }

    async function openModal(problemaId) {
        const problemaRef = doc(db, 'problemas_cajas', problemaId);
        const problemaDoc = await getDoc(problemaRef);

        if (!problemaDoc.exists()) {
            console.error("El problema no existe.");
            return;
        }

        let problemaData = { id: problemaDoc.id, ...problemaDoc.data() };
        if (problemaData.estado === 'nuevo') {
            await updateDoc(problemaRef, { estado: 'en proceso' });
            problemaData.estado = 'en proceso';
            const listItem = problemasList.querySelector(`[data-id="${problemaId}"]`);
            if (listItem) {
                const estadoEl = listItem.querySelector('.estado');
                estadoEl.textContent = 'en proceso';
                estadoEl.className = 'estado en-proceso';
            }
        }

        modalSerialModelo.textContent = `${problemaData.cajaSerial} / ${problemaData.cajaModelo}`;
        modalFecha.textContent = problemaData.fechaReporte.toDate().toLocaleString();
        
        renderTasks(problemaData);

        reactivarBtn.onclick = () => reactivarCaja(problemaData.id);

        modal.style.display = 'flex';
    }

    function renderTasks(problema) {
        modalTasksList.innerHTML = '';
        let allTasksCompleted = true;

        const tasks = Array.isArray(problema.tareas) ? problema.tareas : [];

        if (tasks.length === 0) {
            const noTaskItem = document.createElement('li');
            noTaskItem.textContent = 'No hay tareas específicas descritas.';
            noTaskItem.style.color = '#888';
            noTaskItem.style.padding = '15px';
            modalTasksList.appendChild(noTaskItem);
            allTasksCompleted = true;
        } else {
            tasks.forEach((task, index) => {
                const taskItem = document.createElement('li');
                taskItem.className = 'task-item';
                if (task.completada) {
                    taskItem.classList.add('completed');
                }

                const taskText = document.createElement('span');
                taskText.textContent = task.texto;

                const doneButton = document.createElement('button');
                doneButton.textContent = 'Tarea Realizada';
                doneButton.className = 'btn-task-done';
                doneButton.disabled = task.completada;
                
                doneButton.addEventListener('click', () => {
                    markTaskAsDone(problema, index);
                });

                taskItem.appendChild(taskText);
                taskItem.appendChild(doneButton);
                modalTasksList.appendChild(taskItem);

                if (!task.completada) {
                    allTasksCompleted = false;
                }
            });
        }

        checkReactivarState(allTasksCompleted);
    }
    
    async function markTaskAsDone(problema, taskIndex) {
        const problemaRef = doc(db, 'problemas_cajas', problema.id);
        
        const tasks = Array.isArray(problema.tareas) ? [...problema.tareas] : [];

        if (tasks[taskIndex]) {
            tasks[taskIndex].completada = true;
        }

        try {
            await updateDoc(problemaRef, { tareas: tasks });
            
            problema.tareas = tasks;
            renderTasks(problema);

        } catch (error) {
            console.error("Error al marcar la tarea como completada:", error);
        }
    }

    function checkReactivarState(allTasksCompleted) {
        if (allTasksCompleted) {
            reactivarContainer.style.display = 'block';
        } else {
            reactivarContainer.style.display = 'none';
        }
    }

    async function reactivarCaja(problemaId) {
        const problemaRef = doc(db, 'problemas_cajas', problemaId);
        try {
            await updateDoc(problemaRef, { estado: 'resuelto' });
            const problemInList = allProblemas.find(p => p.id === problemaId);
            if (problemInList) {
                problemInList.estado = 'resuelto';
            }
            displayProblemas(allProblemas); 
            
            closeModal();
        } catch (error) {
            console.error("Error al reactivar la caja:", error);
        }
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProblemas = allProblemas.filter(p => 
            p.cajaSerial.toLowerCase().includes(searchTerm) ||
            p.cajaModelo.toLowerCase().includes(searchTerm)
        );
        displayProblemas(filteredProblemas);
    });
});
