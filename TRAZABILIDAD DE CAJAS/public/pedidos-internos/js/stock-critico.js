import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { initApp } from './app.js';

// Firebase Deposito Config
const firebaseConfigDeposito = {
  apiKey: "AIzaSyDMMWGdRufoYA7I3rMKv_PvySLjs5aGfTc",
  authDomain: "deposito-a7a3d.firebaseapp.com",
  projectId: "deposito-a7a3d",
  storageBucket: "deposito-a7a3d.firebasestorage.app",
  messagingSenderId: "452553052836",
  appId: "1:452553052836:web:2105ba44c33a175b5ccc31"
};

let appDeposito;
try {
  appDeposito = initializeApp(firebaseConfigDeposito, "stock_critico_deposito");
} catch (e) {
  // Ya inicializada
}
const db = getFirestore(appDeposito);

const DEPOSITOS = [
  { id: 'no_esteril_terminado', nombre: 'No Estéril Terminado', badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { id: 'esteril_terminado', nombre: 'Estéril Terminado', badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { id: 'semi_elaborado', nombre: 'Semi Elaborado', badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { id: 'materia_prima', nombre: 'Materia Prima', badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
];

let allCriticalItems = [];
let filteredItems = [];

// Inicialización
initApp().then(() => {
  setupEventListeners();
  loadCriticalStock();
}).catch(err => {
  console.error("Error al autenticar:", err);
});

const setupEventListeners = () => {
  const searchInput = document.getElementById('input-search');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  const filtroDep = document.getElementById('filtro-deposito');
  if (filtroDep) {
    filtroDep.addEventListener('change', applyFilters);
  }

  const filtroSev = document.getElementById('filtro-severidad');
  if (filtroSev) {
    filtroSev.addEventListener('change', applyFilters);
  }

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.querySelector('span')?.classList.add('animate-spin');
      loadCriticalStock().finally(() => {
        setTimeout(() => btnRefresh.querySelector('span')?.classList.remove('animate-spin'), 600);
      });
    });
  }

  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', exportToCSV);
  }
};

