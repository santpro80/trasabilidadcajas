import { db, collection, getDocs, onAuthStateChanged, auth, getDoc, doc, signOut } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayNameElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const listContainer = document.getElementById('list-container');
    const loadingState = document.getElementById('loading-state');
    const searchInput = document.getElementById('searchBoxStatusInput'); 

    let allBoxesData = {}; 
    let allStatusData = new Map(); 

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDisplayNameElement) {
            userDisplayNameElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        }
        loadAndDisplayAllBoxes();
    });

    const loadAndDisplayAllBoxes = async () => {
        loadingState.style.display = 'block';
        listContainer.innerHTML = '';
        listContainer.appendChild(loadingState);

        try {
            const statusSnapshot = await getDocs(collection(db, "caja_estados"));
            allStatusData.clear(); 
            statusSnapshot.forEach(doc => {
                allStatusData.set(doc.id, doc.data());
            });

            const tempAllBoxesByModel = {};
            const zonasSnapshot = await getDocs(collection(db, "Cajas"));
            
            zonasSnapshot.forEach(zonaDoc => {
                const zonaData = zonaDoc.data();
                for (const modelName in zonaData) {
                    if (typeof zonaData[modelName] === 'string') {
                        const serials = zonaData[modelName].split(',').filter(Boolean);
                        if (!tempAllBoxesByModel[modelName]) {
                            tempAllBoxesByModel[modelName] = [];
                        }
                        serials.forEach(serial => {
                            tempAllBoxesByModel[modelName].push(serial);
                        });
                    } else if (Array.isArray(zonaData[modelName])) { 
                        if (!tempAllBoxesByModel[modelName]) {
                            tempAllBoxesByModel[modelName] = [];
                        }POST https://us-central1-cajas-secuela.cloudfunctions.net/setCustomUserRole 500 (Internal Server Error)
s @ service.ts:96
postJSON @ service.ts:255
callAtURL @ service.ts:345
await in callAtURL
call @ service.ts:196
callable @ service.ts:392
(anónimo) @ gestion-usuarios.js:58
gestion-usuarios.js:64 Error al asignar rol: FirebaseError: INTERNAL
                        zonaData[modelName].forEach(serial => {
                            tempAllBoxesByModel[modelName].push(serial); 
                        });
                    }
                }
            });
            allBoxesData = tempAllBoxesByModel;

            filterAndRenderStates(searchInput.value); 

        } catch (error) {
            console.error("Error cargando los estados de las cajas: ", error);
            loadingState.innerHTML = '<p>Error al cargar los estados de las cajas.</p>';
        }
    };

    const filterAndRenderStates = (searchTerm) => {
        listContainer.innerHTML = ''; 
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filteredBoxesByModel = {};

        const sortedModels = Object.keys(allBoxesData).sort();

        for (const modelName of sortedModels) {
            const boxesInModel = allBoxesData[modelName];
            const filteredBoxes = boxesInModel.filter(serial => {
                return serial.toLowerCase().includes(lowerCaseSearchTerm) || 
                       modelName.toLowerCase().includes(lowerCaseSearchTerm);
            });

            if (filteredBoxes.length > 0) {
                filteredBoxesByModel[modelName] = filteredBoxes;
            }
        }

        if (Object.keys(filteredBoxesByModel).length === 0) {
            listContainer.innerHTML = '<p>No se encontraron cajas que coincidan con la búsqueda.</p>';
            return;
        }

        renderActualStates(filteredBoxesByModel, allStatusData);
    };

    const renderActualStates = (boxesToRenderByModel, statusMap) => {
        listContainer.innerHTML = ''; 

        const sortedModels = Object.keys(boxesToRenderByModel).sort();

        for (const modelName of sortedModels) {
            const modelSection = document.createElement('div');
            modelSection.className = 'model-section';

            const modelTitle = document.createElement('h2');
            modelTitle.className = 'model-title';
            modelTitle.textContent = modelName;
            modelSection.appendChild(modelTitle);

            const boxesList = document.createElement('ul');
            boxesList.className = 'item-list';

            boxesToRenderByModel[modelName].sort().forEach(serial => {
                const statusData = statusMap.get(serial);
                const status = statusData ? statusData.status : 'Disponible'; 
                
                const listItem = document.createElement('li');
                listItem.className = 'list-item';
                
                const statusClass = status === 'Disponible' ? 'status-disponible' : 'status-prestada';

                listItem.innerHTML = `
                    <span class="box-serial">${serial}</span>
                    <span class="box-status ${statusClass}">${status}</span>
                `;
                boxesList.appendChild(listItem);
            });

            modelSection.appendChild(boxesList);
            listContainer.appendChild(modelSection);
        }
    };
    
    searchInput.addEventListener('input', () => filterAndRenderStates(searchInput.value)); // NEW

    logoutBtn?.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});