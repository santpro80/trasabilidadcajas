// state.js - Modelo de Estado Jerárquico para Flujos Sandbox con Sincronización en la Nube (Firestore)

import { db, doc, setDoc, onSnapshot } from '../../supervisor/js/firebase-config.js';
import { getShapeConfig } from './shapes.js';

const STORAGE_KEY = 'flujos_sandbox_data_v1';

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
    this.listeners = new Set();
    this.syncStatusListeners = new Set();
    this.cloudSyncStatus = 'syncing'; // 'syncing' | 'synced' | 'saving' | 'offline' | 'error'
    this.cloudDocRef = null;
    this.isRemoteUpdate = false;
    this.cloudSaveTimer = null;

    this.initCloud();
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

  initCloud() {
    try {
      this.cloudDocRef = doc(db, 'flujos_sandbox', 'diagrama_principal');
      this.setSyncStatus('syncing');

      onSnapshot(this.cloudDocRef, (snap) => {
        if (snap.exists()) {
          const remote = snap.data();
          if (remote && remote.data && remote.data.workspaces && remote.data.workspaces.root) {
            const remoteStr = JSON.stringify(remote.data);
            const localStr = JSON.stringify(this.data);
            if (remoteStr !== localStr) {
              this.isRemoteUpdate = true;
              this.data = remote.data;
              this.saveToStorage();
              this.rebuildBreadcrumbs();
              this.notify('cloud_sync');
              this.isRemoteUpdate = false;
            }
            this.setSyncStatus('synced');
          } else {
            this.saveToCloud(true);
            this.setSyncStatus('synced');
          }
        } else {
          // Documento inicial en Firestore
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
    if (!this.cloudDocRef || this.isRemoteUpdate) return;

    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = null;
    }

    const doSave = async () => {
      try {
        this.setSyncStatus('saving');
        const user = localStorage.getItem('userName') || 'Usuario';
        await setDoc(this.cloudDocRef, {
          data: this.data,
          updatedAt: Date.now(),
          updatedBy: user
        }, { merge: true });
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

  // Operaciones con Conexiones / Aristas
  addEdge(fromId, toId, label = '', fromPort = 'right', toPort = 'left') {
    const ws = this.getCurrentWorkspace();
    if (fromId === toId) return null;

    // Evitar aristas duplicadas exactas
    const existing = ws.edges.find(e => e.from === fromId && e.to === toId);
    if (existing) {
      existing.label = label || existing.label;
      this.notify('update_edge');
      return existing;
    }

    const id = 'edge_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newEdge = { id, from: fromId, to: toId, label, fromPort, toPort };
    ws.edges.push(newEdge);
    this.notify('add_edge');
    return newEdge;
  }

  removeEdge(id) {
    const ws = this.getCurrentWorkspace();
    const idx = ws.edges.findIndex(e => e.id === id);
    if (idx === -1) return false;
    ws.edges.splice(idx, 1);
    this.notify('delete_edge');
    return true;
  }

  updateEdgeLabel(id, label) {
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

  // Pan y Zoom por workspace
  setPan(x, y) {
    const ws = this.getCurrentWorkspace();
    ws.pan = { x, y };
  }

  setZoom(zoom) {
    const ws = this.getCurrentWorkspace();
    ws.zoom = zoom;
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