const loadCriticalStock = async () => {
  const tbody = document.getElementById('tabla-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-20 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center gap-3">
            <span class="material-symbols-outlined text-4xl animate-spin text-villalba-blue">sync</span>
            <span class="text-xs font-black uppercase tracking-widest">Consultando stock en los depósitos...</span>
          </div>
        </td>
      </tr>
    `;
  }

  allCriticalItems = [];

  const promises = DEPOSITOS.map(async (dep) => {
    try {
      const ref = doc(db, 'system', `master_catalog_${dep.id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const items = snap.data().items || [];
        items.forEach(i => {
          const rawMin = i.stockMinimo !== undefined && i.stockMinimo !== null ? i.stockMinimo : (i.minimo !== undefined && i.minimo !== null ? i.minimo : null);
          if (rawMin !== null && rawMin !== undefined) {
            const min = Number(rawMin);
            if (!isNaN(min) && min > 0) {
              const stock = Number(i.stock) || 0;
              if (stock < min) {
                const ratio = min > 0 ? (stock / min) : 0;
                const esCritico = ratio < 0.5; // Menor al 50%
                const porcentaje = Math.round(ratio * 100);

                allCriticalItems.push({
                  codigo: i.codigo || 'S/C',
                  descripcion: i.descripcion || 'Sin descripción',
                  material: i.material || '',
                  depositoId: dep.id,
                  depositoNombre: dep.nombre,
                  depositoBadge: dep.badgeColor,
                  stockActual: stock,
                  stockRecomendado: min,
                  faltante: Math.max(0, min - stock),
                  ratio: ratio,
                  porcentaje: Math.max(0, porcentaje),
                  esCritico: esCritico,
                  severidad: esCritico ? 'critico' : 'alerta'
                });
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error consultando depósito ${dep.id}:`, err);
    }
  });

  await Promise.all(promises);

  // Ordenar: Críticos primero (< 50%), luego por % ascendente (el que menos stock tiene primero)
  allCriticalItems.sort((a, b) => {
    if (a.esCritico && !b.esCritico) return -1;
    if (!a.esCritico && b.esCritico) return 1;
    return a.ratio - b.ratio;
  });

  updateKPIs();
  applyFilters();
};

const updateKPIs = () => {
  const total = allCriticalItems.length;
  const criticos = allCriticalItems.filter(i => i.esCritico).length;
  const alertas = total - criticos;

  const kpiTotal = document.getElementById('kpi-total');
  const kpiCriticos = document.getElementById('kpi-criticos');
  const kpiAlertas = document.getElementById('kpi-alertas');
  const badgeTotal = document.getElementById('badge-total-criticos');

  if (kpiTotal) kpiTotal.textContent = `${total} ítems`;
  if (kpiCriticos) kpiCriticos.textContent = `${criticos} ítems`;
  if (kpiAlertas) kpiAlertas.textContent = `${alertas} ítems`;
  if (badgeTotal) badgeTotal.textContent = `${total} BAJO MÍNIMO`;
};

const applyFilters = () => {
  const searchText = (document.getElementById('input-search')?.value || '').trim().toUpperCase();
  const depositoFilter = document.getElementById('filtro-deposito')?.value || 'todos';
  const severidadFilter = document.getElementById('filtro-severidad')?.value || 'todos';

  filteredItems = allCriticalItems.filter(item => {
    if (depositoFilter !== 'todos' && item.depositoId !== depositoFilter) return false;
    if (severidadFilter !== 'todos' && item.severidad !== severidadFilter) return false;

    if (searchText) {
      const cod = (item.codigo || '').toUpperCase();
      const desc = (item.descripcion || '').toUpperCase();
      const mat = (item.material || '').toUpperCase();
      const match = cod.includes(searchText) || desc.includes(searchText) || mat.includes(searchText);
      if (!match) return false;
    }
    return true;
  });

  renderTable();
};

const renderTable = () => {
  const tbody = document.getElementById('tabla-tbody');
  const contador = document.getElementById('contador-tabla');

  if (contador) {
    contador.textContent = `${filteredItems.length} de ${allCriticalItems.length} ítems`;
  }

  if (!tbody) return;

  if (filteredItems.length === 0) {
    if (allCriticalItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-20 text-center text-emerald-500">
            <div class="flex flex-col items-center justify-center gap-3">
              <span class="material-symbols-outlined text-5xl">check_circle</span>
              <p class="text-sm font-black uppercase tracking-wider">¡Excelente! No hay productos por debajo del stock mínimo</p>
              <p class="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Todos los ítems cuentan con unidades suficientes según su recomendación.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-16 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center gap-2">
              <span class="material-symbols-outlined text-4xl opacity-50">search_off</span>
              <p class="text-xs font-black uppercase tracking-widest">No se encontraron productos con los filtros seleccionados</p>
            </div>
          </td>
        </tr>
      `;
    }
    return;
  }

  tbody.innerHTML = filteredItems.map(item => {
    // Si está menor al 50%: LÍNEA ROJA. Si no: LÍNEA AMARILLA.
    const rowClass = item.esCritico
      ? 'border-l-4 border-l-rose-500 bg-rose-500/5 dark:bg-rose-500/10 hover:bg-rose-500/15'
      : 'border-l-4 border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/15';

    const badgeEstado = item.esCritico
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <span class="material-symbols-outlined text-[13px]">error</span> CRÍTICO (${item.porcentaje}%)
        </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <span class="material-symbols-outlined text-[13px]">warning</span> ALERTA (${item.porcentaje}%)
        </span>`;

    const materialBadge = item.material
      ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 ml-1.5">${item.material}</span>`
      : '';

    const stockActualColor = item.esCritico
      ? 'text-rose-600 dark:text-rose-400 font-black'
      : 'text-amber-600 dark:text-amber-400 font-black';

    return `
      <tr class="${rowClass} transition-colors">
        <!-- Estado -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          ${badgeEstado}
        </td>

        <!-- Código -->
        <td class="py-3.5 px-4 font-black tracking-wider text-xs whitespace-nowrap text-slate-900 dark:text-white">
          <div class="flex items-center">
            <span>${item.codigo}</span>
            ${materialBadge}
          </div>
        </td>

        <!-- Descripción -->
        <td class="py-3.5 px-4 text-xs font-bold uppercase truncate max-w-[250px] text-slate-700 dark:text-slate-300" title="${item.descripcion}">
          ${item.descripcion}
        </td>

        <!-- Depósito -->
        <td class="py-3.5 px-4 whitespace-nowrap">
          <span class="inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${item.depositoBadge}">
            ${item.depositoNombre}
          </span>
        </td>

        <!-- Stock Actual -->
        <td class="py-3.5 px-4 text-center text-xs ${stockActualColor} whitespace-nowrap">
          ${item.stockActual} UDS
        </td>

        <!-- Stock Recomendado -->
        <td class="py-3.5 px-4 text-center text-xs font-black text-slate-600 dark:text-slate-400 whitespace-nowrap">
          ${item.stockRecomendado} UDS
        </td>

        <!-- Faltante -->
        <td class="py-3.5 px-4 text-center whitespace-nowrap">
          <span class="inline-flex items-center gap-1 font-black text-xs text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
            -${item.faltante} UDS
          </span>
        </td>
      </tr>
    `;
  }).join('');
};

const exportToCSV = () => {
  if (filteredItems.length === 0) {
    alert("No hay productos filtrados para exportar.");
    return;
  }

  const headers = ["ESTADO", "CODIGO", "DESCRIPCION", "MATERIAL", "DEPOSITO", "STOCK_ACTUAL", "STOCK_RECOMENDADO", "FALTANTE", "PORCENTAJE"];
  const rows = filteredItems.map(item => [
    item.esCritico ? "CRITICO (<50%)" : "ALERTA (50-99%)",
    `"${item.codigo}"`,
    `"${item.descripcion.replace(/"/g, '""')}"`,
    `"${item.material}"`,
    `"${item.depositoNombre}"`,
    item.stockActual,
    item.stockRecomendado,
    item.faltante,
    `${item.porcentaje}%`
  ]);

  const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const fecha = new Date().toISOString().split('T')[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `stock_critico_produccion_${fecha}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
