import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './firebase-config.js';

const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const userEmailDisplay = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const backBtn = document.getElementById('back-btn');
const modelosList = document.getElementById('modelos-list');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const emptyState = document.getElementById('empty-state'); // Selected directly by ID

// Function to show/hide states
const showState = (stateElement) => {
    const allControlledElements = [loadingState, errorState, emptyState, modelosList];
    allControlledElements.forEach(el => {
        if (el) {
            el.style.display = 'none';
        }
    });

    if (stateElement) {
        stateElement.style.display = 'flex';
        if (stateElement === modelosList) {
            modelosList.style.flexDirection = 'column';
        }
    }
};

// Function to load models from Firestore
const loadModelos = () => {
    showState(loadingState);

    const q = query(collection(db, "Cajas"));

    onSnapshot(q, (snapshot) => {
        modelosList.innerHTML = '';
        const modelos = [];
        snapshot.forEach((doc) => {
            modelos.push({ id: doc.id, ...doc.data() });
        });

        if (modelos.length === 0) {
            showState(emptyState);
        } else {
            showState(modelosList);
            modelos.forEach(modelo => {
                const listItem = document.createElement('li');
                listItem.classList.add('list-item');
                listItem.dataset.modelId = modelo.id;

                const infoDiv = document.createElement('div');
                infoDiv.classList.add('list-item-info');

                const modelName = document.createElement('h3');
                modelName.textContent = modelo.id;
                infoDiv.appendChild(modelName);
                
                listItem.appendChild(infoDiv);

                // Event to navigate to modelado-caja.html when clicking on the item
                listItem.addEventListener('click', () => {
                    window.location.href = `modelado-caja.html?modelId=${encodeURIComponent(modelo.id)}`; // Pass modelId
                });

                modelosList.appendChild(listItem);
            });
        }
    }, (error) => {
        console.error("Error al cargar modelos:", error);
        showState(errorState);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            if (userEmailDisplay) userEmailDisplay.textContent = user.email;
            loadModelos();
        } else {
            window.location.href = 'login.html';
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', loadModelos);
    }
});
