// renderer.js - Motor Gráfico Interactivo para Canvas Infinito, Nodos y Conexiones Bezier

import { state } from './state.js';

export class FlowchartRenderer {
  constructor(containerEl, svgEl, nodesContainerEl) {
    this.container = containerEl;
    this.svg = svgEl;
    this.nodesContainer = nodesContainerEl;

    // Estado de interacción
    this.interactionMode = 'pan'; // 'pan' | 'select'
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    
    this.isMarqueeSelecting = false;
    this.marqueeStartScreen = { x: 0, y: 0 };
    this.marqueeStartCanvas = { x: 0, y: 0 };

    this.isDraggingNode = false;
    this.draggedNodeId = null;
    this.dragStartCanvas = { x: 0, y: 0 };
    this.dragInitialNodes = {};

    this.isConnecting = false;
    this.connectingFromNodeId = null;
    this.connectingFromPort = 'right';
    this.connectingFromPos = { x: 0, y: 0 };
    this.tempEdgePath = null;
    this.portPointerStart = { x: 0, y: 0 };
    this.portDragged = false;

    this.selectedNodeIds = new Set();

    // Gestos táctiles multitáctiles (Pinch-to-zoom en celulares)
    this.activePointers = new Map();
    this.isPinching = false;
    this.initialPinchDistance = null;
    this.initialPinchZoom = 1;
    this.initialPinchCenter = { x: 0, y: 0 };

    this.setupViewportEvents();
    this.setupDefs();
  }

  setupDefs() {
    // Definir flechas SVG en el defs
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svg.appendChild(defs);
    }
    defs.innerHTML = `
      <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" class="arrow-fill transition-colors" />
      </marker>
      <marker id="arrowhead-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f59e0b" />
      </marker>
      <marker id="arrowhead-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
      </marker>
    `;

