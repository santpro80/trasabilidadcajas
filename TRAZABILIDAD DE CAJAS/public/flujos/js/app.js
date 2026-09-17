// app.js - Bootstrap del Módulo Flujos Sandbox

import { state } from './state.js';
import { FlowchartRenderer } from './renderer.js';
import { FlowchartUI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
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
  setTimeout(() => {
    renderer.fitView();
  }, 100);

  // Atajos de teclado
  window.addEventListener('keydown', (e) => {
    // Tecla Supr o Backspace para eliminar nodo seleccionado (si no estamos escribiendo en un input)
    if ((e.key === 'Delete' || e.key === 'Backspace') && renderer.selectedNodeId) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      e.preventDefault();
      state.removeNode(renderer.selectedNodeId);
      renderer.deselectNode();
      renderer.render();
      ui.showToast('Nodo eliminado');
    }

    // Escape para deseleccionar
    if (e.key === 'Escape') {
      renderer.deselectNode();
      ui.closeEditModal();
      ui.hideContextMenus();
    }

    // Ctrl+S para guardar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      state.saveToStorage();
      ui.showToast('Diagrama guardado');
    }
  });

  // Reajustar vista si la ventana cambia de tamaño
  window.addEventListener('resize', () => {
    renderer.applyTransform();
  });
});
