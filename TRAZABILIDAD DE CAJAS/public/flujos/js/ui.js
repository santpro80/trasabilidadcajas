// ui.js - Control de Interfaz, Menús Contextuales, Breadcrumbs y Modales

import { state } from './state.js';

export class FlowchartUI {
  constructor(renderer) {
    this.renderer = renderer;
    this.activeContextMenu = null;
    this.contextTargetNodeId = null;
    this.contextCanvasCoords = { x: 0, y: 0 };

    this.setupBreadcrumbs();
    this.setupContextMenus();
    this.setupToolbar();
    this.setupEditModal();
  }

  // 1. Breadcrumbs de Navegación Multinivel
  setupBreadcrumbs() {
    const container = document.getElementById('breadcrumbs-container');
    if (!container) return;

    this.renderBreadcrumbs();
    state.subscribe((type) => {
      if (type === 'navigate' || type === 'import' || type === 'reset' || type === 'update_node') {
        this.renderBreadcrumbs();
      }
    });

    window.addEventListener('workspace-navigated', () => {
      this.renderBreadcrumbs();
      this.renderer.render();
      this.renderer.fitView();
    });
  }

  renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs-container');
    if (!container) return;

    const crumbs = state.getBreadcrumbs();
    container.innerHTML = '';

    crumbs.forEach((crumb, index) => {
      const isLast = index === crumbs.length - 1;

      const btn = document.createElement('button');
      btn.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
        isLast
          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
      }`;
      
      const icon = index === 0 ? 'home' : 'account_tree';
      btn.innerHTML = `<span class="material-symbols-outlined text-[15px]">${icon}</span> ${crumb.name}`;

      btn.addEventListener('click', () => {
        if (!isLast) {
          state.navigateToWorkspace(crumb.id);
          this.renderer.render();
          this.renderer.fitView();
          this.showToast(`Nivel: ${crumb.name}`);
        }
      });

      container.appendChild(btn);

      if (!isLast) {
        const separator = document.createElement('span');
        separator.className = 'text-slate-400 text-xs font-bold';
        separator.textContent = '>';
        container.appendChild(separator);
      }
    });
  }

  // 2. Menús Contextuales (Clic Derecho en lienzo y en nodos)
  setupContextMenus() {
    const canvasMenu = document.getElementById('context-menu-canvas');
    const nodeMenu = document.getElementById('context-menu-node');

    // Desactivar menú nativo en el contenedor del lienzo
    this.renderer.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.hideContextMenus();

      const nodeEl = e.target.closest('.flow-node');
      const mouseCanvas = this.renderer.screenToCanvas(e.clientX, e.clientY);
      this.contextCanvasCoords = mouseCanvas;

      if (nodeEl) {
        // Clic derecho en un nodo existente
        const nodeId = nodeEl.dataset.nodeId;
        this.contextTargetNodeId = nodeId;
        this.showNodeContextMenu(e.clientX, e.clientY, nodeId);
      } else {
        // Clic derecho en el fondo del lienzo
        this.showCanvasContextMenu(e.clientX, e.clientY);
      }
    });

    // Cerrar menú al hacer clic en cualquier lado o presionar Escape
    window.addEventListener('click', () => this.hideContextMenus());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideContextMenus();
    });

    // Acciones del Menú Contextual de Lienzo (Crear Nodos)
    document.querySelectorAll('[data-action-create]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.actionCreate;
        this.createNodeAtCoords(type, this.contextCanvasCoords);
      });
    });

    // Acción: Centrar diagrama desde context menu
    document.getElementById('ctx-action-fit')?.addEventListener('click', () => {
      this.renderer.fitView();
    });

    // Acciones del Menú Contextual de Nodo
    document.getElementById('ctx-node-subflow')?.addEventListener('click', () => {
      if (this.contextTargetNodeId) {
        state.enterSubWorkspace(this.contextTargetNodeId);
        this.renderer.render();
        this.renderer.fitView();
      }
    });

    // Submenú: Conectar con nuevo nodo...
    document.querySelectorAll('[data-action-connect]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!this.contextTargetNodeId) return;
        const type = e.currentTarget.dataset.actionConnect;
        state.connectToNewNode(this.contextTargetNodeId, type);
        this.renderer.render();
        this.showToast('Nodo conectado agregado');
      });
    });

    // Agregar comentario vinculado
    document.getElementById('ctx-node-comment')?.addEventListener('click', () => {
      if (this.contextTargetNodeId) {
        state.connectToNewNode(this.contextTargetNodeId, 'note', 'Nota vinculada');
        this.renderer.render();
        this.showToast('Comentario vinculado creado');
      }
    });

    // Editar texto / detalles
    document.getElementById('ctx-node-edit')?.addEventListener('click', () => {
      if (this.contextTargetNodeId) {
        this.openEditModal(this.contextTargetNodeId);
      }
    });

    // Eliminar nodo
    document.getElementById('ctx-node-delete')?.addEventListener('click', () => {
      if (this.contextTargetNodeId) {
        if (confirm('¿Eliminar este nodo y todas sus conexiones?')) {
          state.removeNode(this.contextTargetNodeId);
          this.renderer.render();
          this.showToast('Nodo eliminado');
        }
      }
    });

    // Evento custom para abrir modal de edición
    window.addEventListener('open-edit-node-modal', (e) => {
      if (e.detail?.nodeId) {
        this.openEditModal(e.detail.nodeId);
      }
    });
  }

  showCanvasContextMenu(screenX, screenY) {
    const menu = document.getElementById('context-menu-canvas');
    if (!menu) return;
    this.positionMenu(menu, screenX, screenY);
    menu.classList.remove('hidden');
    this.activeContextMenu = menu;
  }

  showNodeContextMenu(screenX, screenY, nodeId) {
    const menu = document.getElementById('context-menu-node');
    if (!menu) return;

    const node = state.getNode(nodeId);
    // Mostrar u ocultar opción de "Abrir Sub-diagrama" según si es tipo acción
    const subflowBtn = document.getElementById('ctx-node-subflow');
    if (subflowBtn) {
      if (node && node.type === 'action') {
        subflowBtn.classList.remove('hidden');
      } else {
        subflowBtn.classList.add('hidden');
      }
    }

    this.positionMenu(menu, screenX, screenY);
    menu.classList.remove('hidden');
    this.activeContextMenu = menu;
  }

  positionMenu(menuEl, x, y) {
    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;

    // Ajustar si se sale de la pantalla
    const rect = menuEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      menuEl.style.left = `${window.innerWidth - rect.width - 12}px`;
    }
    if (y + rect.height > window.innerHeight) {
      menuEl.style.top = `${window.innerHeight - rect.height - 12}px`;
    }
  }

  hideContextMenus() {
    document.getElementById('context-menu-canvas')?.classList.add('hidden');
    document.getElementById('context-menu-node')?.classList.add('hidden');
    this.activeContextMenu = null;
  }

  createNodeAtCoords(type, coords) {
    const titles = {
      action: 'Nueva Acción',
      decision: '¿Condición?',
      warning: 'Alerta / Riesgo',
      note: 'Nota'
    };

    const node = state.addNode({
      type,
      title: titles[type] || 'Nuevo Paso',
      text: '',
      x: Math.round(coords.x - 120),
      y: Math.round(coords.y - 40)
    });

    this.renderer.render();
    this.renderer.selectNode(node.id);
    this.showToast(`Nodo "${node.title}" creado`);
  }

  // 3. Barra de Herramientas
  setupToolbar() {
    // Botones rápidos de agregar nodo (+ Acción, + Decisión, etc.)
    document.querySelectorAll('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.quickAdd;
        const ws = state.getCurrentWorkspace();
        const pan = ws.pan || { x: 0, y: 0 };
        const zoom = ws.zoom || 1;
        const rect = this.renderer.container.getBoundingClientRect();

        // Crear cerca del centro de la pantalla visible
        const centerCanvas = {
          x: (rect.width / 2 - pan.x) / zoom,
          y: (rect.height / 2 - pan.y) / zoom
        };

        this.createNodeAtCoords(type, centerCanvas);
      });
    });

    // Zoom Controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      const ws = state.getCurrentWorkspace();
      state.setZoom(Math.min((ws.zoom || 1) * 1.2, 2.5));
      this.renderer.applyTransform();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      const ws = state.getCurrentWorkspace();
      state.setZoom(Math.max((ws.zoom || 1) * 0.8, 0.25));
      this.renderer.applyTransform();
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.renderer.fitView();
    });

    // Guardar / Exportar / Importar
    document.getElementById('btn-save')?.addEventListener('click', () => {
      state.saveToStorage();
      this.showToast('Diagrama guardado en memoria');
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const json = state.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flujos_sandbox_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      this.showToast('Diagrama exportado como JSON');
    });

    const fileInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const ok = state.importJSON(evt.target.result);
        if (ok) {
          this.renderer.render();
          this.renderer.fitView();
          this.showToast('Diagrama importado con éxito');
        } else {
          alert('Error al importar el archivo JSON. Verifica el formato.');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    // Limpiar / Reiniciar
    document.getElementById('btn-reset-diagram')?.addEventListener('click', () => {
      if (confirm('¿Deseas restablecer el diagrama a la plantilla inicial de ejemplo? Se perderán los cambios actuales no exportados.')) {
        state.resetToDefault();
        this.renderer.render();
        this.renderer.fitView();
        this.showToast('Diagrama restablecido');
      }
    });
  }

  // 4. Modal para Editar Nodo
  setupEditModal() {
    const modal = document.getElementById('edit-node-modal');
    const closeBtn = document.getElementById('btn-close-edit-modal');
    const saveBtn = document.getElementById('btn-save-node-edit');

    if (!modal) return;

    closeBtn?.addEventListener('click', () => this.closeEditModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeEditModal();
    });

    saveBtn?.addEventListener('click', () => {
      const nodeId = document.getElementById('edit-node-id')?.value;
      const title = document.getElementById('edit-node-title')?.value.trim();
      const text = document.getElementById('edit-node-text')?.value.trim();
      const type = document.getElementById('edit-node-type')?.value;

      if (nodeId) {
        state.updateNode(nodeId, { title, text, type });
        this.renderer.render();
        this.closeEditModal();
        this.showToast('Nodo actualizado');
      }
    });
  }

  openEditModal(nodeId) {
    const node = state.getNode(nodeId);
    if (!node) return;

    const modal = document.getElementById('edit-node-modal');
    const idInput = document.getElementById('edit-node-id');
    const titleInput = document.getElementById('edit-node-title');
    const textInput = document.getElementById('edit-node-text');
    const typeSelect = document.getElementById('edit-node-type');

    if (idInput) idInput.value = node.id;
    if (titleInput) titleInput.value = node.title || '';
    if (textInput) textInput.value = node.text || '';
    if (typeSelect) typeSelect.value = node.type || 'action';

    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    titleInput?.focus();
  }

  closeEditModal() {
    const modal = document.getElementById('edit-node-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }

  // Notificaciones Toast
  showToast(msg) {
    const toast = document.getElementById('toast-msg');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    }, 2800);
  }
}
