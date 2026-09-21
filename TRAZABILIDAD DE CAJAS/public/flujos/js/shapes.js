// shapes.js - Catálogo de Formas Geométricas Estándar de Diagramas de Flujo (ANSI / ISO 5807)

export const FLOW_SHAPES = {
  process: {
    id: 'process',
    name: 'Proceso',
    category: 'Principales',
    icon: 'crop_landscape',
    defaultTitle: 'Nuevo Proceso',
    color: '#3b82f6', // Azul
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" ry="12" class="shape-fill" stroke-width="2.5" />
    `
  },

  decision: {
    id: 'decision',
    name: 'Decisión',
    category: 'Principales',
    icon: 'diamond',
    defaultTitle: '¿Condición?',
    color: '#10b981', // Verde Esmeralda
    width: 240,
    height: 130,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <polygon points="${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}" class="shape-fill" stroke-width="2.5" />
    `
  },

  terminal: {
    id: 'terminal',
    name: 'Terminal (Inicio/Fin)',
    category: 'Principales',
    icon: 'stadium',
    defaultTitle: 'Inicio / Fin',
    color: '#6366f1', // Índigo
    width: 220,
    height: 90,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${(h - 4) / 2}" ry="${(h - 4) / 2}" class="shape-fill" stroke-width="2.5" />
    `
  },

  data: {
    id: 'data',
    name: 'Datos (Entrada/Salida)',
    category: 'Datos',
    icon: 'input',
    defaultTitle: 'Entrada / Salida',
    color: '#06b6d4', // Cyan
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 14, y: h / 2 }),
      right: (w, h) => ({ x: w - 14, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => {
      const skew = 25;
      return `
        <polygon points="${skew},2 ${w - 2},2 ${w - skew},${h - 2} 2,${h - 2}" class="shape-fill" stroke-width="2.5" />
      `;
    }
  },

  document: {
    id: 'document',
    name: 'Documento',
    category: 'Datos',
    icon: 'article',
    defaultTitle: 'Documento / Reporte',
    color: '#f59e0b', // Ámbar
    width: 230,
    height: 110,
    ports: {
      left: (w, h) => ({ x: 0, y: (h - 15) / 2 }),
      right: (w, h) => ({ x: w, y: (h - 15) / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h - 8 })
    },
    renderSvg: (w, h) => `
      <path d="M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 18} C ${w * 0.75} ${h - 32}, ${w * 0.55} ${h + 2}, ${w * 0.28} ${h - 14} C ${w * 0.15} ${h - 24}, 8 ${h - 6}, 2 ${h - 14} Z" class="shape-fill" stroke-width="2.5" />
    `
  },

  multidocument: {
    id: 'multidocument',
    name: 'Múltiples Documentos',
    category: 'Datos',
    icon: 'file_copy',
    defaultTitle: 'Lote de Documentos',
    color: '#f97316', // Naranja
    width: 240,
    height: 115,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <g>
        <!-- Hoja trasera 2 -->
        <path d="M 16 2 L ${w - 2} 2 L ${w - 2} ${h - 32} C ${w * 0.75} ${h - 46}, ${w * 0.55} ${h - 14}, ${w * 0.3} ${h - 28} C ${w * 0.18} ${h - 38}, 20 ${h - 20}, 16 ${h - 26} Z" fill="none" class="shape-stroke opacity-50" stroke-width="2" />
        <!-- Hoja trasera 1 -->
        <path d="M 8 7 L ${w - 10} 7 L ${w - 10} ${h - 27} C ${w * 0.72} ${h - 41}, ${w * 0.52} ${h - 9}, ${w * 0.27} ${h - 23} C ${w * 0.15} ${h - 33}, 12 ${h - 15}, 8 ${h - 21} Z" fill="none" class="shape-stroke opacity-75" stroke-width="2" />
        <!-- Hoja principal -->
        <path d="M 2 12 L ${w - 18} 12 L ${w - 18} ${h - 20} C ${w * 0.65} ${h - 34}, ${w * 0.45} ${h - 2}, ${w * 0.22} ${h - 16} C ${w * 0.12} ${h - 26}, 6 ${h - 8}, 2 ${h - 16} Z" class="shape-fill" stroke-width="2.5" />
      </g>
    `
  },

  database: {
    id: 'database',
    name: 'Base de Datos',
    category: 'Datos',
    icon: 'database',
    defaultTitle: 'Base de Datos',
    color: '#a855f7', // Púrpura
    width: 210,
    height: 120,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <g>
        <!-- Cuerpo del cilindro -->
        <path d="M 3 18 L 3 ${h - 18} A ${w / 2 - 3} 14 0 0 0 ${w - 3} ${h - 18} L ${w - 3} 18 Z" class="shape-fill" stroke-width="2.5" />
        <!-- Tapa superior del cilindro -->
        <ellipse cx="${w / 2}" cy="18" rx="${w / 2 - 3}" ry="14" class="shape-fill" stroke-width="2.5" />
      </g>
    `
  },

  subprocess: {
    id: 'subprocess',
    name: 'Proceso Predefinido',
    category: 'Principales',
    icon: 'account_tree',
    defaultTitle: 'Sub-proceso',
    color: '#2563eb', // Azul Cobalto
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <g>
        <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="8" ry="8" class="shape-fill" stroke-width="2.5" />
        <line x1="22" y1="2" x2="22" y2="${h - 2}" class="shape-stroke" stroke-width="2.5" />
        <line x1="${w - 22}" y1="2" x2="${w - 22}" y2="${h - 2}" class="shape-stroke" stroke-width="2.5" />
      </g>
    `
  },

  manual_op: {
    id: 'manual_op',
    name: 'Operación Manual',
    category: 'Especializados',
    icon: 'front_hand',
    defaultTitle: 'Operación Manual',
    color: '#ea580c', // Naranja Óxido
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 15, y: h / 2 }),
      right: (w, h) => ({ x: w - 15, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => {
      const inset = 30;
      return `
        <polygon points="2,2 ${w - 2},2 ${w - inset},${h - 2} ${inset},${h - 2}" class="shape-fill" stroke-width="2.5" />
      `;
    }
  },

  preparation: {
    id: 'preparation',
    name: 'Preparación',
    category: 'Especializados',
    icon: 'settings',
    defaultTitle: 'Preparación / Setup',
    color: '#84cc16', // Lima
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => {
      const point = 28;
      return `
        <polygon points="${point},2 ${w - point},2 ${w - 2},${h / 2} ${w - point},${h - 2} ${point},${h - 2} 2,${h / 2}" class="shape-fill" stroke-width="2.5" />
      `;
    }
  },

  delay: {
    id: 'delay',
    name: 'Retraso / Espera',
    category: 'Especializados',
    icon: 'hourglass_empty',
    defaultTitle: 'Tiempo de Espera',
    color: '#eab308', // Amarillo Cálido
    width: 220,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => {
      const r = (h - 4) / 2;
      return `
        <path d="M 2 2 L ${w - r - 2} 2 A ${r} ${r} 0 0 1 ${w - r - 2} ${h - 2} L 2 ${h - 2} Z" class="shape-fill" stroke-width="2.5" />
      `;
    }
  },

  storage: {
    id: 'storage',
    name: 'Almacenamiento',
    category: 'Especializados',
    icon: 'archive',
    defaultTitle: 'Depósito / Almacén',
    color: '#f43f5e', // Rosa / Coral
    width: 220,
    height: 120,
    ports: {
      left: (w, h) => ({ x: 6, y: 8 }),
      right: (w, h) => ({ x: w - 6, y: 8 }),
      top: (w, h) => ({ x: w / 2, y: 2 }),
      bottom: (w, h) => ({ x: w / 2, y: h - 4 })
    },
    renderSvg: (w, h) => `
      <polygon points="4,4 ${w - 4},4 ${w / 2},${h - 4}" class="shape-fill" stroke-width="2.5" />
    `
  },

  display: {
    id: 'display',
    name: 'Visualización / Display',
    category: 'Especializados',
    icon: 'monitor',
    defaultTitle: 'Pantalla / Aviso',
    color: '#0284c7', // Azul Eléctrico
    width: 240,
    height: 100,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => {
      const point = 32;
      return `
        <path d="M ${point} 2 L ${w - 20} 2 C ${w} 2, ${w} ${h}, ${w - 20} ${h - 2} L ${point} ${h - 2} L 2 ${h / 2} Z" class="shape-fill" stroke-width="2.5" />
      `;
    }
  },

  comment: {
    id: 'comment',
    name: 'Comentario / Nota',
    category: 'Anotaciones',
    icon: 'comment',
    defaultTitle: 'Nota / Comentario',
    color: '#64748b', // Gris Pizarra
    width: 230,
    height: 90,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <g>
        <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" ry="6" class="shape-fill opacity-30" stroke-width="0" />
        <path d="M 22 2 L 2 2 L 2 ${h - 2} L 22 ${h - 2}" fill="none" class="shape-stroke" stroke-width="2.5" stroke-dasharray="4 3" />
      </g>
    `
  },

  circle: {
    id: 'circle',
    name: 'Conector / Operación',
    category: 'Principales',
    icon: 'radio_button_unchecked',
    defaultTitle: 'Conector',
    color: '#14b8a6', // Menta / Teal
    width: 130,
    height: 130,
    ports: {
      left: (w, h) => ({ x: 0, y: h / 2 }),
      right: (w, h) => ({ x: w, y: h / 2 }),
      top: (w, h) => ({ x: w / 2, y: 0 }),
      bottom: (w, h) => ({ x: w / 2, y: h })
    },
    renderSvg: (w, h) => `
      <circle cx="${w / 2}" cy="${h / 2}" r="${w / 2 - 3}" class="shape-fill" stroke-width="2.5" />
    `
  }
};

// Paleta de colores predefinidos disponibles para personalizar cualquier forma
export const SHAPE_COLORS = [
  { id: 'blue', name: 'Azul', hex: '#3b82f6', bgLight: '#eff6ff', bgDark: '#0e1d38' },
  { id: 'emerald', name: 'Verde', hex: '#10b981', bgLight: '#ecfdf5', bgDark: '#07241b' },
  { id: 'amber', name: 'Ámbar', hex: '#f59e0b', bgLight: '#fffbeb', bgDark: '#291b06' },
  { id: 'purple', name: 'Púrpura', hex: '#a855f7', bgLight: '#faf5ff', bgDark: '#240e38' },
  { id: 'indigo', name: 'Índigo', hex: '#6366f1', bgLight: '#eef2ff', bgDark: '#141738' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', bgLight: '#ecfeff', bgDark: '#092429' },
  { id: 'orange', name: 'Naranja', hex: '#f97316', bgLight: '#fff7ed', bgDark: '#2b1307' },
  { id: 'rose', name: 'Rosa / Rojo', hex: '#f43f5e', bgLight: '#fff1f2', bgDark: '#2e0a13' },
  { id: 'teal', name: 'Teal / Menta', hex: '#14b8a6', bgLight: '#f0fdfa', bgDark: '#072623' },
  { id: 'slate', name: 'Pizarra / Gris', hex: '#64748b', bgLight: '#f8fafc', bgDark: '#131b26' }
];

// Obtener configuración de forma (con fallback para compatibilidad con diagramas previos)
export function getShapeConfig(shapeIdOrType) {
  if (FLOW_SHAPES[shapeIdOrType]) {
    return FLOW_SHAPES[shapeIdOrType];
  }
  // Fallbacks de migración para los antiguos `type`:
  switch (shapeIdOrType) {
    case 'decision':
      return FLOW_SHAPES.decision;
    case 'warning':
      return FLOW_SHAPES.preparation;
    case 'note':
      return FLOW_SHAPES.comment;
    case 'action':
    default:
      return FLOW_SHAPES.process;
  }
}

// Obtener datos de color dado un hex o ID
export function getColorConfig(colorHexOrId) {
  if (!colorHexOrId) return SHAPE_COLORS[0];
  const found = SHAPE_COLORS.find(c => c.id === colorHexOrId || c.hex.toLowerCase() === colorHexOrId.toLowerCase());
  if (found) return found;
  return {
    id: 'custom',
    name: 'Personalizado',
    hex: colorHexOrId,
    bgLight: '#ffffff',
    bgDark: '#131b26'
  };
}
