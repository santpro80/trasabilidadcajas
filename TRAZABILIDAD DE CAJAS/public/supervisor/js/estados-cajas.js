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
                        tempAllBoxesByModel[modelName].push(...serials);
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
            modelSection.className = 'glass-card rounded-[2rem] p-6 shadow-sm flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300';

            const modelHeader = `
                <div class="flex items-center gap-3 border-b border-slate-200 dark:border-white/5 pb-4 mb-2">
                    <div class="w-10 h-10 rounded-xl bg-villalba-blue/10 flex items-center justify-center text-villalba-blue shrink-0">
                        <span class="material-symbols-outlined text-[20px]">inventory_2</span>
                    </div>
                    <div>
                        <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">${modelName}</h2>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${boxesToRenderByModel[modelName].length} Unidades</p>
                    </div>
                </div>
            `;
            modelSection.innerHTML = modelHeader;

            const boxesList = document.createElement('div');
            boxesList.className = 'grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar';

            boxesToRenderByModel[modelName].sort().forEach(serial => {
                const statusData = statusMap.get(serial);
                const status = statusData ? statusData.status : 'Disponible'; 
                
                const listItem = document.createElement('div');
                listItem.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 group transition-all hover:border-villalba-blue/30 hover:translate-x-1';
                
                const statusStyles = status === 'Disponible' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400';

                listItem.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="w-1.5 h-1.5 rounded-full ${status === 'Disponible' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
                        <span class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tighter">${serial}</span>
                    </div>
                    <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusStyles}">${status}</span>
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
            window.location.href = '../login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});