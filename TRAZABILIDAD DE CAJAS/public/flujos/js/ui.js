// ui.js - Control de Interfaz, Menús Contextuales, Breadcrumbs y Modales

import { state } from './state.js';

export class FlowchartUI {
  constructor(renderer) {
    this.renderer = renderer;
    this.activeContextMenu = null;
    this.contextTargetNodeId = null;
    this.contextCanvasCoords = { x: 0, y: 0 };
    this.portTarget = null; // { nodeId, port }

    this.setupBreadcrumbs();
    this.setupContextMenus();
    this.setupPortQuickPicker();
    this.setupToolbar();
    this.setupEditModal();
    this.setupModeSwitcher();
    this.setupCloudSyncBadge();
    this.setupMobileControls();
  }

  // 1. Breadcrumbs de Navegación Multinivel
  setupBreadcrumbs() {
    const container = document.getElementById('breadcrumbs-container');
    if (!container) return;

    this.renderBreadcrumbs();
    state.subscribe((type) => {
      if (type === 'navigate' || type === 'import' || type === 'reset' || type === 'update_node' || type === 'cloud_sync') {
        this.renderBreadcrumbs();
      }
      if (type === 'cloud_sync') {
        this.renderer.render();
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
    window.addEventListener('click', (e) => {
      if (e.target.closest('#port-quick-picker') || e.target.closest('.flow-port')) {
        return;
      }
      this.hideContextMenus();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideContextMenus();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.handlePrint();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        state.saveToStorage();
        this.showToast('Diagrama guardado en memoria');
      }
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
        const newNode = state.connectToNewNode(this.contextTargetNodeId, type);
        this.renderer.render();
        this.showToast('Nodo conectado agregado');
        if (newNode) {
          this.openEditModal(newNode.id);
        }
      });
    });

    // Agregar comentario vinculado
    document.getElementById('ctx-node-comment')?.addEventListener('click', () => {
      if (this.contextTargetNodeId) {
        const newNode = state.connectToNewNode(this.contextTargetNodeId, 'note', 'Nota vinculada');
        this.renderer.render();
        this.showToast('Comentario vinculado creado');
        if (newNode) {
          this.openEditModal(newNode.id);
        }
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
        state.removeNode(this.contextTargetNodeId);
        this.renderer.render();
        this.showToast('Nodo eliminado');
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
    this.hidePortQuickPicker();
    this.activeContextMenu = null;
  }

  // 2.1 Popover Rápido de Puerto (Clic en circulito)
  setupPortQuickPicker() {
    const picker = document.getElementById('port-quick-picker');
    if (!picker) return;

    window.addEventListener('open-port-quick-picker', (e) => {
      this.hideContextMenus();
      this.portTarget = { nodeId: e.detail.nodeId, port: e.detail.port };

      // Posicionar picker junto al circulito
      const screenX = e.detail.screenX;
      const screenY = e.detail.screenY;
      this.positionMenu(picker, screenX + 8, screenY - 25);
      picker.classList.remove('hidden');
    });

    // Clic en opciones para generar y conectar
    const spawnButtons = picker.querySelectorAll('[data-quick-spawn]');
    spawnButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.portTarget) return;

        const type = btn.dataset.quickSpawn;
        const fromNodeId = this.portTarget.nodeId;
        const fromPort = this.portTarget.port;
        const fromNode = state.getNode(fromNodeId);

        if (!fromNode) {
          this.hidePortQuickPicker();
          return;
        }

        // Posición inteligente adyacente según el puerto
        let newX, newY;
        if (fromPort === 'bottom') {
          newX = fromNode.x;
          newY = fromNode.y + 170;
        } else if (fromPort === 'left') {
          newX = fromNode.x - 300;
          newY = fromNode.y;
        } else {
          newX = fromNode.x + 300;
          newY = fromNode.y;
        }

        // Evitar superposición exacta
        const ws = state.getCurrentWorkspace();
        while (ws.nodes.some(n => Math.hypot(n.x - newX, n.y - newY) < 50)) {
          newX += 30;
          newY += 35;
        }

        const titles = {
          action: 'Nueva Acción',
          decision: '¿Condición?',
          warning: 'Punto de Control',
          note: 'Nota'
        };

        const texts = {
          action: 'Sin descripción...',
          decision: 'Evaluar bifurcación...',
          warning: 'Verificar tolerancia y seguridad.',
          note: 'Comentario explicativo...'
        };

        const newNode = state.addNode({
          type,
          title: titles[type] || 'Nuevo Paso',
          text: texts[type] || '',
          x: Math.round(newX),
          y: Math.round(newY)
        });

        // Etiqueta de la arista
        let edgeLabel = '';
        if (fromNode.type === 'decision') {
          edgeLabel = fromPort === 'right' ? 'Sí' : 'No';
        }

        // Conectar adecuadamente según el puerto origen
        if (fromPort === 'left') {
          // El nuevo nodo está a la izquierda (anterior), conecta hacia este nodo
          state.addEdge(newNode.id, fromNodeId, '', 'right', 'left');
        } else if (fromPort === 'bottom') {
          state.addEdge(fromNodeId, newNode.id, edgeLabel, 'bottom', 'top');
        } else {
          state.addEdge(fromNodeId, newNode.id, edgeLabel, 'right', 'left');
        }

        this.renderer.render();
        this.renderer.selectNode(newNode.id, false);
        this.hidePortQuickPicker();
        this.showToast(`Bloque "${newNode.title}" conectado`);
        this.openEditModal(newNode.id);
      });
    });

    // Cerrar al hacer clic en cualquier otra parte
    window.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#port-quick-picker') && !e.target.closest('.flow-port')) {
        this.hidePortQuickPicker();
      }
    });
  }

  hidePortQuickPicker() {
    const picker = document.getElementById('port-quick-picker');
    if (picker) {
      picker.classList.add('hidden');
    }
    this.portTarget = null;
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
    this.openEditModal(node.id);
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

    // Guardar / Exportar / Importar / Imprimir
    document.getElementById('btn-save')?.addEventListener('click', async () => {
      state.saveToStorage();
      await state.saveToCloud(true);
      this.showToast('Diagrama guardado y sincronizado en la nube');
    });

    document.getElementById('btn-print')?.addEventListener('click', () => {
      this.handlePrint();
    });

    document.getElementById('btn-export-png')?.addEventListener('click', () => {
      this.handleExportPNG();
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

    // Guardar rápido con Enter en el título
    const titleInput = document.getElementById('edit-node-title');
    titleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn?.click();
      }
    });

    // Guardar rápido con Ctrl+Enter en la descripción
    const textInput = document.getElementById('edit-node-text');
    textInput?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveBtn?.click();
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

    // Focalizar y auto-seleccionar el texto del título para edición inmediata
    setTimeout(() => {
      titleInput?.focus();
      titleInput?.select();
    }, 60);
  }

  closeEditModal() {
    const modal = document.getElementById('edit-node-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  }

  setupModeSwitcher() {
    const btnPan = document.getElementById('btn-mode-pan');
    const btnSelect = document.getElementById('btn-mode-select');

    btnPan?.addEventListener('click', () => {
      this.renderer.setInteractionMode('pan');
      this.showToast('Modo Mano: Arrastra el lienzo');
    });

    btnSelect?.addEventListener('click', () => {
      this.renderer.setInteractionMode('select');
      this.showToast('Modo Selección: Arrastra para recuadro');
    });
  }

  // 4.1 Sincronización en la Nube (Badge en Header)
  setupCloudSyncBadge() {
    const badge = document.getElementById('cloud-sync-badge');
    if (!badge) return;

    state.onSyncStatusChange((status) => {
      badge.className = 'flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all';
      if (status === 'saving' || status === 'syncing') {
        badge.classList.add('bg-amber-500/10', 'text-amber-600', 'dark:text-amber-400', 'border-amber-500/20');
        badge.innerHTML = `<span class="size-2 rounded-full bg-amber-500 animate-ping"></span><span id="cloud-sync-text" class="hidden sm:inline">Guardando...</span>`;
      } else if (status === 'synced') {
        badge.classList.add('bg-emerald-500/10', 'text-emerald-600', 'dark:text-emerald-400', 'border-emerald-500/20');
        badge.innerHTML = `<span class="size-2 rounded-full bg-emerald-500 animate-pulse"></span><span id="cloud-sync-text" class="hidden sm:inline">En la nube</span>`;
      } else if (status === 'error') {
        badge.classList.add('bg-rose-500/10', 'text-rose-600', 'dark:text-rose-400', 'border-rose-500/20');
        badge.innerHTML = `<span class="size-2 rounded-full bg-rose-500"></span><span id="cloud-sync-text" class="hidden sm:inline">Error de sincronización</span>`;
      }
    });
  }

  // 4.2 Controles Móviles (Botón Agregar y Menú Más Opciones)
  setupMobileControls() {
    const btnMobileAdd = document.getElementById('btn-mobile-add');
    const modalMobileAdd = document.getElementById('modal-mobile-add-node');
    const btnCloseMobileAdd = document.getElementById('btn-close-mobile-add');

    btnMobileAdd?.addEventListener('click', () => {
      modalMobileAdd?.classList.remove('hidden');
      modalMobileAdd?.classList.add('flex');
    });

    btnCloseMobileAdd?.addEventListener('click', () => {
      modalMobileAdd?.classList.add('hidden');
      modalMobileAdd?.classList.remove('flex');
    });

    modalMobileAdd?.addEventListener('click', (e) => {
      if (e.target === modalMobileAdd) {
        modalMobileAdd.classList.add('hidden');
        modalMobileAdd.classList.remove('flex');
      }
    });

    // Cerrar bottom sheet al pulsar cualquiera de los tipos de nodo
    modalMobileAdd?.querySelectorAll('[data-quick-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        modalMobileAdd.classList.add('hidden');
        modalMobileAdd.classList.remove('flex');
      });
    });

    // Menú desplegable móvil (⋮)
    const btnMobileMore = document.getElementById('btn-mobile-more');
    const mobileMoreMenu = document.getElementById('mobile-more-menu');

    btnMobileMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      mobileMoreMenu?.classList.toggle('hidden');
      mobileMoreMenu?.classList.toggle('flex');
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-mobile-more') && !e.target.closest('#mobile-more-menu')) {
        mobileMoreMenu?.classList.add('hidden');
        mobileMoreMenu?.classList.remove('flex');
      }
    });

    document.getElementById('btn-mobile-print')?.addEventListener('click', () => {
      mobileMoreMenu?.classList.add('hidden');
      mobileMoreMenu?.classList.remove('flex');
      this.handlePrint();
    });

    document.getElementById('btn-mobile-export-png')?.addEventListener('click', () => {
      mobileMoreMenu?.classList.add('hidden');
      mobileMoreMenu?.classList.remove('flex');
      this.handleExportPNG();
    });

    document.getElementById('btn-mobile-export-json')?.addEventListener('click', () => {
      mobileMoreMenu?.classList.add('hidden');
      mobileMoreMenu?.classList.remove('flex');
      document.getElementById('btn-export-json')?.click();
    });

    document.getElementById('btn-mobile-import-json')?.addEventListener('click', () => {
      mobileMoreMenu?.classList.add('hidden');
      mobileMoreMenu?.classList.remove('flex');
      document.getElementById('btn-import-json')?.click();
    });
  }

  handlePrint() {
    // 1. Configurar encabezado del membrete de impresión
    const printBreadcrumbs = document.getElementById('print-breadcrumbs-text');
    const printDate = document.getElementById('print-date-text');
    
    if (printBreadcrumbs) {
      const crumbs = state.getBreadcrumbs();
      printBreadcrumbs.textContent = crumbs.map(c => c.name).join(' > ');
    }
    if (printDate) {
      const now = new Date();
      printDate.textContent = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // 2. Guardar estado de visualización previo
    const ws = state.getCurrentWorkspace();
    const origPan = { ...(ws.pan || { x: 0, y: 0 }) };
    const origZoom = ws.zoom || 1;

    if (!ws.nodes || ws.nodes.length === 0) {
      window.print();
      return;
    }

    // 3. Reencuadrar todo el diagrama perfectamente centrado para la hoja A4 horizontal (1020px x 570px)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ws.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 240);
      maxY = Math.max(maxY, n.y + 130);
    });

    const printW = 1020;
    const printH = 570;
    const padding = 40;

    const diagramW = maxX - minX;
    const diagramH = maxY - minY;

    const scaleX = (printW - padding * 2) / Math.max(diagramW, 100);
    const scaleY = (printH - padding * 2) / Math.max(diagramH, 100);
    const printZoom = Math.min(scaleX, scaleY, 1.15);

    const printPanX = Math.round((printW - diagramW * printZoom) / 2 - minX * printZoom);
    const printPanY = Math.round((printH - diagramH * printZoom) / 2 - minY * printZoom);

    state.setPan(printPanX, printPanY);
    state.setZoom(printZoom);
    this.renderer.applyTransform();

    // 4. Invocar ventana de impresión
    setTimeout(() => {
      window.print();
      
      // 5. Restaurar vista anterior tras cerrar el diálogo
      setTimeout(() => {
        state.setPan(origPan.x, origPan.y);
        state.setZoom(origZoom);
        this.renderer.applyTransform();
      }, 500);
    }, 150);
  }

  // 6. Exportar Imagen PNG en Alta Resolución con Iconos Vectoriales
  handleExportPNG() {
    const ws = state.getCurrentWorkspace();
    if (!ws.nodes || ws.nodes.length === 0) {
      this.showToast('El diagrama está vacío');
      return;
    }

    this.showToast('Generando imagen de alta resolución...');

    // Calcular límites de todos los nodos
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ws.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 240);
      maxY = Math.max(maxY, n.y + 130);
    });

    const paddingX = 80;
    const paddingTop = 110; // Espacio para el membrete superior
    const paddingBottom = 70;
    const width = maxX - minX + paddingX * 2;
    const height = maxY - minY + paddingTop + paddingBottom;

    const scale = 2; // Alta resolución (Retina 2x)
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const isDark = document.documentElement.classList.contains('dark');

    // 1. Fondo general
    ctx.fillStyle = isDark ? '#0a0f16' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // 2. Cuadrícula sutil de puntos
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
    for (let x = 16; x < width; x += 24) {
      for (let y = 16; y < height; y += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Membrete institucional superior
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    if (ctx.roundRect) ctx.roundRect(paddingX, 24, width - paddingX * 2, 54, 14);
    else ctx.rect(paddingX, 24, width - paddingX * 2, 54);
    ctx.fill();
    ctx.stroke();

    // Título institucional
    ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('VILLALBA SYSTEMS • FLUJOS DE PROCESO', paddingX + 16, 42);

    // Breadcrumbs y Fecha
    const crumbs = state.getBreadcrumbs();
    const breadcrumbsStr = crumbs.map(c => c.name).join(' > ');
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(breadcrumbsStr, paddingX + 16, 61);

    const dateStr = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, width - paddingX - 16, 51);

    // 4. Dibujar conexiones (aristas Bezier)
    ws.edges.forEach(edge => {
      const fromNode = ws.nodes.find(n => n.id === edge.from);
      const toNode = ws.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const p1 = this.renderer.getPortCoordinates(fromNode, edge.fromPort || 'right');
      const p2 = this.renderer.getPortCoordinates(toNode, edge.toPort || 'left');

      const startX = p1.x - minX + paddingX;
      const startY = p1.y - minY + paddingTop;
      const endX = p2.x - minX + paddingX;
      const endY = p2.y - minY + paddingTop;

      let strokeColor = '#3b82f6';
      if (fromNode.type === 'decision') strokeColor = edge.fromPort === 'bottom' ? '#f59e0b' : '#10b981';
      else if (fromNode.type === 'warning') strokeColor = '#f59e0b';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const dx = Math.abs(endX - startX) * 0.5;
      ctx.bezierCurveTo(startX + dx, startY, endX - dx, endY, endX, endY);
      ctx.stroke();

      // Flecha terminal
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 8, endY - 5);
      ctx.lineTo(endX - 8, endY + 5);
      ctx.closePath();
      ctx.fill();

      // Etiqueta de la arista (ej: Sí / No)
      if (edge.label) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
        ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(midX - 20, midY - 10, 40, 20, 6);
        else ctx.rect(midX - 20, midY - 10, 40, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, midX, midY);
      }
    });

    // 5. Dibujar cada uno de los Nodos con sus iconos vectoriales
    ws.nodes.forEach(node => {
      const nx = node.x - minX + paddingX;
      const ny = node.y - minY + paddingTop;
      const nw = 240;
      const nh = node.type === 'action' ? 122 : 106;

      // Colores de borde y fondo
      let borderColor = '#3b82f6';
      let iconBg = 'rgba(59, 130, 246, 0.15)';
      let cardBg = isDark ? '#0e1726' : '#ffffff';

      if (node.type === 'decision') {
        borderColor = '#10b981';
        iconBg = 'rgba(16, 185, 129, 0.15)';
        cardBg = isDark ? '#07221a' : '#ffffff';
      } else if (node.type === 'warning') {
        borderColor = '#f59e0b';
        iconBg = 'rgba(245, 158, 11, 0.15)';
        cardBg = isDark ? '#271a09' : '#ffffff';
      } else if (node.type === 'note') {
        borderColor = '#64748b';
        iconBg = isDark ? '#1e293b' : '#e2e8f0';
        cardBg = isDark ? '#111723' : '#f8fafc';
      }

      // Sombra suave de la tarjeta
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Tarjeta base
      ctx.fillStyle = cardBg;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(nx, ny, nw, nh, 16);
      else ctx.rect(nx, ny, nw, nh);
      ctx.fill();
      ctx.stroke();

      // Reset sombra para elementos internos
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Contenedor del Icono
      const iconX = nx + 14;
      const iconY = ny + 14;
      const iconSize = 28;
      ctx.fillStyle = iconBg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(iconX, iconY, iconSize, iconSize, 8);
      else ctx.rect(iconX, iconY, iconSize, iconSize);
      ctx.fill();

      // Dibujar Icono Vectorial Real
      this.drawVectorIcon(ctx, node.type, iconX + 4, iconY + 4, 20);

      // Título del Nodo
      ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText((node.title || 'Sin Título').toUpperCase(), nx + 48, ny + 20, nw - 60);

      // Texto de descripción multilínea
      ctx.fillStyle = isDark ? '#94a3b8' : '#475569';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      this.drawWrappedText(ctx, node.text || 'Sin descripción...', nx + 16, ny + 50, nw - 32, 15, 2);

      // Badge de Sub-diagrama en acciones
      if (node.type === 'action') {
        ctx.strokeStyle = isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nx + 14, ny + 88);
        ctx.lineTo(nx + nw - 14, ny + 88);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#60a5fa' : '#2563eb';
        ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
        ctx.fillText('SUB-DIAGRAMA (DOBLE CLIC)', nx + 16, ny + 96);
      }

      // Puntos de puerto en los extremos
      ctx.fillStyle = cardBg;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.5;

      // Puerto Izquierdo
      ctx.beginPath();
      ctx.arc(nx, ny + nh / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Puerto Derecho
      ctx.beginPath();
      ctx.arc(nx + nw, ny + nh / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Puerto Inferior si es Decisión
      if (node.type === 'decision') {
        ctx.beginPath();
        ctx.arc(nx + nw / 2, ny + nh, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // 6. Descargar el archivo PNG generado
    const link = document.createElement('a');
    const safeName = ws.name ? ws.name.toLowerCase().replace(/\s+/g, '_') : 'diagrama';
    link.download = `flujo_${safeName}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('Imagen descargada con éxito');
  }

  // Helper para dibujar iconos vectoriales nítidos en el canvas de exportación
  drawVectorIcon(ctx, type, x, y, size) {
    const s = size / 24;
    ctx.save();
    if (type === 'action') {
      // Rayo / Bolt
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(x + 12 * s, y + 2 * s);
      ctx.lineTo(x + 4 * s, y + 13 * s);
      ctx.lineTo(x + 11 * s, y + 13 * s);
      ctx.lineTo(x + 10 * s, y + 22 * s);
      ctx.lineTo(x + 20 * s, y + 10 * s);
      ctx.lineTo(x + 13 * s, y + 10 * s);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'decision') {
      // Bifurcación / Call Split
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(x + 12 * s, y + 21 * s);
      ctx.lineTo(x + 12 * s, y + 14 * s);
      ctx.lineTo(x + 6 * s, y + 8 * s);
      ctx.lineTo(x + 6 * s, y + 4 * s);
      ctx.moveTo(x + 12 * s, y + 14 * s);
      ctx.lineTo(x + 18 * s, y + 8 * s);
      ctx.lineTo(x + 18 * s, y + 4 * s);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(x + 6 * s, y + 2 * s);
      ctx.lineTo(x + 2 * s, y + 7 * s);
      ctx.lineTo(x + 10 * s, y + 7 * s);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x + 18 * s, y + 2 * s);
      ctx.lineTo(x + 14 * s, y + 7 * s);
      ctx.lineTo(x + 22 * s, y + 7 * s);
      ctx.fill();
    } else if (type === 'warning') {
      // Triángulo de alerta
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(x + 12 * s, y + 3 * s);
      ctx.lineTo(x + 22 * s, y + 20 * s);
      ctx.lineTo(x + 2 * s, y + 20 * s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1e1b18';
      ctx.fillRect(x + 11 * s, y + 8 * s, 2 * s, 6 * s);
      ctx.beginPath();
      ctx.arc(x + 12 * s, y + 17 * s, 1.2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Documento / Nota
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(x + 5 * s, y + 3 * s);
      ctx.lineTo(x + 15 * s, y + 3 * s);
      ctx.lineTo(x + 19 * s, y + 7 * s);
      ctx.lineTo(x + 19 * s, y + 21 * s);
      ctx.lineTo(x + 5 * s, y + 21 * s);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 8 * s, y + 10 * s, 8 * s, 1.8 * s);
      ctx.fillRect(x + 8 * s, y + 14 * s, 8 * s, 1.8 * s);
      ctx.fillRect(x + 8 * s, y + 17 * s, 5 * s, 1.8 * s);
    }
    ctx.restore();
  }

  // Helper para dibujar texto multilínea truncado con elipsis si excede
  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    if (!text) return;
    const words = text.split(' ');
    let line = '';
    let linesDrawn = 0;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y + linesDrawn * lineHeight);
        line = words[n] + ' ';
        linesDrawn++;
        if (linesDrawn >= maxLines) return;
      } else {
        line = testLine;
      }
    }
    if (linesDrawn < maxLines) {
      ctx.fillText(line.trim(), x, y + linesDrawn * lineHeight);
    }
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
