// app.js - Bootstrap del Módulo Flujos Sandbox

import { state } from './state.js?v=2.2';
import { FlowchartRenderer } from './renderer.js?v=2.2';
import { FlowchartUI } from './ui.js?v=2.2';

function initFlujos() {
  const container = document.getElementById('canvas-container');
  const svg = document.getElementById('canvas-svg');
  const nodesContainer = document.getElementById('canvas-nodes-layer');

  if (!container || !svg || !nodesContainer) {
    console.error('Elementos del canvas no encontrados.');
    return;
  }

  // Cargar usuario si está disponible
  const userName = localStorage.getItem('userName');
  const userSpan = document.getElementById('user-display-name');
  if (userSpan && userName) {
    userSpan.textContent = userName;
  }

  // Inicializar Motor y UI
  const renderer = new FlowchartRenderer(container, svg, nodesContainer);
  const ui = new FlowchartUI(renderer);

  // Render inicial
  renderer.render();

  // Solo centrar automáticamente con fitView si es la primera vez que se carga en este dispositivo
  const localViewports = state.loadLocalViewports ? state.loadLocalViewports() : {};
  const currentWsId = state.getCurrentWorkspace().id;
  if (!localViewports[currentWsId]) {
    requestAnimationFrame(() => {
      renderer.fitView();
    });
  }

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    // Tecla Supr o Backspace para eliminar todos los nodos seleccionados o la arista seleccionada
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      
      const selectedIds = renderer.getSelectedNodeIds();
      if (selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach(id => state.removeNode(id));
        renderer.deselectAll();
        renderer.render();
        ui.showToast(selectedIds.length > 1 ? `${selectedIds.length} bloques eliminados` : 'Bloque eliminado');
        return;
      }

      const selectedEdgeId = renderer.getSelectedEdgeId();
      if (selectedEdgeId) {
        e.preventDefault();
        state.removeEdge(selectedEdgeId);
        renderer.deselectEdge();
        renderer.renderEdges();
        ui.showToast('Conexión desvinculada');
        return;
      }
    }

    // Ctrl+C para Copiar nodo(s) seleccionado(s)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !e.shiftKey) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.isContentEditable) return;
      
      const selectedIds = renderer.getSelectedNodeIds();
      if (selectedIds.length > 0) {
        e.preventDefault();
        const count = ui.copyNodes(selectedIds);
        if (count > 0) {
          ui.showToast(count > 1 ? `${count} bloques copiados (Ctrl+C)` : 'Bloque copiado (Ctrl+C)');
        }
      } else {
        e.preventDefault();
        ui.showToast('Hacé clic en un bloque para seleccionarlo antes de copiar');
      }
      return;
    }

    // Ctrl+V para Pegar nodo(s) copiado(s)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !e.shiftKey) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.isContentEditable) return;

      e.preventDefault();
      const pasted = ui.pasteNodes();
      if (pasted && pasted.length > 0) {
        ui.showToast(pasted.length > 1 ? `${pasted.length} bloques pegados (Ctrl+V)` : 'Bloque pegado (Ctrl+V)');
      }
      return;
    }

    // Ctrl+D para Duplicar nodo(s) de inmediato
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !e.shiftKey) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.activeElement?.isContentEditable) return;

      e.preventDefault();
      const selectedIds = renderer.getSelectedNodeIds();
      if (selectedIds.length > 0) {
        const dups = ui.duplicateNodes(selectedIds);
        if (dups && dups.length > 0) {
          ui.showToast(dups.length > 1 ? `${dups.length} bloques duplicados (Ctrl+D)` : 'Bloque duplicado (Ctrl+D)');
        }
      } else {
        ui.showToast('Hacé clic en un bloque para seleccionarlo antes de duplicar');
      }
      return;
    }

    // Ctrl+Z para Deshacer
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      if (state.undo()) {
        renderer.render();
        ui.showToast('Acción deshecha (Ctrl+Z)');
      }
      return;
    }

    // Ctrl+Y o Ctrl+Shift+Z para Rehacer
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      if (state.redo()) {
        renderer.render();
        ui.showToast('Acción rehecha (Ctrl+Y)');
      }
      return;
    }

    // V para modo Selección (SOLO cuando NO se presiona Ctrl, Meta ni Alt)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'v' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      renderer.setInteractionMode('select');
      ui.showToast('Modo Selección');
      return;
    }

    // H para modo Mano (Pan) (SOLO cuando NO se presiona Ctrl, Meta ni Alt)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      renderer.setInteractionMode('pan');
      ui.showToast('Modo Mano');
      return;
    }

    // Escape para deseleccionar, cerrar menús y volver de nivel en sub-flujos
    if (e.key === 'Escape') {
      const isEditModalOpen = !document.getElementById('edit-node-modal')?.classList.contains('hidden');
      const isEdgeModalOpen = !document.getElementById('edit-edge-modal')?.classList.contains('hidden');
      const isMobileAddOpen = !document.getElementById('modal-mobile-add-node')?.classList.contains('hidden');
      const isPortPickerOpen = !document.getElementById('port-quick-picker')?.classList.contains('hidden');
      const isConnecting = renderer.isConnecting || renderer.isInteractiveConnecting;
      const hasSelection = (renderer.selectedNodeIds && renderer.selectedNodeIds.size > 0) || !!renderer.selectedEdgeId;

      let somethingClosed = false;

      if (isEditModalOpen) { ui.closeEditModal(); somethingClosed = true; }
      if (isEdgeModalOpen) { ui.closeEditEdgeModal(); somethingClosed = true; }
      if (isMobileAddOpen) { ui.closeMobileAddModal(); somethingClosed = true; }
      if (isPortPickerOpen) { ui.hidePortQuickPicker(); somethingClosed = true; }
      if (isConnecting) { renderer.cancelConnectingMode(); somethingClosed = true; }
      if (hasSelection) { renderer.deselectAll(); renderer.deselectEdge(); somethingClosed = true; }

      ui.hideContextMenus();

      // Si no había nada abierto ni seleccionado, navegar hacia atrás en la jerarquía
      if (!somethingClosed) {
        const wentBack = ui.navigateBackLevel();
        if (!wentBack) {
          ui.showToast('Estás en el flujo principal');
        }
      }
    }

    // Ctrl+S para guardar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      state.isDirty = true;
      state.saveToStorage();
      state.saveToCloud(true);
      ui.showToast('Diagrama guardado y sincronizado');
    }

    // Ctrl+P para Imprimir / PDF
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      ui.handlePrint();
    }
  });

  // Reajustar vista si la ventana cambia de tamaño
  window.addEventListener('resize', () => {
    renderer.applyTransform();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlujos);
} else {
  initFlujos();
}
