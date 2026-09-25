// state.js - Modelo de Estado Jerárquico para Flujos Sandbox con Sincronización en la Nube (Firestore)

import { db, doc, getDoc, setDoc, onSnapshot } from '../../supervisor/js/firebase-config.js';
import { getShapeConfig } from './shapes.js?v=2.3';

const STORAGE_KEY = 'flujos_sandbox_data_v1';
const SERVER_META_KEY = 'flujos_server_meta_v1';

const DEFAULT_INITIAL_DATA = {
  currentWorkspaceId: 'root',
  breadcrumbs: [{ id: 'root', name: 'Principal' }],
  workspaces: {
    'root': {
      id: 'root',
      name: 'Principal',
      parentId: null,
      parentNodeId: null,
      pan: { x: 120, y: 100 },
      zoom: 1,
      nodes: [
        {
          id: 'node_1',
          type: 'action',
          title: 'Recepción de Materia Prima',
          text: 'Ingreso al depósito y verificación de remito.',
          x: 100,
          y: 180,
          childWorkspaceId: 'ws_sub_1'
        },
        {
          id: 'node_2',
          type: 'decision',
          title: 'Control de Calidad',
          text: '¿El lote cumple con las especificaciones técnicas?',
          x: 440,
          y: 170,
          childWorkspaceId: null
        },
        {
          id: 'node_3',
          type: 'warning',
          title: 'Alerta: Ensayo de Dureza',
          text: 'Tolerancia crítica de mecanizado. Revisar probeta.',
          x: 440,
          y: 380,
          childWorkspaceId: null
        },
        {
          id: 'node_4',
          type: 'action',
          title: 'Aprobación y Producción',
          text: 'Asignar código de trazabilidad y pasar a planta.',
          x: 780,
          y: 180,
          childWorkspaceId: null
        },
        {
          id: 'node_5',
          type: 'note',
          title: 'Nota de Operación',
          text: 'Doble clic en "Recepción de Materia Prima" para explorar el sub-proceso detallado.',
          x: 100,
          y: 360,
          childWorkspaceId: null
        }
      ],
      edges: [
        { id: 'edge_1', from: 'node_1', to: 'node_2', fromPort: 'right', toPort: 'left', label: '' },
        { id: 'edge_2', from: 'node_2', to: 'node_4', fromPort: 'right', toPort: 'left', label: 'Aprobado' },
        { id: 'edge_3', from: 'node_2', to: 'node_3', fromPort: 'bottom', toPort: 'top', label: 'Revisión' }
      ]
    },
    'ws_sub_1': {
      id: 'ws_sub_1',
      name: 'Recepción de Materia Prima',
      parentId: 'root',
      parentNodeId: 'node_1',
      pan: { x: 150, y: 150 },
      zoom: 1,
      nodes: [
        {
          id: 'sub_1',
          type: 'action',
          title: 'Descarga de Camión',
          text: 'Verificar precintos de seguridad y estado de embalaje.',
          x: 100,
          y: 180,
          childWorkspaceId: null
        },
        {
          id: 'sub_2',
          type: 'action',
          title: 'Muestreo de Lote',
          text: 'Extracción de 3 muestras representativas para análisis.',
          x: 450,
          y: 180,
          childWorkspaceId: null
        },
        {
          id: 'sub_3',
          type: 'note',
          title: 'Sub-flujo Nivel 2',
          text: 'Podés crear más niveles anidados haciendo doble clic en cualquier nodo de tipo Acción.',
          x: 280,
          y: 340,
          childWorkspaceId: null
        }
      ],
      edges: [
        { id: 'sub_edge_1', from: 'sub_1', to: 'sub_2', fromPort: 'right', toPort: 'left', label: '' }
      ]
    }
  }
};

