// renderer.js - Motor Gráfico Interactivo para Canvas Infinito, Nodos y Conexiones Bezier

import { state } from './state.js';
import { getShapeConfig, getColorConfig } from './shapes.js';

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
    this.isInteractiveConnecting = false;
    this.connectingFromNodeId = null;
    this.connectingFromPort = 'right';
    this.connectingFromPos = { x: 0, y: 0 };
    this.tempEdgePath = null;
    this.portPointerStart = { x: 0, y: 0 };
    this.portDragged = false;

    this.selectedNodeIds = new Set();
    this.selectedEdgeId = null;
    this.preDragSnapshot = null;

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
      <marker id="arrowhead-rose" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f43f5e" />
      </marker>
    `;

    // Path temporal para cable en vivo dentro del grupo transformado para respetar pan y zoom
    this.tempEdgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.tempEdgePath.setAttribute('class', 'stroke-indigo-500 fill-none stroke-[2.5] stroke-dasharray-[4_4] opacity-0 pointer-events-none');
    const transformGroup = this.svg.querySelector('#canvas-transform-group') || this.svg;
    transformGroup.appendChild(this.tempEdgePath);
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

      // Si estamos en modo interactivo de conexión y se hizo clic en el fondo, cancelar
      if (this.isInteractiveConnecting) {
        this.cancelConnectingMode();
        return;
      }

      // Si se hizo clic sobre un nodo, puerto, arista o control flotante, no intervenir
      if (e.target.closest('.flow-node') || e.target.closest('.flow-port') || e.target.closest('.flow-edge-action') || e.target.closest('.glass-panel') || e.target.closest('.edge-item') || e.target.closest('.edge-label-group') || e.target.closest('.edge-action-group')) {
        return;
      }

      this.deselectEdge();

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
        const dist = this.isInteractiveConnecting ? 10 : Math.hypot(e.clientX - this.portPointerStart.x, e.clientY - this.portPointerStart.y);
        if (dist > 5) {
          if (!this.isInteractiveConnecting) this.portDragged = true;
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
          this.tempEdgePath.setAttribute('class', 'stroke-indigo-500 fill-none stroke-[3] stroke-dasharray-[6_4] opacity-90 pointer-events-none');
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
        let hasMoved = false;
        if (this.dragInitialNodes) {
          for (const [id, initPos] of Object.entries(this.dragInitialNodes)) {
            const n = state.getNode(id);
            if (n && (Math.abs(n.x - initPos.x) > 2 || Math.abs(n.y - initPos.y) > 2)) {
              hasMoved = true;
              break;
            }
          }
        }
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.dragInitialNodes = {};
        if (hasMoved && this.preDragSnapshot) {
          state.pushSnapshot(this.preDragSnapshot);
          this.preDragSnapshot = null;
          state.notify('move_nodes');
        } else {
          this.preDragSnapshot = null;
          state.saveToStorage();
        }
      }

      if (this.isConnecting && !this.isInteractiveConnecting) {
        this.isConnecting = false;
        if (this.tempEdgePath) {
          this.tempEdgePath.setAttribute('d', '');
          this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
        }
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

  // Activar modo interactivo para conectar con otro bloque existente
  startConnectingMode(fromNodeId, fromPort) {
    const fromNode = state.getNode(fromNodeId);
    if (!fromNode) return;

    this.isConnecting = true;
    this.isInteractiveConnecting = true;
    this.connectingFromNodeId = fromNodeId;
    this.connectingFromPort = fromPort || 'right';

    this.connectingFromPos = this.getPortCoordinates(fromNode, this.connectingFromPort);

    // Resaltar todos los demás nodos como destinos válidos
    const allNodeEls = this.nodesContainer.querySelectorAll('.flow-node');
    allNodeEls.forEach(el => {
      if (el.dataset.nodeId !== fromNodeId) {
        el.classList.add('node-connect-target');
      }
    });

    // Mostrar banner superior informativo
    const banner = document.getElementById('connecting-mode-banner');
    const bannerText = document.getElementById('connecting-mode-text');
    if (banner) {
      if (bannerText) {
        bannerText.textContent = `Conectando desde "${fromNode.title || 'Bloque'}": Haz clic en el bloque de destino`;
      }
      banner.classList.remove('hidden');
      banner.classList.add('flex');
    }

    if (this.tempEdgePath) {
      this.tempEdgePath.setAttribute('d', `M ${this.connectingFromPos.x} ${this.connectingFromPos.y} L ${this.connectingFromPos.x} ${this.connectingFromPos.y}`);
      this.tempEdgePath.setAttribute('class', 'stroke-indigo-500 dark:stroke-indigo-400 fill-none stroke-[3] stroke-dasharray-[6_4] opacity-90 pointer-events-none');
    }
  }

  // Cancelar modo interactivo de conexión
  cancelConnectingMode() {
    this.isConnecting = false;
    this.isInteractiveConnecting = false;
    this.connectingFromNodeId = null;

    if (this.tempEdgePath) {
      this.tempEdgePath.setAttribute('d', '');
      this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
    }

    const allNodeEls = this.nodesContainer.querySelectorAll('.node-connect-target');
    allNodeEls.forEach(el => el.classList.remove('node-connect-target'));

    const banner = document.getElementById('connecting-mode-banner');
    if (banner) {
      banner.classList.add('hidden');
      banner.classList.remove('flex');
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
    const shapeKey = node.shape || (node.type === 'decision' ? 'decision' : node.type === 'note' ? 'comment' : node.type === 'warning' ? 'preparation' : (node.type || 'process'));
    const shapeCfg = getShapeConfig(shapeKey);
    // El color de la forma es estrictamente predefinido e inmutable
    const colorCfg = getColorConfig(shapeCfg.color);
    const w = shapeCfg.width || 240;
    const h = shapeCfg.height || 100;

    const el = document.createElement('div');
    el.id = `node-el-${node.id}`;
    el.className = `flow-node absolute select-none cursor-grab active:cursor-grabbing group/node`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.setProperty('--node-color', colorCfg.hex);
    el.style.setProperty('--node-bg-light', colorCfg.bgLight);
    el.style.setProperty('--node-bg-dark', colorCfg.bgDark);
    el.dataset.nodeId = node.id;
    el.dataset.shape = shapeCfg.id;

    // Header y contenido
    const icon = shapeCfg.icon || this.getNodeIcon(node.type);
    // Solo mostrar badge de sub-diagrama si es explícitamente un subproceso o ya tiene un childWorkspaceId vinculado
    const isSubWorkspace = shapeCfg.id === 'subprocess' || !!node.childWorkspaceId;
    const subFlujoBadge = isSubWorkspace ? `
      <div class="sub-workspace-hint mt-1.5 pt-1 border-t border-blue-500/20 flex items-center justify-between text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider cursor-pointer">
        <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">account_tree</span> Sub-diagrama</span>
        <span class="opacity-70">Doble clic ↵</span>
      </div>
    ` : '';

    // Puertos calculados
    const pLeft = shapeCfg.ports.left(w, h);
    const pRight = shapeCfg.ports.right(w, h);
    const pBottom = shapeCfg.ports.bottom ? shapeCfg.ports.bottom(w, h) : null;

    // Padding según geometría para formas rectangulares
    let paddingClass = 'px-4 py-3';
    if (shapeCfg.id === 'data' || shapeCfg.id === 'manual_op') {
      paddingClass = 'px-9 py-3';
    } else if (shapeCfg.id === 'delay') {
      paddingClass = 'pl-5 pr-11 py-3';
    } else if (shapeCfg.id === 'comment') {
      paddingClass = 'pl-6 pr-4 py-3';
    }

    const svgBackground = `
      <svg class="node-shape-svg absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <g class="node-shape-vector" stroke="${colorCfg.hex}">
          ${shapeCfg.renderSvg(w, h)}
        </g>
      </svg>
    `;

    // Renderizado específico según la geometría para que el contenido quede perfectamente enmarcado
    let bodyHtml = '';

    if (shapeCfg.id === 'decision') {
      // 1. Rombo / Decisión: Centrado en el punto medio del rombo
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-10 py-2 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[16px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[13px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[145px] leading-tight" title="${node.title}">
            ${node.title || '¿Condición?'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[135px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'circle') {
      // 2. Círculo / Conector: Centrado concéntrico
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-3 py-2 select-none">
          <div class="flex items-center justify-center gap-1 mb-0.5">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-4 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[11px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[85px] leading-tight" title="${node.title}">
            ${node.title || 'Conector'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[8.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-1 max-w-[80px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'terminal') {
      // 3. Terminal / Inicio-Fin (Cápsula): Centrado en la sección central de la cápsula
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-12 py-2 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[12px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[135px] leading-tight" title="${node.title}">
            ${node.title || 'Inicio / Fin'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[125px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'database') {
      // 4. Base de Datos (Cilindro): Centrado en el cuerpo cilíndrico, protegido bajo la tapa elíptica
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center pt-8 pb-3 px-6 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[12px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[155px] leading-tight" title="${node.title}">
            ${node.title || 'Base de Datos'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[145px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'preparation') {
      // 5. Preparación (Hexágono): Centrado entre los dos vértices laterales
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center px-10 py-2 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[12px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[155px] leading-tight" title="${node.title}">
            ${node.title || 'Preparación'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[145px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'display') {
      // 6. Pantalla / Visualización: Centrado en el cuerpo de pantalla
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-center text-center pl-10 pr-8 py-2 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[12px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[150px] leading-tight" title="${node.title}">
            ${node.title || 'Pantalla / Aviso'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9.5px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[140px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'storage') {
      // 7. Almacenamiento (Triángulo Invertido): Centrado en la parte superior ancha
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col items-center justify-start text-center pt-4 px-10 select-none">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <span class="material-symbols-outlined text-[15px]" style="color: ${colorCfg.hex};">${icon}</span>
            <button type="button" class="btn-node-edit size-5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer" title="Editar bloque">
              <span class="material-symbols-outlined text-[12px]">edit</span>
            </button>
          </div>
          <h4 class="node-title text-[10.5px] font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 max-w-[125px] leading-tight" title="${node.title}">
            ${node.title || 'Depósito / Almacén'}
          </h4>
          ${node.text ? `
            <p class="node-text text-[9px] font-medium text-slate-600 dark:text-slate-300 leading-tight line-clamp-2 max-w-[110px] mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else if (shapeCfg.id === 'document' || shapeCfg.id === 'multidocument') {
      // 8. Documentos: Centrado vertical con margen inferior para la onda SVG
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col justify-center px-6 pt-2 pb-6 select-none">
          <div class="flex items-center gap-2 mb-1">
            <div class="size-6 rounded-md flex items-center justify-center shrink-0 shadow-xs" style="background-color: ${colorCfg.hex}22; color: ${colorCfg.hex};">
              <span class="material-symbols-outlined text-[14px]">${icon}</span>
            </div>
            <h4 class="node-title text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 flex-1 leading-snug" title="${node.title}">
              ${node.title || 'Documento'}
            </h4>
            <button type="button" class="btn-node-edit size-6 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer shrink-0" title="Editar bloque">
              <span class="material-symbols-outlined text-[14px]">edit</span>
            </button>
          </div>
          ${node.text ? `
            <p class="node-text text-[10.5px] font-medium text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5">
              ${node.text}
            </p>
          ` : ''}
          ${subFlujoBadge}
        </div>
      `;
    } else {
      // 9. Formas Rectangulares, Paralelogramos y Otras: Centrado vertical dentro de su margen
      bodyHtml = `
        <div class="relative z-10 w-full h-full flex flex-col justify-center ${paddingClass} select-none">
          <div class="flex items-center gap-2 mb-1">
            <div class="size-6 rounded-md flex items-center justify-center shrink-0 shadow-xs" style="background-color: ${colorCfg.hex}22; color: ${colorCfg.hex};">
              <span class="material-symbols-outlined text-[14px]">${icon}</span>
            </div>
            <h4 class="node-title text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white line-clamp-2 flex-1 leading-snug" title="${node.title}">
              ${node.title || 'Sin Título'}
            </h4>
            <button type="button" class="btn-node-edit size-6 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer shrink-0" title="Editar bloque">
              <span class="material-symbols-outlined text-[14px]">edit</span>
            </button>
          </div>

          ${node.text ? `
            <p class="node-text text-[10.5px] font-medium text-slate-600 dark:text-slate-300 leading-snug line-clamp-2 mt-0.5">
              ${node.text}
            </p>
          ` : ''}

          ${subFlujoBadge}
        </div>
      `;
    }

    el.innerHTML = `
      ${svgBackground}

      <!-- Puerto Entrada Izquierdo -->
      <div class="flow-port flow-port-in absolute size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:scale-125 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" style="left: ${pLeft.x}px; top: ${pLeft.y}px; transform: translate(-50%, -50%);" data-node-id="${node.id}" data-port-type="in" data-port="left" title="Conectar aquí">
        <div class="size-1.5 rounded-full bg-slate-400 dark:bg-slate-500 pointer-events-none"></div>
      </div>

      <!-- Puerto Salida Derecho -->
      <div class="flow-port flow-port-out absolute size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-blue-500 hover:scale-125 hover:bg-blue-500 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" style="left: ${pRight.x}px; top: ${pRight.y}px; transform: translate(-50%, -50%);" data-node-id="${node.id}" data-port-type="out" data-port="right" title="Arrastrar para conectar">
        <div class="size-1.5 rounded-full bg-blue-500 pointer-events-none"></div>
      </div>

      <!-- Puerto Salida Inferior (si la forma lo soporta) -->
      ${pBottom ? `
        <div class="flow-port flow-port-out absolute size-5 rounded-full bg-white dark:bg-slate-800 border-2 border-emerald-500 hover:scale-125 hover:bg-emerald-500 transition-all flex items-center justify-center cursor-crosshair z-20 shadow-sm" style="left: ${pBottom.x}px; top: ${pBottom.y}px; transform: translate(-50%, -50%);" data-node-id="${node.id}" data-port-type="out" data-port="bottom" title="Bifurcación / Salida">
          <div class="size-1.5 rounded-full bg-emerald-500 pointer-events-none"></div>
        </div>
      ` : ''}

      <!-- Cuerpo del Nodo según Forma -->
      ${bodyHtml}
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

    // Interacción Drag del Nodo & Conexión al hacer clic en modo interactivo
    el.addEventListener('pointerdown', (e) => {
      // Si estamos en modo interactivo de conexión y se hace clic en otro nodo -> CONECTAR
      if (this.isInteractiveConnecting) {
        e.stopPropagation();
        if (this.connectingFromNodeId && this.connectingFromNodeId !== node.id) {
          const fromNode = state.getNode(this.connectingFromNodeId);
          let label = '';
          if (fromNode && fromNode.type === 'decision') {
            label = this.connectingFromPort === 'right' ? 'Sí' : 'No';
          }
          state.addEdge(this.connectingFromNodeId, node.id, label, this.connectingFromPort, 'left');
          this.cancelConnectingMode();
          this.renderEdges();
          window.dispatchEvent(new CustomEvent('node-connected-toast', { detail: { title: node.title } }));
        }
        return;
      }

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
          this.preDragSnapshot = JSON.stringify(state.data);
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

    // Soltar arrastre de cable en cualquier parte del cuerpo del nodo para conectar
    el.addEventListener('pointerup', (e) => {
      if (this.isConnecting && this.portDragged && this.connectingFromNodeId && this.connectingFromNodeId !== node.id) {
        e.stopPropagation();
        const fromNode = state.getNode(this.connectingFromNodeId);
        let label = '';
        if (fromNode && fromNode.type === 'decision') {
          label = this.connectingFromPort === 'right' ? 'Sí' : 'No';
        }
        state.addEdge(this.connectingFromNodeId, node.id, label, this.connectingFromPort, 'left');
        this.isConnecting = false;
        if (this.tempEdgePath) {
          this.tempEdgePath.setAttribute('d', '');
          this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
        }
        this.renderEdges();
        window.dispatchEvent(new CustomEvent('node-connected-toast', { detail: { title: node.title } }));
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
          const fromNode = state.getNode(this.connectingFromNodeId);
          let label = '';
          if (fromNode && fromNode.type === 'decision') {
            label = this.connectingFromPort === 'right' ? 'Sí' : 'No';
          }
          const toPort = port.dataset.port || (port.classList.contains('flow-port-in') ? 'left' : 'right');
          state.addEdge(this.connectingFromNodeId, node.id, label, this.connectingFromPort, toPort);
          this.isConnecting = false;
          if (this.tempEdgePath) {
            this.tempEdgePath.setAttribute('d', '');
            this.tempEdgePath.setAttribute('class', 'opacity-0 pointer-events-none');
          }
          this.renderEdges();
          window.dispatchEvent(new CustomEvent('node-connected-toast', { detail: { title: node.title } }));
        }
      });

      // Clic directo sobre el circulito -> Abrir Quick-Picker o Conectar si está activo el modo interactivo
      port.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (this.isInteractiveConnecting) {
          if (this.connectingFromNodeId && this.connectingFromNodeId !== node.id) {
            const fromNode = state.getNode(this.connectingFromNodeId);
            let label = '';
            if (fromNode && fromNode.type === 'decision') {
              label = this.connectingFromPort === 'right' ? 'Sí' : 'No';
            }
            const toPort = port.dataset.port || (port.classList.contains('flow-port-in') ? 'left' : 'right');
            state.addEdge(this.connectingFromNodeId, node.id, label, this.connectingFromPort, toPort);
            this.cancelConnectingMode();
            this.renderEdges();
            window.dispatchEvent(new CustomEvent('node-connected-toast', { detail: { title: node.title } }));
          }
          return;
        }

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
    const cfg = getShapeConfig(type);
    if (cfg && cfg.icon) return cfg.icon;
    switch (type) {
      case 'action': return 'crop_landscape';
      case 'decision': return 'diamond';
      case 'warning': return 'warning';
      case 'note': return 'comment';
      default: return 'crop_landscape';
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
    this.deselectEdge();
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

  selectEdge(edgeId) {
    this.selectedEdgeId = edgeId;
    this.deselectAll();
    this.renderEdges();
  }

  deselectEdge() {
    if (this.selectedEdgeId) {
      this.selectedEdgeId = null;
      this.renderEdges();
    }
  }

  getSelectedEdgeId() {
    return this.selectedEdgeId;
  }

  // Renderizado de Aristas / Conexiones Bezier con Flechas
  renderEdges() {
    let group = this.svg.querySelector('#canvas-edges-group');
    if (!group) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.id = 'canvas-edges-group';
      const mainGroup = this.svg.querySelector('#canvas-transform-group');
      if (mainGroup) mainGroup.appendChild(group);
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
      const isSelected = this.selectedEdgeId === edge.id;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `edge-item group cursor-pointer ${isSelected ? 'edge-selected' : ''}`);
      g.dataset.edgeId = edge.id;

      // Path invisible ancho para facilitar clic / hover táctil y de ratón
      const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitPath.setAttribute('d', pathData);
      hitPath.setAttribute('class', 'stroke-transparent fill-none stroke-[22] cursor-pointer');

      // Path visible
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      
      let strokeClass = 'stroke-blue-500 dark:stroke-blue-400';
      let markerId = 'url(#arrowhead)';
      if (isSelected) {
        strokeClass = 'stroke-rose-500 dark:stroke-rose-400';
        markerId = 'url(#arrowhead-rose)';
      } else if (fromNode.type === 'decision') {
        strokeClass = edge.fromPort === 'bottom' ? 'stroke-amber-500 dark:stroke-amber-400' : 'stroke-emerald-500 dark:stroke-emerald-400';
        markerId = edge.fromPort === 'bottom' ? 'url(#arrowhead-amber)' : 'url(#arrowhead-emerald)';
      } else if (fromNode.type === 'warning') {
        strokeClass = 'stroke-amber-500 dark:stroke-amber-400';
        markerId = 'url(#arrowhead-amber)';
      }

      const strokeWidth = isSelected ? 'stroke-[3.5]' : 'stroke-[2.5]';
      path.setAttribute('class', `${strokeClass} fill-none ${strokeWidth} transition-all group-hover:stroke-[3.5] group-hover:stroke-rose-500`);
      path.setAttribute('marker-end', markerId);
      if (isSelected) {
        path.style.filter = 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.75))';
      }

      // Clic en la arista: selecciona la arista (o si ya estaba seleccionada, la desvincula)
      g.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedEdgeId === edge.id) {
          state.removeEdge(edge.id);
          this.deselectEdge();
          this.renderEdges();
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Conexión desvinculada' } }));
        } else {
          this.selectEdge(edge.id);
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Conexión seleccionada (Supr o clic para desvincular)' } }));
        }
      });

      g.appendChild(hitPath);
      g.appendChild(path);
      linesGroup.appendChild(g);

      // Calcular punto medio
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

      const hasLabel = edge.label && String(edge.label).trim();

      // Si tiene etiqueta, renderizarla en primer plano
      if (hasLabel) {
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        labelGroup.setAttribute('class', 'edge-label-group cursor-pointer');

        const labelText = String(edge.label).trim();
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

        // Click en la etiqueta para abrir modal de edición
        labelGroup.addEventListener('click', (e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('open-edit-edge-modal', { detail: { edgeId: edge.id, label: edge.label || '' } }));
        });

        labelsGroup.appendChild(labelGroup);
      }

      // Botón / Badge de acciones (visible al seleccionar o al pasar el cursor)
      const actionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      actionGroup.setAttribute('class', `edge-action-group cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 hover:opacity-100 transition-opacity'}`);
      actionGroup.style.pointerEvents = 'all';

      // Posición de los botones:
      const btnY = hasLabel ? (isSelected ? midY - 26 : midY) : midY;
      const btnX = hasLabel && !isSelected ? midX + (Math.max(String(edge.label).trim().length * 8.5 + 26, 60) / 2) + 16 : midX;

      if (isSelected) {
        // Dos píldoras visibles al seleccionar: [ ✎ Texto ] y [ ✕ Desvincular ]
        const editBtnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        editBtnGroup.setAttribute('class', 'cursor-pointer hover:scale-105 transition-transform');
        const editX = midX - 52;
        const editW = 86;
        const editH = 24;

        const editBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        editBg.setAttribute('x', editX - editW / 2);
        editBg.setAttribute('y', btnY - editH / 2);
        editBg.setAttribute('width', editW);
        editBg.setAttribute('height', editH);
        editBg.setAttribute('rx', 12);
        editBg.setAttribute('fill', '#3b82f6');
        editBg.setAttribute('class', 'shadow-lg');

        const editText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        editText.setAttribute('x', editX);
        editText.setAttribute('y', btnY + 4);
        editText.setAttribute('text-anchor', 'middle');
        editText.setAttribute('fill', '#ffffff');
        editText.setAttribute('font-size', '11px');
        editText.setAttribute('font-weight', 'bold');
        editText.textContent = hasLabel ? '✎ Editar' : '+ Texto';

        editBtnGroup.appendChild(editBg);
        editBtnGroup.appendChild(editText);
        editBtnGroup.addEventListener('click', (e) => {
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('open-edit-edge-modal', { detail: { edgeId: edge.id, label: edge.label || '' } }));
        });

        const delBtnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delBtnGroup.setAttribute('class', 'cursor-pointer hover:scale-105 transition-transform');
        const delX = midX + 50;
        const delW = 104;
        const delH = 24;

        const delBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        delBg.setAttribute('x', delX - delW / 2);
        delBg.setAttribute('y', btnY - delH / 2);
        delBg.setAttribute('width', delW);
        delBg.setAttribute('height', delH);
        delBg.setAttribute('rx', 12);
        delBg.setAttribute('fill', '#f43f5e');
        delBg.setAttribute('class', 'shadow-lg');

        const delText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        delText.setAttribute('x', delX);
        delText.setAttribute('y', btnY + 4);
        delText.setAttribute('text-anchor', 'middle');
        delText.setAttribute('fill', '#ffffff');
        delText.setAttribute('font-size', '11px');
        delText.setAttribute('font-weight', 'bold');
        delText.textContent = '✕ Desvincular';

        delBtnGroup.appendChild(delBg);
        delBtnGroup.appendChild(delText);
        delBtnGroup.addEventListener('click', (e) => {
          e.stopPropagation();
          state.removeEdge(edge.id);
          this.deselectEdge();
          this.renderEdges();
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Conexión desvinculada' } }));
        });

        actionGroup.appendChild(editBtnGroup);
        actionGroup.appendChild(delBtnGroup);
      } else {
        // Círculo flotante sutil que aparece al hacer hover sobre la línea: "✕"
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', btnX);
        circle.setAttribute('cy', btnY);
        circle.setAttribute('r', '11');
        circle.setAttribute('fill', '#f43f5e');
        circle.setAttribute('class', 'shadow-md hover:scale-110 transition-transform');

        const cross = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        cross.setAttribute('x', btnX);
        cross.setAttribute('y', btnY + 3.5);
        cross.setAttribute('text-anchor', 'middle');
        cross.setAttribute('fill', '#ffffff');
        cross.setAttribute('font-size', '12px');
        cross.setAttribute('font-weight', '900');
        cross.textContent = '✕';

        actionGroup.appendChild(circle);
        actionGroup.appendChild(cross);

        actionGroup.addEventListener('click', (e) => {
          e.stopPropagation();
          state.removeEdge(edge.id);
          this.deselectEdge();
          this.renderEdges();
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Conexión desvinculada' } }));
        });
      }

      labelsGroup.appendChild(actionGroup);
    });
  }

  getPortCoordinates(node, port) {
    const shapeKey = node.shape || (node.type === 'decision' ? 'decision' : node.type === 'note' ? 'comment' : node.type === 'warning' ? 'preparation' : (node.type || 'process'));
    const shapeCfg = getShapeConfig(shapeKey);

    const el = this.nodesContainer ? this.nodesContainer.querySelector(`.flow-node[data-node-id="${node.id}"]`) : null;
    const w = (el && el.offsetWidth) ? el.offsetWidth : (shapeCfg.width || 240);
    const h = (el && el.offsetHeight) ? el.offsetHeight : (shapeCfg.height || 100);

    const portFn = (shapeCfg.ports && shapeCfg.ports[port]) ? shapeCfg.ports[port] : (shapeCfg.ports.right || ((cw, ch) => ({ x: cw, y: ch / 2 })));
    const relPos = portFn(w, h);

    return {
      x: node.x + relPos.x,
      y: node.y + relPos.y
    };
  }

  calculateBezier(x1, y1, x2, y2, fromPort, toPort) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const offset = Math.max(dx * 0.5, 40);

    let cx1 = x1 + offset;
    let cy1 = y1;
    let cx2 = x2 - offset;
    let cy2 = y2;

    if (fromPort === 'left') {
      cx1 = x1 - offset;
      cy1 = y1;
    } else if (fromPort === 'bottom') {
      cx1 = x1;
      cy1 = y1 + Math.max(dy * 0.5, 40);
    } else if (fromPort === 'top') {
      cx1 = x1;
      cy1 = y1 - Math.max(dy * 0.5, 40);
    }

    if (toPort === 'right') {
      cx2 = x2 + offset;
      cy2 = y2;
    } else if (toPort === 'top') {
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
    const width = (rect && rect.width > 50) ? rect.width : (window.innerWidth || 360);
    const height = (rect && rect.height > 50) ? rect.height : ((window.innerHeight || 640) - 60);

    const diagramWidth = Math.max(maxX - minX + 160, 100);
    const diagramHeight = Math.max(maxY - minY + 160, 100);

    const zoomX = width / diagramWidth;
    const zoomY = height / diagramHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.35), 1.2);

    const panX = (width - (maxX + minX) * newZoom) / 2;
    const panY = (height - (maxY + minY) * newZoom) / 2;

    state.setPan(panX, panY);
    state.setZoom(newZoom);
    this.applyTransform();
  }
}
