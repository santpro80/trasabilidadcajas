import {
    db,
    auth,
    onAuthStateChanged,
    signOut,
    doc,
    getDoc
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelNameDisplay = document.getElementById('model-name-display');
    const modelFieldsList = document.getElementById('modelFieldsList');
    const userDisplayName = document.getElementById('user-display-name');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const menuBtn = document.getElementById('menu-btn');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');
    const searchBar = document.getElementById('search-bar');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        if (userDisplayName) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    userDisplayName.textContent = userDocSnap.data().name;
                } else {
                    userDisplayName.textContent = user.email;
                }
            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
                userDisplayName.textContent = user.email;
            }
        }

        loadModelDetails();
    });

    const showState = (stateElement) => {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (modelFieldsList) modelFieldsList.style.display = 'none';
        
        if (stateElement) {
            stateElement.style.display = (stateElement === modelFieldsList) ? 'flex' : 'block';
        }
    };

    const loadModelDetails = async () => {
        showState(loadingState);
        const urlParams = new URLSearchParams(window.location.search);
        const zonaName = urlParams.get('zonaName');

        if (!zonaName) {
            modelNameDisplay.textContent = "Error: Zona no especificada";
            showState(errorState);
            return;
        }
        
        modelNameDisplay.textContent = `Modelos para: ${zonaName}`;

        try {
            const docRef = doc(db, "Cajas", zonaName);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const modelNames = Object.keys(data).sort();
                
                modelFieldsList.innerHTML = '';

                if (modelNames.length === 0) {
                    showState(emptyState);
                    return;
                }

                modelNames.forEach(modelName => {
                    const listItem = document.createElement('li');
                    listItem.className = 'list-item';
                    listItem.textContent = modelName;

                    listItem.addEventListener('click', () => {
                        window.location.href = `numeros-de-serie.html?modelName=${encodeURIComponent(modelName)}&zonaName=${encodeURIComponent(zonaName)}`;
                    });

                    modelFieldsList.appendChild(listItem);
                });

                showState(modelFieldsList);
            } else {
                showState(emptyState);
            }
        } catch (error) {
            console.error("Error al cargar los modelos:", error);
            showState(errorState);
        }
    };

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'modelos-de-cajas.html';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = 'login.html';
        });
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            window.location.href = 'menu.html';
        });
    }

    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const listItems = modelFieldsList.getElementsByTagName('li');
            
            Array.from(listItems).forEach(item => {
                const itemText = item.textContent.toLowerCase();
                if (itemText.includes(searchTerm)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
});