class FlowchartState {
  constructor() {
    this.data = this.loadFromStorage() || JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
    this.applyLocalViewports();

    // Si es pantalla grande de escritorio y el zoom guardado previamente quedó degradado (< 0.65) por sincronizaciones viejas, recuperar a 1.0 (100%)
    if (typeof window !== 'undefined' && window.innerWidth >= 1024 && this.data && this.data.workspaces) {
      for (const ws of Object.values(this.data.workspaces)) {
        if (!ws.zoom || ws.zoom < 0.65) {
          ws.zoom = 1;
          ws.pan = { x: 120, y: 100 };
        }
      }
      this.saveLocalViewports();
    }

    // Identificador único de cliente / pestaña para saber el origen de los cambios
    this.clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.isDirty = false; // Solo es true si el usuario en ESTA pestaña hizo una edición real
    this.currentServerVersion = 0;
    this.lastSyncedServerTime = 0;
    this.loadServerMeta();

    this.listeners = new Set();
    this.syncStatusListeners = new Set();
    this.cloudSyncStatus = 'syncing'; // 'syncing' | 'synced' | 'saving' | 'offline' | 'error'
    this.cloudDocRef = null;
    this.isRemoteUpdate = false;
    this.cloudSaveTimer = null;

    // Historial para Deshacer (Undo) y Rehacer (Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.historyListeners = new Set();
    this.isHistoryAction = false;

    this.initCloud();
  }

  onHistoryChange(callback) {
    this.historyListeners.add(callback);
    callback(this.canUndo(), this.canRedo());
    return () => this.historyListeners.delete(callback);
  }

  notifyHistoryChange() {
    for (const cb of this.historyListeners) {
      cb(this.canUndo(), this.canRedo());
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  takeSnapshot() {
    if (this.isRemoteUpdate || this.isHistoryAction) return;
    try {
      const snap = JSON.stringify(this.data);
      if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snap) {
        return;
      }
      this.undoStack.push(snap);
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
      this.notifyHistoryChange();
    } catch (e) {
      console.warn('Error en takeSnapshot:', e);
    }
  }

  pushSnapshot(snapshotJson) {
    if (this.isRemoteUpdate || this.isHistoryAction || !snapshotJson) return;
    try {
      if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshotJson) {
        return;
      }
      this.undoStack.push(snapshotJson);
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
      this.notifyHistoryChange();
    } catch (e) {
      console.warn('Error en pushSnapshot:', e);
    }
  }

  undo() {
    if (!this.canUndo()) return false;
    try {
      const currentSnap = JSON.stringify(this.data);
      this.redoStack.push(currentSnap);
      const prevSnap = this.undoStack.pop();
      this.isHistoryAction = true;
      this.data = JSON.parse(prevSnap);
      this.rebuildBreadcrumbs();
      this.isHistoryAction = false;
      this.notify('undo');
      this.notifyHistoryChange();
      return true;
    } catch (e) {
      console.error('Error al deshacer:', e);
      this.isHistoryAction = false;
      return false;
    }
  }

  redo() {
    if (!this.canRedo()) return false;
    try {
      const currentSnap = JSON.stringify(this.data);
      this.undoStack.push(currentSnap);
      const nextSnap = this.redoStack.pop();
      this.isHistoryAction = true;
      this.data = JSON.parse(nextSnap);
      this.rebuildBreadcrumbs();
      this.isHistoryAction = false;
      this.notify('redo');
      this.notifyHistoryChange();
      return true;
    } catch (e) {
      console.error('Error al rehacer:', e);
      this.isHistoryAction = false;
      return false;
    }
  }

  onSyncStatusChange(callback) {
    this.syncStatusListeners.add(callback);
    callback(this.cloudSyncStatus);
    return () => this.syncStatusListeners.delete(callback);
  }

  setSyncStatus(status) {
    this.cloudSyncStatus = status;
    for (const cb of this.syncStatusListeners) {
      cb(status);
    }
  }

  saveServerMeta() {
    try {
      localStorage.setItem(SERVER_META_KEY, JSON.stringify({
        serverVersion: this.currentServerVersion,
        lastSyncedServerTime: this.lastSyncedServerTime
      }));
    } catch (e) {}
  }

  loadServerMeta() {
    try {
      const raw = localStorage.getItem(SERVER_META_KEY);
      if (raw) {
        const meta = JSON.parse(raw);
        this.currentServerVersion = meta.serverVersion || 0;
        this.lastSyncedServerTime = meta.lastSyncedServerTime || 0;
      }
    } catch (e) {}
  }

