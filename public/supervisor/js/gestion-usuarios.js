
import { auth, db, onAuthStateChanged, signOut, getDoc, doc, updateDoc, collection, getDocs, query, orderBy, setDoc } from './firebase-config.js';
console.log('Gestion de usuarios script  mamawurbo!');
document.addEventListener('DOMContentLoaded', () => {
    const messageDiv = document.getElementById('message');
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplayName = document.getElementById('user-display-name');
    
    // Nuevos elementos del DOM
    const searchInput = document.getElementById('search-input');
    const suggestionsList = document.getElementById('suggestions-list');
    const editFormContainer = document.getElementById('edit-form-container');
    const editName = document.getElementById('edit-name');
    const editUsername = document.getElementById('edit-username');
    const editEmail = document.getElementById('edit-email');
    const editRole = document.getElementById('edit-role');
    const editSector = document.getElementById('edit-sector');
    const updateUserBtn = document.getElementById('update-user-btn');

    let allUsersCache = []; // Cache local para búsqueda instantánea
    let selectedUserId = null;

    let notificationTimeout;

    const showMessage = (message, type = 'error') => {
        messageDiv.textContent = message;
        messageDiv.className = type === 'success' ? 'message-success' : 'message-error';
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = '';
        }, 5000);
    };

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                console.log("Datos del usuario desde Firestore:", userData); // <-- DEBUG LOG
                userDisplayName.textContent = userData.name || user.email;
                
                // Habilitar el botón solo si el usuario es supervisor
                if (userData.role === "supervisor") {
                    loadAllUsers();
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            userDisplayName.textContent = user.email; 
        }
    });

    // 1. Cargar todos los usuarios (Optimizado para búsqueda local)
    const loadAllUsers = async () => {
        try {
            const q = query(collection(db, "users"), orderBy("name"));
            const querySnapshot = await getDocs(q);
            
            allUsersCache = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`Usuarios cargados: ${allUsersCache.length}`);
        } catch (error) {
            console.error("Error cargando usuarios:", error);
            showMessage("Error al cargar la lista de usuarios.", "error");
        }
    };

    // Función para cargar los sectores desde Firebase (Igual que en registro)
    const loadSectors = async () => {
        if (!editSector) return;
        
        try {
            const docRef = doc(db, "config", "sectors_list");
            const docSnap = await getDoc(docRef);
            let sectors = [];

            if (docSnap.exists()) {
                sectors = docSnap.data().list || [];
            } else {
                sectors = ['002', '004', '005', '007', '008'];
                await setDoc(docRef, { list: sectors });
            }

            editSector.innerHTML = '<option value="" disabled selected>Selecciona un sector</option>';
            sectors.forEach(sector => {
                const option = document.createElement('option');
                option.value = sector;
                option.textContent = sector;
                editSector.appendChild(option);
            });
        } catch (error) {
            console.error("Error cargando sectores:", error);
        }
    };

    loadSectors();

    // 2. Lógica del Buscador (Filtrado en tiempo real)
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            suggestionsList.innerHTML = '';
            
            if (term.length < 1) {
                suggestionsList.classList.add('hidden');
                return;
            }

            const filtered = allUsersCache.filter(user => 
                (user.name && user.name.toLowerCase().includes(term)) || 
                (user.username && user.username.toLowerCase().includes(term))
            );

            if (filtered.length > 0) {
                suggestionsList.classList.remove('hidden');
                filtered.forEach(user => {
                    const li = document.createElement('li');
                    li.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors";
                    li.innerHTML = `
                        <div class="font-bold text-gray-800">${user.name || 'Sin nombre'}</div>
                        <div class="text-xs text-gray-500">@${user.username || 'N/A'} | ${user.email}</div>
                    `;
                    li.addEventListener('click', () => selectUser(user));
                    suggestionsList.appendChild(li);
                });
            } else {
                suggestionsList.classList.add('hidden');
            }
        });
    }

    // 3. Seleccionar Usuario y Rellenar Formulario
    const selectUser = (user) => {
        selectedUserId = user.id;
        editName.value = user.name || '';
        editUsername.value = user.username || '';
        editEmail.value = user.email || '';
        editRole.value = user.role || 'operario'; // Default a operario si no tiene rol
        if (editSector) editSector.value = user.sector || '';
        
        suggestionsList.classList.add('hidden');
        searchInput.value = ''; // Limpiar buscador
        editFormContainer.classList.remove('hidden');
        showMessage('');
    };

    // 4. Actualizar Rol en Firestore
    if (updateUserBtn) {
        updateUserBtn.addEventListener('click', async () => {
            if (!selectedUserId) return;
            
            const newRole = editRole.value;
            const newSector = editSector ? editSector.value : null;

            showMessage('Guardando cambios...', 'info');
            updateUserBtn.disabled = true;

            try {
                const userRef = doc(db, "users", selectedUserId);
                await updateDoc(userRef, {
                    role: newRole,
                    sector: newSector
                });

                // Actualizar cache local para reflejar el cambio sin recargar
                const cachedUser = allUsersCache.find(u => u.id === selectedUserId);
                if (cachedUser) { cachedUser.role = newRole; cachedUser.sector = newSector; }

                showMessage(`Rol actualizado a "${newRole.toUpperCase()}" correctamente.`, 'success');
                setTimeout(() => {
                    editFormContainer.classList.add('hidden');
                    showMessage('');
                }, 2000);

            } catch (error) {
                console.error("Error al actualizar:", error);
                showMessage("Error al guardar en la base de datos.", "error");
            } finally {
                updateUserBtn.disabled = false;
            }
        });
    }

    backBtn.addEventListener('click', () => {
        window.location.href = 'menu.html';
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = '../login.html';
        }).catch((error) => {
            console.error('Error al cerrar sesión:', error);
        });
    });
});