    // Path temporal para cable en vivo
    this.tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempEdgePath.setAttribute('class', 'stroke-blue-400 dark:stroke-blue-500 fill-none stroke-[2.5] stroke-dasharray-[4_4] opacity-0 pointer-events-none');
    this.svg.appendChild(this.tempEdgePath);
  }

  // Conversión de coordenadas de pantalla a coordenadas del canvas
  screenToCanvas(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const ws = state.getCurrentWorkspace();
    const pan = ws.pan || { x: 0, y: 0 };
    const zoom = ws.zoom || 1;

    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  }

  setupViewportEvents() {
    // Zoom con rueda centrado en el cursor (Desktop)
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const ws = state.getCurrentWorkspace();
      const currentZoom = ws.zoom || 1;
      const pan = ws.pan || { x: 0, y: 0 };
      const rect = this.container.getBoundingClientRect();

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.min(Math.max(0.25, currentZoom * zoomFactor), 2.5);

      pan.x = mouseX - (mouseX - pan.x) * (newZoom / currentZoom);
      pan.y = mouseY - (mouseY - pan.y) * (newZoom / currentZoom);

      state.setPan(pan.x, pan.y);
      state.setZoom(newZoom);
      this.applyTransform();
    }, { passive: false });

    // Pan o Selección con clic / toque sobre fondo
    this.container.addEventListener('pointerdown', (e) => {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Si hay 2 dedos en pantalla -> Iniciar gesto Pinch-to-Zoom (móvil)
      if (this.activePointers.size === 2) {
        this.isPinching = true;
        this.isPanning = false;
        this.isDraggingNode = false;
        this.isMarqueeSelecting = false;
        const pts = Array.from(this.activePointers.values());
        this.initialPinchDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const ws = state.getCurrentWorkspace();
        this.initialPinchZoom = ws.zoom || 1;
        this.initialPinchCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };
        return;
      }

      if (this.isPinching) return;

      // Si se hizo clic sobre un nodo, puerto o control flotante, no intervenir
      if (e.target.closest('.flow-node') || e.target.closest('.flow-port') || e.target.closest('.flow-edge-action') || e.target.closest('.glass-panel')) {
        return;
      }

      if (e.button === 0 || e.button === 1 || e.pointerType === 'touch') {
        const wantsSelect = (this.interactionMode === 'select' || e.shiftKey) && (e.button === 0 || e.pointerType === 'touch');

        if (wantsSelect && this.interactionMode === 'select') {
          this.isMarqueeSelecting = true;
          this.marqueeStartScreen = { x: e.clientX, y: e.clientY };
          this.marqueeStartCanvas = this.screenToCanvas(e.clientX, e.clientY);
          if (!e.shiftKey) {
            this.deselectAll();
          }
        } else {
          this.isPanning = true;
          const ws = state.getCurrentWorkspace();
          this.panStart = {
            x: e.clientX - (ws.pan.x || 0),
            y: e.clientY - (ws.pan.y || 0)
          };
          this.container.classList.add('cursor-grabbing');
          if (!e.shiftKey) {
            this.deselectAll();
          }
        }
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Gestos de Pinch-to-zoom con dos dedos (Celulares)
      if (this.isPinching && this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const currentDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        if (this.initialPinchDistance > 10) {
          const ratio = currentDist / this.initialPinchDistance;
          const newZoom = Math.min(Math.max(0.25, this.initialPinchZoom * ratio), 2.5);

          const rect = this.container.getBoundingClientRect();
          const centerX = this.initialPinchCenter.x - rect.left;
          const centerY = this.initialPinchCenter.y - rect.top;

          const ws = state.getCurrentWorkspace();
          const pan = ws.pan || { x: 0, y: 0 };
          const currentZoom = ws.zoom || 1;

          pan.x = centerX - (centerX - pan.x) * (newZoom / currentZoom);
          pan.y = centerY - (centerY - pan.y) * (newZoom / currentZoom);

          state.setPan(pan.x, pan.y);
          state.setZoom(newZoom);
          this.applyTransform();
        }
        return;
      }

      // 0. Recuadro de Selección Múltiple (Marquee)
      if (this.isMarqueeSelecting) {
        const box = document.getElementById('marquee-selection-box');
        if (box) {
          const containerRect = this.container.getBoundingClientRect();
          const minX = Math.min(this.marqueeStartScreen.x, e.clientX);
          const maxX = Math.max(this.marqueeStartScreen.x, e.clientX);
          const minY = Math.min(this.marqueeStartScreen.y, e.clientY);
          const maxY = Math.max(this.marqueeStartScreen.y, e.clientY);

          box.style.left = `${minX - containerRect.left}px`;
          box.style.top = `${minY - containerRect.top}px`;
          box.style.width = `${Math.max(2, maxX - minX)}px`;
          box.style.height = `${Math.max(2, maxY - minY)}px`;
          box.classList.remove('hidden');

          // Calcular colisión en coordenadas canvas
          const curCanvas = this.screenToCanvas(e.clientX, e.clientY);
          const cMinX = Math.min(this.marqueeStartCanvas.x, curCanvas.x);
          const cMaxX = Math.max(this.marqueeStartCanvas.x, curCanvas.x);
          const cMinY = Math.min(this.marqueeStartCanvas.y, curCanvas.y);
          const cMaxY = Math.max(this.marqueeStartCanvas.y, curCanvas.y);

          const ws = state.getCurrentWorkspace();
          ws.nodes.forEach(node => {
            const overlaps = (
              node.x < cMaxX &&
              node.x + 240 > cMinX &&
              node.y < cMaxY &&
              node.y + 130 > cMinY
            );
            if (overlaps) {
              this.selectedNodeIds.add(node.id);
              const el = document.getElementById(`node-el-${node.id}`);
              if (el) el.classList.add('node-selected');
            } else if (!e.shiftKey) {
              this.selectedNodeIds.delete(node.id);
              const el = document.getElementById(`node-el-${node.id}`);
              if (el) el.classList.remove('node-selected');
            }
          });
        }
        return;
      }

      // 1. Panning
      if (this.isPanning) {
        const newPanX = e.clientX - this.panStart.x;
        const newPanY = e.clientY - this.panStart.y;
        state.setPan(newPanX, newPanY);
        this.applyTransform();
        return;
      }

      // 2. Dragging Nodo(s) en Bloque
      if (this.isDraggingNode && this.selectedNodeIds.size > 0) {
        const canvasCoords = this.screenToCanvas(e.clientX, e.clientY);
        const dx = canvasCoords.x - this.dragStartCanvas.x;
        const dy = canvasCoords.y - this.dragStartCanvas.y;

        this.selectedNodeIds.forEach(id => {
          const node = state.getNode(id);
          const initial = this.dragInitialNodes[id];
          if (node && initial) {
            node.x = Math.round(initial.x + dx);
            node.y = Math.round(initial.y + dy);
            this.updateNodePosition(node);
          }
        });
        this.renderEdges();
        return;
      }

      // 3. Conexión en vivo
      if (this.isConnecting) {
        const dist = Math.hypot(e.clientX - this.portPointerStart.x, e.clientY - this.portPointerStart.y);
        if (dist > 5) {
          this.portDragged = true;
          const mouseCanvas = this.screenToCanvas(e.clientX, e.clientY);
          const pathData = this.calculateBezier(
            this.connectingFromPos.x,
            this.connectingFromPos.y,
            mouseCanvas.x,
            mouseCanvas.y,
            this.connectingFromPort,
            'left'
          );
          this.tempEdgePath.setAttribute('d', pathData);
          this.tempEdgePath.setAttribute('class', 'stroke-blue-500 fill-none stroke-[2.5] opacity-90 pointer-events-none');
        }
      }
    });

    const onPointerEnd = (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.isPinching = false;
      }

      if (this.isMarqueeSelecting) {
        this.isMarqueeSelecting = false;
        const box = document.getElementById('marquee-selection-box');
        if (box) box.classList.add('hidden');
      }

      if (this.isPanning) {
        this.isPanning = false;
        this.container.classList.remove('cursor-grabbing');
        state.saveToStorage();
      }

      if (this.isDraggingNode) {
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.dragInitialNodes = {};
        state.saveToStorage();
      }

      if (this.isConnecting) {
        this.isConnecting = false;
        this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
      }
    };

    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
  }

  // Aplicar transformación pan/zoom al contenedor de nodos y al SVG
  applyTransform() {
    const ws = state.getCurrentWorkspace();
    const pan = ws.pan || { x: 0, y: 0 };
    const zoom = ws.zoom || 1;

    const transformStr = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    this.nodesContainer.style.transform = transformStr;
    this.nodesContainer.style.transformOrigin = '0 0';

    const svgTransformStr = `translate(${pan.x}, ${pan.y}) scale(${zoom})`;
    const g = this.svg.querySelector('#canvas-transform-group');
    if (g) {
      g.setAttribute('transform', svgTransformStr);
    }

    // Actualizar indicador de zoom en pantalla
    const zoomDisplay = document.getElementById('zoom-percentage');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  // Renderizado Completo del Workspace Actual
  render() {
    const ws = state.getCurrentWorkspace();
    this.applyTransform();
    this.renderNodes();
    this.renderEdges();
  }

  // Renderizar Nodos
  renderNodes() {
    this.nodesContainer.innerHTML = '';
    const ws = state.getCurrentWorkspace();

    ws.nodes.forEach(node => {
      const nodeEl = this.createNodeElement(node);
      this.nodesContainer.appendChild(nodeEl);
    });
  }

  createNodeElement(node) {
    const el = document.createElement('div');
    el.id = `node-el-${node.id}`;
    el.className = `flow-node absolute select-none cursor-grab active:cursor-grabbing ${this.getNodeThemeClass(node.type)}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = '240px';
    el.dataset.nodeId = node.id;

    // Header y contenido
    const icon = this.getNodeIcon(node.type);
    const subFlujoBadge = (node.type === 'action') ? `
      <div class="sub-workspace-hint mt-2.5 pt-2 border-t border-blue-500/20 flex items-center justify-between text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">account_tree</span> Sub-diagrama</span>
        <span class="opacity-70">Doble clic ↵</span>
      </div>
    ` : '';

    el.innerHTML = `
      <!-- Puerto Entrada Izquierdo -->
      <div class="flow-port flow-port-in absolute -left-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:scale-125 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" data-node-id="${node.id}" data-port-type="in" data-port="left" title="Conectar aquí">
        <div class="size-1.5 rounded-full bg-slate-400 dark:bg-slate-500 pointer-events-none"></div>
      </div>

      <!-- Puerto Salida Derecho -->
      <div class="flow-port flow-port-out absolute -right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500 hover:scale-125 hover:bg-blue-500 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" data-node-id="${node.id}" data-port-type="out" data-port="right" title="Arrastrar para conectar">
        <div class="size-1.5 rounded-full bg-blue-500 pointer-events-none"></div>
      </div>

      <!-- Puerto Salida Inferior (especial para Decisiones) -->
      ${node.type === 'decision' ? `
        <div class="flow-port flow-port-out absolute left-1/2 -translate-x-1/2 -bottom-3 size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-emerald-500 hover:scale-125 hover:bg-emerald-500 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" data-node-id="${node.id}" data-port-type="out" data-port="bottom" title="Bifurcación alternativa">
          <div class="size-1.5 rounded-full bg-emerald-500 pointer-events-none"></div>
        </div>
      ` : ''}

      <!-- Cuerpo del Nodo -->
      <div class="p-4 flex flex-col h-full">
        <div class="flex items-center gap-2 mb-1.5">
          <div class="size-7 rounded-lg flex items-center justify-center shrink-0 ${this.getNodeIconBg(node.type)}">
            <span class="material-symbols-outlined text-[16px]">${icon}</span>
          </div>
          <h4 class="node-title text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white truncate flex-1" title="${node.title}">
            ${node.title || 'Sin Título'}
          </h4>
          <button type="button" class="btn-node-edit size-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer shrink-0" title="Editar bloque">
            <span class="material-symbols-outlined text-[15px]">edit</span>
          </button>
        </div>

        <p class="node-text text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-snug line-clamp-3">
          ${node.text || 'Sin descripción...'}
        </p>

        ${subFlujoBadge}
      </div>
    `;

    // Click en botón de editar (para celular y desktop)
    el.querySelector('.btn-node-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('open-edit-node-modal', { detail: { nodeId: node.id } }));
    });

    // Click en sub-diagrama (para celular y desktop)
    el.querySelector('.sub-workspace-hint')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const ok = state.enterSubWorkspace(node.id);
      if (ok) {
        window.dispatchEvent(new CustomEvent('workspace-navigated', { detail: { workspaceId: node.childWorkspaceId } }));
      }
    });

    // Interacción Drag del Nodo
    el.addEventListener('pointerdown', (e) => {
      // Ignorar si se hace click en puertos o botones
      if (e.target.closest('.flow-port') || e.target.closest('.btn-node-edit') || e.target.closest('.sub-workspace-hint')) return;

      if (e.button === 0 || e.pointerType === 'touch') { // Clic izquierdo o toque móvil
        if (e.shiftKey) {
          this.toggleSelectNode(node.id);
        } else if (!this.isNodeSelected(node.id)) {
          this.selectNode(node.id, false);
        }

        // Si este nodo está seleccionado, inicia arrastre grupal
        if (this.isNodeSelected(node.id)) {
          this.isDraggingNode = true;
          this.draggedNodeId = node.id;
          this.dragStartCanvas = this.screenToCanvas(e.clientX, e.clientY);
          this.dragInitialNodes = {};
          this.selectedNodeIds.forEach(id => {
            const n = state.getNode(id);
            if (n) {
              this.dragInitialNodes[id] = { x: n.x, y: n.y };
            }
          });
        }
        e.stopPropagation();
      }
    });

    // Doble clic para entrar en Sub-workspace (si es tipo Acción) o editar
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (node.type === 'action') {
        const ok = state.enterSubWorkspace(node.id);
        if (ok) {
          window.dispatchEvent(new CustomEvent('workspace-navigated', { detail: { workspaceId: node.childWorkspaceId } }));
        }
      } else {
        // Abrir modal de edición
        window.dispatchEvent(new CustomEvent('open-edit-node-modal', { detail: { nodeId: node.id } }));
      }
    });

    // Gestión integral de puertos: Drag para conectar & Clic para abrir opciones rápidas
    const allPorts = el.querySelectorAll('.flow-port');
    allPorts.forEach(port => {
      // Iniciar arrastre de cable desde cualquier puerto
      port.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.isConnecting = true;
        this.portDragged = false;
        this.portPointerStart = { x: e.clientX, y: e.clientY };
        this.connectingFromNodeId = node.id;
        this.connectingFromPort = port.dataset.port || (port.classList.contains('flow-port-in') ? 'left' : 'right');
        const portRect = port.getBoundingClientRect();
        this.connectingFromPos = this.screenToCanvas(portRect.left + portRect.width / 2, portRect.top + portRect.height / 2);
      });

      // Soltar sobre puerto para completar conexión manual
      port.addEventListener('pointerup', (e) => {
        if (this.isConnecting && this.portDragged && this.connectingFromNodeId && this.connectingFromNodeId !== node.id) {
          e.stopPropagation();
          const toPort = port.dataset.port || (port.classList.contains('flow-port-in') ? 'left' : 'right');
          state.addEdge(this.connectingFromNodeId, node.id, '', this.connectingFromPort, toPort);
          this.isConnecting = false;
          this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
          this.renderEdges();
        }
      });

      // Clic directo sobre el circulito -> Abrir Quick-Picker (Acción, Decisión, Comentario...)
      port.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.portDragged) {
          this.portDragged = false;
          return;
        }
        const portDir = port.dataset.port || (port.classList.contains('flow-port-in') ? 'left' : 'right');
        window.dispatchEvent(new CustomEvent('open-port-quick-picker', {
          detail: {
            nodeId: node.id,
            port: portDir,
            screenX: e.clientX,
            screenY: e.clientY
          }
        }));
      });
    });

    return el;
  }

  getNodeThemeClass(type) {
    switch (type) {
      case 'action':
        return 'flow-node-action';
      case 'decision':
        return 'flow-node-decision';
      case 'warning':
        return 'flow-node-warning';
      case 'note':
      default:
        return 'flow-node-note';
    }
  }

  getNodeIcon(type) {
    switch (type) {
      case 'action': return 'bolt';
      case 'decision': return 'call_split';
      case 'warning': return 'warning';
      case 'note': return 'description';
      default: return 'circle';
    }
  }

  getNodeIconBg(type) {
    switch (type) {
      case 'action': return 'bg-blue-500/20 text-blue-500 dark:text-blue-400';
      case 'decision': return 'bg-emerald-500/20 text-emerald-500 dark:text-emerald-400';
      case 'warning': return 'bg-amber-500/20 text-amber-500 dark:text-amber-400';
      case 'note': return 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      default: return 'bg-slate-200 text-slate-600';
    }
  }

  updateNodePosition(node) {
    const el = document.getElementById(`node-el-${node.id}`);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    const btnPan = document.getElementById('btn-mode-pan');
    const btnSelect = document.getElementById('btn-mode-select');
    if (mode === 'pan') {
      btnPan?.classList.add('hud-mode-active');
      btnSelect?.classList.remove('hud-mode-active');
      this.container.classList.remove('cursor-crosshair');
    } else {
      btnSelect?.classList.add('hud-mode-active');
      btnPan?.classList.remove('hud-mode-active');
      this.container.classList.add('cursor-crosshair');
    }
  }

  selectNode(nodeId, multi = false) {
    if (!multi) {
      this.deselectAll();
    }
    this.selectedNodeIds.add(nodeId);
    const el = document.getElementById(`node-el-${nodeId}`);
    if (el) {
      el.classList.add('node-selected');
    }
  }

  toggleSelectNode(nodeId) {
    if (this.selectedNodeIds.has(nodeId)) {
      this.selectedNodeIds.delete(nodeId);
      const el = document.getElementById(`node-el-${nodeId}`);
      if (el) el.classList.remove('node-selected');
    } else {
      this.selectedNodeIds.add(nodeId);
      const el = document.getElementById(`node-el-${nodeId}`);
      if (el) el.classList.add('node-selected');
    }
  }

  deselectAll() {
    this.selectedNodeIds.forEach(id => {
      const el = document.getElementById(`node-el-${id}`);
      if (el) el.classList.remove('node-selected');
    });
    this.selectedNodeIds.clear();
  }

  deselectNode(nodeId) {
    if (nodeId) {
      this.selectedNodeIds.delete(nodeId);
      const el = document.getElementById(`node-el-${nodeId}`);
      if (el) el.classList.remove('node-selected');
    } else {
      this.deselectAll();
    }
  }

  isNodeSelected(nodeId) {
    return this.selectedNodeIds.has(nodeId);
  }

  getSelectedNodeIds() {
    return Array.from(this.selectedNodeIds);
  }

  // Renderizado de Aristas / Conexiones Bezier con Flechas
  renderEdges() {
    let group = this.svg.querySelector('#canvas-edges-group');
    if (!group) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.id = 'canvas-edges-group';
      const mainGroup = this.svg.querySelector('#canvas-transform-group');
      if (mainGroup) mainGroup.insertBefore(group, this.tempEdgePath);
      else this.svg.appendChild(group);
    }
    group.innerHTML = '';

    // Subcapas separadas: Primero todas las líneas (fondo), luego todos los labels (frente)
    const linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linesGroup.setAttribute('class', 'canvas-lines-sublayer');
    const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelsGroup.setAttribute('class', 'canvas-labels-sublayer');

    group.appendChild(linesGroup);
    group.appendChild(labelsGroup);

    const ws = state.getCurrentWorkspace();

    ws.edges.forEach(edge => {
      const fromNode = ws.nodes.find(n => n.id === edge.from);
      const toNode = ws.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const p1 = this.getPortCoordinates(fromNode, edge.fromPort || 'right');
      const p2 = this.getPortCoordinates(toNode, edge.toPort || 'left');

      const pathData = this.calculateBezier(p1.x, p1.y, p2.x, p2.y, edge.fromPort || 'right', edge.toPort || 'left');

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'edge-item group cursor-pointer');
      g.dataset.edgeId = edge.id;

      // Path invisible ancho para facilitar clic / hover
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', pathData);
      hitPath.setAttribute('class', 'stroke-transparent fill-none stroke-[20]');

      // Path visible
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      
      let strokeClass = 'stroke-blue-500 dark:stroke-blue-400';
      let markerId = 'url(#arrowhead)';
      if (fromNode.type === 'decision') {
        strokeClass = edge.fromPort === 'bottom' ? 'stroke-amber-500 dark:stroke-amber-400' : 'stroke-emerald-500 dark:stroke-emerald-400';
        markerId = edge.fromPort === 'bottom' ? 'url(#arrowhead-amber)' : 'url(#arrowhead-emerald)';
      } else if (fromNode.type === 'warning') {
        strokeClass = 'stroke-amber-500 dark:stroke-amber-400';
        markerId = 'url(#arrowhead-amber)';
      }

      path.setAttribute('class', `${strokeClass} fill-none stroke-[2.5] transition-all group-hover:stroke-[4] group-hover:stroke-rose-500`);
      path.setAttribute('marker-end', markerId);

      // Botón de eliminar al hacer click en la arista
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('¿Eliminar esta conexión?')) {
          state.removeEdge(edge.id);
          this.renderEdges();
        }
      });

      g.appendChild(hitPath);
      g.appendChild(path);
      linesGroup.appendChild(g);

      // Label en primer plano (adelante de la línea)
      if (edge.label && String(edge.label).trim()) {
        let midX = (p1.x + p2.x) / 2;
        let midY = (p1.y + p2.y) / 2;

        try {
          const totalLen = path.getTotalLength();
          if (totalLen > 0) {
            const pt = path.getPointAtLength(totalLen * 0.5);
            midX = pt.x;
            midY = pt.y;
          }
        } catch (err) {}

        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('class', 'edge-label-group cursor-pointer');

        const labelText = String(edge.label).trim();
        // Ancho calculado dinámicamente con margen generoso
        const textWidth = Math.max(labelText.length * 8.5 + 26, 60);
        const textHeight = 24;

        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', midX - textWidth / 2);
        labelBg.setAttribute('y', midY - textHeight / 2);
        labelBg.setAttribute('width', textWidth);
        labelBg.setAttribute('height', textHeight);
        labelBg.setAttribute('rx', 8);
        labelBg.setAttribute('class', 'edge-label-bg shadow-md');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'edge-label-text');
        text.textContent = labelText;

        labelGroup.appendChild(labelBg);
        labelGroup.appendChild(text);

        // Click en la etiqueta para editarla rápidamente
        labelGroup.addEventListener('click', (e) => {
          e.stopPropagation();
          const newLabel = prompt('Editar etiqueta de conexión:', edge.label);
          if (newLabel !== null) {
            state.updateEdgeLabel(edge.id, newLabel.trim());
            this.renderEdges();
          }
        });

        labelsGroup.appendChild(labelGroup);
      }
    });
  }

  getPortCoordinates(node, port) {
    const nodeWidth = 240;
    const nodeHeight = 110; // Altura aproximada promedio

    switch (port) {
      case 'right':
        return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 };
      case 'left':
        return { x: node.x, y: node.y + nodeHeight / 2 };
      case 'bottom':
        return { x: node.x + nodeWidth / 2, y: node.y + nodeHeight };
      case 'top':
        return { x: node.x + nodeWidth / 2, y: node.y };
      default:
        return { x: node.x + nodeWidth, y: node.y + nodeHeight / 2 };
    }
  }

  calculateBezier(x1, y1, x2, y2, fromPort, toPort) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const offset = Math.max(dx * 0.5, 40);

    let cx1 = x1 + offset;
    let cy1 = y1;
    let cx2 = x2 - offset;
    let cy2 = y2;

    if (fromPort === 'bottom') {
      cx1 = x1;
      cy1 = y1 + Math.max(dy * 0.5, 40);
    } else if (fromPort === 'top') {
      cx1 = x1;
      cy1 = y1 - Math.max(dy * 0.5, 40);
    }

    if (toPort === 'top') {
      cx2 = x2;
      cy2 = y2 - Math.max(dy * 0.5, 40);
    } else if (toPort === 'bottom') {
      cx2 = x2;
      cy2 = y2 + Math.max(dy * 0.5, 40);
    }

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  // Centrar diagrama en el viewport
  fitView() {
    const ws = state.getCurrentWorkspace();
    if (!ws.nodes || ws.nodes.length === 0) {
      state.setPan(100, 100);
      state.setZoom(1);
      this.applyTransform();
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ws.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 240);
      maxY = Math.max(maxY, n.y + 140);
    });

    const rect = this.container.getBoundingClientRect();
    const diagramWidth = maxX - minX + 160;
    const diagramHeight = maxY - minY + 160;

    const zoomX = rect.width / diagramWidth;
    const zoomY = rect.height / diagramHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.5), 1.3);

    const panX = (rect.width - (maxX + minX) * newZoom) / 2;
    const panY = (rect.height - (maxY + minY) * newZoom) / 2;

    state.setPan(panX, panY);
    state.setZoom(newZoom);
    this.applyTransform();
  }
}