  cleanContent(data) {
    if (!data || !data.workspaces) return '';
    const cleaned = {};
    for (const [id, ws] of Object.entries(data.workspaces)) {
      cleaned[id] = {
        id: ws.id,
        name: ws.name,
        parentId: ws.parentId,
        parentNodeId: ws.parentNodeId,
        nodes: (ws.nodes || []).map(n => ({
          id: n.id,
          shape: n.shape,
          type: n.type,
          title: n.title,
          text: n.text,
          x: n.x,
          y: n.y,
          childWorkspaceId: n.childWorkspaceId
        })),
        edges: (ws.edges || []).map(e => ({
          id: e.id,
          from: e.from,
          to: e.to,
          fromPort: e.fromPort,
          toPort: e.toPort,
          label: e.label
        }))
      };
    }
    return JSON.stringify(cleaned);
  }

  applyRemoteData(remoteData, serverVersion = 0, updatedAt = 0) {
    this.isRemoteUpdate = true;

    // 1. Guardar la cámara actual de este dispositivo (pan y zoom de cada workspace)
    const localViewports = {};
    if (this.data && this.data.workspaces) {
      for (const [wsId, ws] of Object.entries(this.data.workspaces)) {
        localViewports[wsId] = {
          pan: ws.pan ? { ...ws.pan } : { x: 120, y: 100 },
          zoom: ws.zoom || 1
        };
      }
    }
    const localCurrentWsId = this.data?.currentWorkspaceId;

    // Clonar para no mutar el objeto original y eliminar pan/zoom de los datos remotos
    const cleanRemote = JSON.parse(JSON.stringify(remoteData));
    if (cleanRemote && cleanRemote.workspaces) {
      for (const ws of Object.values(cleanRemote.workspaces)) {
        delete ws.pan;
        delete ws.zoom;
      }
    }

    this.data = cleanRemote;

    // 2. Restaurar los viewports de este dispositivo para que NUNCA se altere la cámara por la edición de otra persona
    if (this.data && this.data.workspaces) {
      for (const [wsId, ws] of Object.entries(this.data.workspaces)) {
        if (localViewports[wsId]) {
          ws.pan = localViewports[wsId].pan;
          ws.zoom = localViewports[wsId].zoom;
        } else {
          ws.pan = { x: 120, y: 100 };
          ws.zoom = 1;
        }
      }
      if (localCurrentWsId && this.data.workspaces[localCurrentWsId]) {
        this.data.currentWorkspaceId = localCurrentWsId;
      }
    }
    this.applyLocalViewports();

    this.currentServerVersion = serverVersion || this.currentServerVersion;
    this.lastSyncedServerTime = updatedAt || this.lastSyncedServerTime;
    this.isDirty = false;
    this.saveServerMeta();
    this.saveToStorage();
    this.rebuildBreadcrumbs();
    this.notify('cloud_sync');
    this.isRemoteUpdate = false;
  }

