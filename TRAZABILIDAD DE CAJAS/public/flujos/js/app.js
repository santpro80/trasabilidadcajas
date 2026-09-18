// app.js - Bootstrap del Módulo Flujos Sandbox

import { state } from './state.js';
import { FlowchartRenderer } from './renderer.js';
import { FlowchartUI } from './ui.js';

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
  requestAnimationFrame(() => {
    renderer.fitView();
    setTimeout(() => {
      renderer.fitView();
    }, 200);
  });

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    // Tecla Supr o Backspace para eliminar todos los nodos seleccionados
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      const selectedIds = renderer.getSelectedNodeIds();
      if (selectedIds.length > 0) {
        e.preventDefault();
        selectedIds.forEach(id => state.removeNode(id));
        renderer.deselectAll();
        renderer.render();
        ui.showToast(selectedIds.length > 1 ? `${selectedIds.length} bloques eliminados` : 'Bloque eliminado');
      }
    }

    // V para modo Selección
    if (e.key.toLowerCase() === 'v' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      renderer.setInteractionMode('select');
      ui.showToast('Modo Selección');
    }

    // H para modo Mano (Pan)
    if (e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      renderer.setInteractionMode('pan');
      ui.showToast('Modo Mano');
    }

    // Escape para deseleccionar y cerrar menús
    if (e.key === 'Escape') {
      renderer.deselectAll();
      ui.closeEditModal();
      ui.hideContextMenus();
      ui.hidePortQuickPicker();
    }

    // Ctrl+S para guardar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      state.saveToStorage();
      ui.showToast('Diagrama guardado');
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
