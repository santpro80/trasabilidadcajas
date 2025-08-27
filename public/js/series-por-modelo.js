import { auth, db, onAuthStateChanged, signOut, doc, getDoc, collection, getDocs, updateDoc, serverTimestamp, setDoc } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const userDisplayElement = document.getElementById('user-display-name');
    const logoutBtn = document.getElementById('logout-btn');
    const modelNameDisplay = document.getElementById('model-name-display');
    const seriesList = document.getElementById('series-list');
    const loadingState = document.getElementById('loading-state');
    
    const notaPedidoModal = document.getElementById('nota-pedido-modal');
    const modalSerialNumber = document.getElementById('modal-serial-number');
    const notaPedidoInput = document.getElementById('nota-pedido-input');
    const cancelNotaBtn = document.getElementById('cancel-nota-btn');
    const confirmNotaBtn = document.getElementById('confirm-nota-btn');
    
    const verNotaModal = document.getElementById('ver-nota-modal');
    const viewModalSerialNumber = document.getElementById('view-modal-serial-number');
    const noteDisplay = document.getElementById('note-display');
    const closeViewModalBtn = document.getElementById('close-view-modal-btn');

    let currentSerialForNote = null;

    onAuthStateChanged(auth, async (user) => {
        if (user && userDisplayElement) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userDisplayElement.textContent = userDoc.exists() ? userDoc.data().name : user.email;
        } else if (!user) {
            window.location.href = 'login.html';
        }
        loadSeriesAndStates();
    });

    if (logoutBtn) { logoutBtn.addEventListener('click', () => signOut(auth)); }

    const loadSeriesAndStates = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const modelName = urlParams.get('modelName');
        if (!modelName) { modelNameDisplay.textContent = 'Error: Modelo no especificado.'; return; }
        modelNameDisplay.textContent = `Estado de Series para: ${modelName}`;

        try {
            const cajasSnapshot = await getDocs(collection(db, "Cajas"));
            let allSeries = new Set();
            cajasSnapshot.forEach(doc => {
                const zonaData = doc.data();
                if (zonaData[modelName]) {
                    zonaData[modelName].split(',').map(s => s.trim()).filter(Boolean).forEach(s => allSeries.add(s));
                }
            });

            const sortedSeries = [...allSeries].sort();
            loadingState.style.display = 'none';
            seriesList.style.display = 'flex';
            seriesList.innerHTML = '';

            if (sortedSeries.length === 0) {
                seriesList.innerHTML = '<p>No hay números de serie para este modelo.</p>';
                return;
            }

            for (const serial of sortedSeries) {
                const estadoDocRef = doc(db, "estados_cajas", serial);
                const estadoDocSnap = await getDoc(estadoDocRef);
                
                let estadoData = { estado: 'disponible', notaDePedido: '', numeroPrestamo: '' };
                if (estadoDocSnap.exists()) {
                    estadoData = estadoDocSnap.data();
                }
                const listItem = createSeriesListItem(serial, modelName, estadoData);
                seriesList.appendChild(listItem);
            }
        } catch (error) {
            console.error("Error al cargar series y estados:", error);
            loadingState.innerHTML = '<p style="color: red;">Error al cargar datos.</p>';
        }
    };

    const createSeriesListItem = (serial, modelName, estadoData) => {
        const listItem = document.createElement('li');
        listItem.className = 'list-item';
        
        let statusHTML = '';
        const estado = estadoData.estado || 'disponible';
        
        switch(estado) {
            case 'disponible':
                statusHTML = `
                    <span class="status-dot dot-disponible"></span>
                    <span>Disponible</span>
                    <button class="btn-note btn-add-note" data-serial="${serial}">Agregar Nota</button>
                `;
                break;
            case 'pedida':
                statusHTML = `
                    <span class="status-dot dot-pedida"></span>
                    <span>Pedida</span>
                    <button class="btn-note btn-view-note" data-serial="${serial}" data-note="${estadoData.notaDePedido || 'N/A'}">Ver Nota</button>
                `;
                break;
            case 'prestada':
                statusHTML = `
                    <span class="status-dot dot-prestada"></span>
                    <span>Prestada</span>
                    <span class="status-info">Préstamo: ${estadoData.numeroPrestamo || 'N/A'}</span>
                `;
                break;
        }

        listItem.innerHTML = `
            <div class="serial-info">${serial}</div>
            <div class="status-container">${statusHTML}</div>
        `;

        listItem.querySelector('.serial-info').addEventListener('click', () => {
            window.location.href = `lista-items-por-caja.html?selectedSerialNumber=${encodeURIComponent(serial)}&modelName=${encodeURIComponent(modelName)}`;
        });
        
        const addNoteButton = listItem.querySelector('.btn-add-note');
        if (addNoteButton) {
            addNoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                openNotaModal(e.target.dataset.serial);
            });
        }

        const viewNoteButton = listItem.querySelector('.btn-view-note');
        if (viewNoteButton) {
            viewNoteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                openViewNotaModal(e.target.dataset.serial, e.target.dataset.note);
            });
        }

        return listItem;
    };
    
    const openNotaModal = (serial) => {
        currentSerialForNote = serial;
        modalSerialNumber.textContent = serial;
        notaPedidoInput.value = '';
        notaPedidoModal.style.display = 'flex';
        notaPedidoInput.focus();
    };

    const closeNotaModal = () => {
        notaPedidoModal.style.display = 'none';
        currentSerialForNote = null;
    };

    const confirmNota = async () => {
        const nota = notaPedidoInput.value.trim();
        if (!nota || !currentSerialForNote) return;

        try {
            const estadoDocRef = doc(db, "estados_cajas", currentSerialForNote);
            await setDoc(estadoDocRef, {
                estado: "pedida",
                notaDePedido: nota,
                ultimoMovimiento: serverTimestamp()
            }, { merge: true });
            closeNotaModal();
            loadSeriesAndStates();
        } catch (error) {
            console.error("Error al actualizar estado:", error);
        }
    };

    const openViewNotaModal = (serial, nota) => {
        viewModalSerialNumber.textContent = serial;
        noteDisplay.textContent = nota;
        verNotaModal.style.display = 'flex';
    };

    const closeViewNotaModal = () => {
        verNotaModal.style.display = 'none';
    };
    
    if (cancelNotaBtn) cancelNotaBtn.addEventListener('click', closeNotaModal);
    if (confirmNotaBtn) confirmNotaBtn.addEventListener('click', confirmNota);
    if (closeViewModalBtn) closeViewModalBtn.addEventListener('click', closeViewNotaModal);
});