  setupLifecycleSync() {
    if (typeof document === 'undefined') return;

    // Cuando la pestaña se oculta (celular bloqueado, cambio de app o pestaña en segundo plano)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Cancelar inmediatamente cualquier guardado diferido pendiente
        // para evitar que se ejecute horas después con datos obsoletos
        if (this.cloudSaveTimer) {
          clearTimeout(this.cloudSaveTimer);
          this.cloudSaveTimer = null;
        }
      } else if (document.visibilityState === 'visible') {
        // La pestaña volvió del reposo o suspensión: SINCRONIZAR DE INMEDIATO CON EL SERVIDOR
        this.syncWithServerForce();
      }
    });

    // En móviles, pageshow se dispara cuando el navegador restaura la pestaña de la suspensión de memoria
    window.addEventListener('pageshow', () => {
      this.syncWithServerForce();
    });

    // Al volver a hacer foco en la ventana
    window.addEventListener('focus', () => {
      this.syncWithServerForce();
    });

    // Al recuperar la conexión a internet
    window.addEventListener('online', () => {
      this.syncWithServerForce();
    });
  }

  async syncWithServerForce() {
    if (!this.cloudDocRef) return;
    try {
      // Cancelar cualquier temporizador de guardado pendiente previo
      if (this.cloudSaveTimer) {
        clearTimeout(this.cloudSaveTimer);
        this.cloudSaveTimer = null;
      }

      const snap = await getDoc(this.cloudDocRef);
      if (snap.exists()) {
        const remote = snap.data();
        if (remote && remote.data && remote.data.workspaces && remote.data.workspaces.root) {
          const remoteVersion = remote.serverVersion || 0;
          const remoteTime = remote.updatedAt || 0;
          const remoteClientId = remote.lastClientId;

          const remoteContentStr = this.cleanContent(remote.data);
          const localContentStr = this.cleanContent(this.data);

          // Si el servidor tiene datos más nuevos o diferentes a los que tiene este cliente
          const serverIsNewer = (remoteVersion > this.currentServerVersion) ||
                                (remoteClientId && remoteClientId !== this.clientId && remoteTime > this.lastSyncedServerTime) ||
                                (remoteContentStr !== localContentStr);

          if (serverIsNewer) {
            console.log('[Flujos Sync] Tab restaurada/despertada: La versión del servidor manda. Actualizando...');
            this.applyRemoteData(remote.data, remoteVersion, remoteTime);
            this.isDirty = false;
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: { message: `Sincronizado con la versión del servidor (${remote.updatedBy || 'Servidor'})` }
            }));
          }
          this.setSyncStatus('synced');
        }
      }
    } catch (err) {
      console.warn('Error en syncWithServerForce:', err);
    }
  }

  initCloud() {
    try {
      this.cloudDocRef = doc(db, 'flujos_sandbox', 'diagrama_principal');
      this.setSyncStatus('syncing');

      // Escuchar eventos de ciclo de vida (suspensión en celulares, cambio de pestaña, reconexión)
      this.setupLifecycleSync();

      // Sincronización inicial forzada para que el servidor siempre prevalezca sobre datos viejos en localStorage
      this.syncWithServerForce();

      onSnapshot(this.cloudDocRef, (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          if (remote && remote.data && remote.data.workspaces && remote.data.workspaces.root) {
            const remoteVersion = remote.serverVersion || 0;
            const remoteTime = remote.updatedAt || 0;
            const remoteClientId = remote.lastClientId;

            // Si el cambio lo acaba de guardar esta misma pestaña/cliente, ya lo tenemos en memoria
            if (remoteClientId === this.clientId) {
              this.currentServerVersion = remoteVersion || this.currentServerVersion;
              this.lastSyncedServerTime = remoteTime || this.lastSyncedServerTime;
              this.saveServerMeta();
              this.setSyncStatus('synced');
              return;
            }

            // Si vino de otro dispositivo, usuario o pestaña:
            const remoteContentStr = this.cleanContent(remote.data);
            const localContentStr = this.cleanContent(this.data);

            const serverIsDifferent = remoteContentStr !== localContentStr;
            const serverIsNewer = (remoteVersion > this.currentServerVersion) || (remoteTime > this.lastSyncedServerTime);

            if (serverIsDifferent || serverIsNewer) {
              // Cancelar cualquier guardado que esta pestaña tuviera en cola para no pisar el servidor
              if (this.cloudSaveTimer) {
                clearTimeout(this.cloudSaveTimer);
                this.cloudSaveTimer = null;
              }

              this.applyRemoteData(remote.data, remoteVersion, remoteTime);
              this.isDirty = false;
              window.dispatchEvent(new CustomEvent('show-toast', {
                detail: { message: `Actualizado en vivo (${remote.updatedBy || 'otro dispositivo'})` }
              }));
            } else {
              this.currentServerVersion = remoteVersion || this.currentServerVersion;
              this.lastSyncedServerTime = remoteTime || this.lastSyncedServerTime;
              this.saveServerMeta();
            }
            this.setSyncStatus('synced');
          }
        } else {
          // Documento inicial en Firestore solo si la base de datos está completamente vacía
          this.isDirty = true;
          this.saveToCloud(true);
        }
      }, (err) => {
        console.warn('Error en conexión con Firestore en flujos:', err);
        this.setSyncStatus('offline');
      });
    } catch (e) {
      console.warn('Firebase no disponible para Flujos:', e);
      this.setSyncStatus('offline');
    }
  }

  async saveToCloud(immediate = false) {
    if (!this.cloudDocRef || this.isRemoteUpdate || !this.isDirty) return;

    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = null;
    }

    const doSave = async () => {
      if (!this.isDirty || this.isRemoteUpdate || !this.cloudDocRef) return;
      try {
        this.setSyncStatus('saving');
        const user = localStorage.getItem('userName') || 'Usuario';

        // 1. REGLA DE ORO (Optimistic Concurrency Control):
        // Comprobar primero si el servidor tiene cambios más nuevos antes de escribir
        let serverVersion = this.currentServerVersion;
        const currentSnap = await getDoc(this.cloudDocRef);

        if (currentSnap.exists()) {
          const serverDoc = currentSnap.data();
          const remoteVersion = serverDoc?.serverVersion || 0;
          const remoteClientId = serverDoc?.lastClientId;
          const remoteUpdatedAt = serverDoc?.updatedAt || 0;

          // ¿Alguien más (o yo mismo desde la compu) guardó algo más nuevo mientras esta pestaña estaba suspendida o abierta?
          const isServerAhead = (remoteVersion > this.currentServerVersion) || 
                               (remoteClientId && remoteClientId !== this.clientId && remoteUpdatedAt > this.lastSyncedServerTime);

          if (isServerAhead) {
            console.warn('[Flujos Cloud] Conflicto evitado: El servidor tiene una versión más nueva. No se sobrescribe.');

            // Respaldar cambios locales no sincronizados en localStorage como salvaguarda
            try {
              localStorage.setItem(`flujos_backup_conflict_${Date.now()}`, JSON.stringify(this.data));
            } catch (e) {}

            // LA VERSIÓN DEL SERVIDOR MANDA: cargamos la del servidor y cancelamos el guardado local
            if (serverDoc && serverDoc.data && serverDoc.data.workspaces) {
              this.applyRemoteData(serverDoc.data, remoteVersion, remoteUpdatedAt);
            }
            this.isDirty = false;
            this.setSyncStatus('synced');
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: { message: `⚠️ Se actualizó a la última versión guardada desde otro dispositivo (${serverDoc.updatedBy || 'Servidor'}) para no sobrescribir el trabajo.` }
            }));
            return;
          }

          serverVersion = remoteVersion;
        }

        // 2. Si no hay conflicto: se incrementa la versión y se guarda en el servidor
        const nextVersion = serverVersion + 1;
        const cloudData = JSON.parse(JSON.stringify(this.data));
        if (cloudData && cloudData.workspaces) {
          for (const ws of Object.values(cloudData.workspaces)) {
            delete ws.pan;
            delete ws.zoom;
          }
        }

        const now = Date.now();
        await setDoc(this.cloudDocRef, {
          data: cloudData,
          serverVersion: nextVersion,
          updatedAt: now,
          updatedBy: user,
          lastClientId: this.clientId
        });

        this.currentServerVersion = nextVersion;
        this.lastSyncedServerTime = now;
        this.isDirty = false;
        this.saveServerMeta();
        this.setSyncStatus('synced');
      } catch (err) {
        console.error('Error guardando en Firestore:', err);
        this.setSyncStatus('error');
      }
    };

    if (immediate) {
      await doSave();
    } else {
      this.cloudSaveTimer = setTimeout(doSave, 800);
    }
  }

  // Suscripción a cambios
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(changeType = 'update') {
    this.saveToStorage();
    if (changeType !== 'cloud_sync') {
      this.isDirty = true;
      this.saveToCloud(false);
    }
    for (const listener of this.listeners) {
      listener(changeType, this);
    }
  }

  // Workspace actual
  getCurrentWorkspace() {
    if (!this.data || !this.data.workspaces) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
    }
    const wsId = this.data.currentWorkspaceId || 'root';
    if (!this.data.workspaces[wsId]) {
      this.data.currentWorkspaceId = 'root';
      this.rebuildBreadcrumbs();
    }
    const ws = this.data.workspaces[this.data.currentWorkspaceId];
    if (!ws.nodes) ws.nodes = [];
    if (!ws.edges) ws.edges = [];
    return ws;
  }

  getBreadcrumbs() {
    return this.data.breadcrumbs || [{ id: 'root', name: 'Principal' }];
  }

  // Navegación multinivel (Sub-Workspaces)
  enterSubWorkspace(nodeId) {
    const currentWs = this.getCurrentWorkspace();
    const node = currentWs.nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'action') return false;

    let subWsId = node.childWorkspaceId;
    if (!subWsId || !this.data.workspaces[subWsId]) {
      // Crear nuevo workspace hijo
      subWsId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      node.childWorkspaceId = subWsId;
      this.data.workspaces[subWsId] = {
        id: subWsId,
        name: node.title || 'Sub-flujo',
        parentId: currentWs.id,
        parentNodeId: node.id,
        pan: { x: 150, y: 150 },
        zoom: 1,
        nodes: [
          {
            id: 'node_' + Date.now(),
            type: 'action',
            title: 'Inicio: ' + (node.title || 'Paso 1'),
            text: 'Detalle inicial del proceso anidado.',
            x: 150,
            y: 180,
            childWorkspaceId: null
          }
        ],
        edges: []
      };
    } else {
      // Actualizar nombre si el nodo cambió de título
      this.data.workspaces[subWsId].name = node.title || 'Sub-flujo';
    }

    this.data.currentWorkspaceId = subWsId;
    this.rebuildBreadcrumbs();
    this.notify('navigate');
    return true;
  }

  navigateToWorkspace(targetWorkspaceId) {
    if (!this.data.workspaces[targetWorkspaceId]) return false;
    this.data.currentWorkspaceId = targetWorkspaceId;
    this.rebuildBreadcrumbs();
    this.notify('navigate');
    return true;
  }

  leaveSubWorkspace() {
    const currentWs = this.getCurrentWorkspace();
    if (!currentWs || !currentWs.parentId) return false;
    return this.navigateToWorkspace(currentWs.parentId);
  }

  rebuildBreadcrumbs() {
    const crumbs = [];
    let curr = this.data.workspaces[this.data.currentWorkspaceId];
    while (curr) {
      crumbs.unshift({ id: curr.id, name: curr.name });
      curr = curr.parentId ? this.data.workspaces[curr.parentId] : null;
    }
    if (crumbs.length === 0) {
      crumbs.push({ id: 'root', name: 'Principal' });
    }
    this.data.breadcrumbs = crumbs;
  }

  // Operaciones con Nodos
  addNode(nodeData) {
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const id = nodeData.id || ('node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const shape = nodeData.shape || (nodeData.type === 'decision' ? 'decision' : nodeData.type === 'note' ? 'comment' : nodeData.type === 'warning' ? 'preparation' : (nodeData.type || 'process'));
    const shapeCfg = getShapeConfig(shape);
    const color = shapeCfg.color || '#3b82f6';

    const newNode = {
      id,
      type: nodeData.type || (shape === 'decision' ? 'decision' : shape === 'comment' ? 'note' : 'action'),
      shape,
      color,
      title: nodeData.title || shapeCfg.defaultTitle || 'Nuevo Bloque',
      text: nodeData.text || '',
      x: nodeData.x !== undefined ? nodeData.x : 200,
      y: nodeData.y !== undefined ? nodeData.y : 200,
      childWorkspaceId: nodeData.childWorkspaceId || null
    };
    ws.nodes.push(newNode);
    this.notify('add_node');
    return newNode;
  }

  updateNode(id, props) {
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const node = ws.nodes.find(n => n.id === id);
    if (!node) return null;

    // Si cambia shape, el color se actualiza al color predeterminado de la nueva forma
    if (props.shape && props.shape !== node.shape) {
      const cfg = getShapeConfig(props.shape);
      props.color = cfg.color;
    }

    Object.assign(node, props);
    
    // Si tiene un sub-workspace y cambió el título, actualizar el nombre del sub-workspace
    if (node.childWorkspaceId && props.title && this.data.workspaces[node.childWorkspaceId]) {
      this.data.workspaces[node.childWorkspaceId].name = props.title;
      this.rebuildBreadcrumbs();
    }

    this.notify('update_node');
    return node;
  }

  removeNode(id) {
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const nodeIndex = ws.nodes.findIndex(n => n.id === id);
    if (nodeIndex === -1) return false;

    const node = ws.nodes[nodeIndex];
    // Eliminar sub-workspace recursivo si existe
    if (node.childWorkspaceId) {
      this.deleteWorkspaceRecursive(node.childWorkspaceId);
    }

    // Quitar nodo
    ws.nodes.splice(nodeIndex, 1);

    // Quitar aristas conectadas
    ws.edges = ws.edges.filter(e => e.from !== id && e.to !== id);

    this.notify('delete_node');
    return true;
  }

  deleteWorkspaceRecursive(wsId) {
    const ws = this.data.workspaces[wsId];
    if (!ws) return;
    for (const node of ws.nodes) {
      if (node.childWorkspaceId) {
        this.deleteWorkspaceRecursive(node.childWorkspaceId);
      }
    }
    delete this.data.workspaces[wsId];
  }

  getNode(id) {
    const ws = this.getCurrentWorkspace();
    return ws.nodes.find(n => n.id === id);
  }

  getEdge(id) {
    const ws = this.getCurrentWorkspace();
    return ws.edges.find(e => e.id === id);
  }

  // Operaciones con Conexiones / Aristas
  addEdge(fromId, toId, label = '', fromPort = 'right', toPort = 'left') {
    const ws = this.getCurrentWorkspace();
    if (fromId === toId) return null;

    // Evitar aristas duplicadas exactas
    const existing = ws.edges.find(e => e.from === fromId && e.to === toId);
    if (existing) {
      if (label && existing.label !== label) {
        this.takeSnapshot();
        existing.label = label;
        this.notify('update_edge');
      }
      return existing;
    }

    this.takeSnapshot();
    const id = 'edge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newEdge = { id, from: fromId, to: toId, label, fromPort, toPort };
    ws.edges.push(newEdge);
    this.notify('add_edge');
    return newEdge;
  }

  removeEdge(id) {
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const idx = ws.edges.findIndex(e => e.id === id);
    if (idx === -1) return false;
    ws.edges.splice(idx, 1);
    this.notify('delete_edge');
    return true;
  }

  updateEdgeLabel(id, label) {
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const edge = ws.edges.find(e => e.id === id);
    if (!edge) return false;
    edge.label = label;
    this.notify('update_edge');
    return true;
  }

  // Quick Action: Conectar con nuevo nodo
  connectToNewNode(fromNodeId, nodeType, customTitle = '') {
    const fromNode = this.getNode(fromNodeId);
    if (!fromNode) return null;

    const titles = {
      action: customTitle || 'Nueva Acción',
      decision: customTitle || 'Decisión',
      warning: customTitle || 'Alerta de Control',
      note: customTitle || 'Nota Vinculada'
    };

    // Ubicar a la derecha o abajo
    const x = fromNode.x + 280;
    const y = fromNode.y + (nodeType === 'note' ? 80 : 0);

    const newNode = this.addNode({
      type: nodeType,
      title: titles[nodeType],
      text: nodeType === 'note' ? 'Detalle explicativo...' : '',
      x,
      y
    });

    this.addEdge(fromNodeId, newNode.id, '', 'right', 'left');
    return newNode;
  }

  // Clonación y duplicación recursiva de workspaces para sub-flujos
  cloneWorkspaceRecursive(sourceWsId, newParentNodeId) {
    const srcWs = this.data.workspaces[sourceWsId];
    if (!srcWs) return null;

    const newWsId = 'ws_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const idMap = new Map();

    const clonedNodes = (srcWs.nodes || []).map(n => {
      const nid = 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      idMap.set(n.id, nid);
      let childWsId = null;
      if (n.childWorkspaceId && this.data.workspaces[n.childWorkspaceId]) {
        childWsId = this.cloneWorkspaceRecursive(n.childWorkspaceId, nid);
      }
      return {
        ...JSON.parse(JSON.stringify(n)),
        id: nid,
        childWorkspaceId: childWsId
      };
    });

    const clonedEdges = (srcWs.edges || []).map(e => ({
      ...JSON.parse(JSON.stringify(e)),
      id: 'edge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      from: idMap.get(e.from) || e.from,
      to: idMap.get(e.to) || e.to
    })).filter(e => idMap.has(e.from) && idMap.has(e.to));

    this.data.workspaces[newWsId] = {
      ...JSON.parse(JSON.stringify(srcWs)),
      id: newWsId,
      parentNodeId: newParentNodeId,
      nodes: clonedNodes,
      edges: clonedEdges
    };

    return newWsId;
  }

  // Duplicar uno o más nodos seleccionados (Ctrl+D)
  duplicateNodes(nodeIds, offsetX = 40, offsetY = 40) {
    if (!nodeIds || nodeIds.length === 0) return [];
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const idMap = new Map();
    const newNodes = [];

    nodeIds.forEach(id => {
      const src = ws.nodes.find(n => n.id === id);
      if (!src) return;
      const newId = 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      idMap.set(id, newId);

      let newChildWsId = null;
      if (src.childWorkspaceId && this.data.workspaces[src.childWorkspaceId]) {
        newChildWsId = this.cloneWorkspaceRecursive(src.childWorkspaceId, newId);
      }

      const cloned = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        x: src.x + offsetX,
        y: src.y + offsetY,
        childWorkspaceId: newChildWsId
      };
      ws.nodes.push(cloned);
      newNodes.push(cloned);
    });

    // Replicar las conexiones que existían entre los nodos seleccionados
    const internalEdges = (ws.edges || []).filter(e => idMap.has(e.from) && idMap.has(e.to));
    internalEdges.forEach(e => {
      const newEdgeId = 'edge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      ws.edges.push({
        ...JSON.parse(JSON.stringify(e)),
        id: newEdgeId,
        from: idMap.get(e.from),
        to: idMap.get(e.to)
      });
    });

    this.notify('add_node');
    return newNodes;
  }

  // Pegar nodos desde el portapapeles (Ctrl+V)
  pasteNodes(nodesData, edgesData = [], targetCoords = null, defaultOffset = 40) {
    if (!nodesData || nodesData.length === 0) return [];
    this.takeSnapshot();
    const ws = this.getCurrentWorkspace();
    const idMap = new Map();
    const newNodes = [];

    let offsetX = defaultOffset;
    let offsetY = defaultOffset;

    if (targetCoords && typeof targetCoords.x === 'number' && typeof targetCoords.y === 'number') {
      let minX = Infinity, minY = Infinity;
      nodesData.forEach(n => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
      });
      offsetX = targetCoords.x - minX;
      offsetY = targetCoords.y - minY;
    }

    nodesData.forEach(src => {
      const newId = 'node_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      idMap.set(src.id, newId);

      let newChildWsId = null;
      if (src.childWorkspaceId && this.data.workspaces[src.childWorkspaceId]) {
        newChildWsId = this.cloneWorkspaceRecursive(src.childWorkspaceId, newId);
      }

      const cloned = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        x: Math.round(src.x + offsetX),
        y: Math.round(src.y + offsetY),
        childWorkspaceId: newChildWsId
      };
      ws.nodes.push(cloned);
      newNodes.push(cloned);
    });

    // Replicar las conexiones que existían entre los nodos pegados
    if (Array.isArray(edgesData)) {
      edgesData.forEach(e => {
        if (idMap.has(e.from) && idMap.has(e.to)) {
          const newEdgeId = 'edge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          ws.edges.push({
            ...JSON.parse(JSON.stringify(e)),
            id: newEdgeId,
            from: idMap.get(e.from),
            to: idMap.get(e.to)
          });
        }
      });
    }

    this.notify('add_node');
    return newNodes;
  }

  // Pan y Zoom por workspace (locales e independientes por pantalla/dispositivo)
  saveLocalViewports() {
    try {
      const viewports = {};
      if (this.data && this.data.workspaces) {
        for (const [id, ws] of Object.entries(this.data.workspaces)) {
          if (ws.pan || ws.zoom) {
            viewports[id] = {
              pan: ws.pan ? { ...ws.pan } : { x: 120, y: 100 },
              zoom: ws.zoom || 1
            };
          }
        }
      }
      localStorage.setItem('flujos_local_viewports', JSON.stringify(viewports));
    } catch (e) {}
  }

  loadLocalViewports() {
    try {
      const raw = localStorage.getItem('flujos_local_viewports');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  applyLocalViewports() {
    const local = this.loadLocalViewports();
    if (this.data && this.data.workspaces) {
      for (const [id, ws] of Object.entries(this.data.workspaces)) {
        if (local[id]) {
          if (local[id].pan) ws.pan = { ...local[id].pan };
          if (local[id].zoom) ws.zoom = local[id].zoom;
        } else {
          ws.pan = ws.pan || { x: 120, y: 100 };
          ws.zoom = ws.zoom || 1;
        }
      }
    }
  }

  setPan(x, y) {
    const ws = this.getCurrentWorkspace();
    ws.pan = { x, y };
    this.saveLocalViewports();
  }

  setZoom(zoom) {
    const ws = this.getCurrentWorkspace();
    ws.zoom = zoom;
    this.saveLocalViewports();
  }

  // Persistencia
  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('Error al leer de localStorage', e);
    }
    return null;
  }

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.workspaces || !parsed.workspaces.root) {
        throw new Error('Estructura de JSON inválida (falta workspaces.root).');
      }
      this.data = parsed;
      this.rebuildBreadcrumbs();
      this.notify('import');
      return true;
    } catch (e) {
      console.error('Error importando JSON:', e);
      return false;
    }
  }

  resetToDefault() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_INITIAL_DATA));
    this.rebuildBreadcrumbs();
    this.notify('reset');
  }
}

export const state = new FlowchartState();
