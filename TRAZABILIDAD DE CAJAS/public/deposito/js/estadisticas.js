import { db, collection, getDocs, query, where, requireDepositoAuth } from './firebase-config-deposito.js';

let depositoItemsCache = [];
let currentUser = null;
let currentItemCode = null;
let movimientosData = []; // Caché de movimientos de la pieza seleccionada

// Variables de gráficos Chart.js
let chartSemanal = null;
let chartMensual = null;
let chartAnual = null;

const THEME = {
    ingreso: {
        bg: 'rgba(16, 185, 129, 0.2)',
        border: 'rgb(16, 185, 129)'
    },
    egreso: {
        bg: 'rgba(239, 68, 68, 0.2)',
        border: 'rgb(239, 68, 68)'
    },
    grid: 'rgba(148, 163, 184, 0.1)',
    text: '#94a3b8'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor', 'operario']);
        currentUser = authData.user;
        const nameSpan = document.getElementById('user-display-name');
        if(nameSpan) nameSpan.textContent = authData.userData.name || currentUser.email;

        await fetchListaItems();
        initSearch();
        initFilters();

    } catch (error) {
        console.error("Error en estadísticas:", error);
    }
});

const fetchListaItems = async () => {
    const input = document.getElementById('codigo-pieza');
    try {
        if(input) {
            input.disabled = true;
            input.placeholder = "Cargando ítems...";
        }

        const CACHE_KEY = 'villalba_items_cache';
        const CACHE_EXPIRY = 1000 * 60 * 60 * 12; // 12 horas
        const cached = localStorage.getItem(CACHE_KEY);
        
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_EXPIRY) {
                depositoItemsCache = data;
                if(input) {
                    input.disabled = false;
                    input.placeholder = "Ej: 4211800";
                }
                return;
            }
        }

        const q = query(collection(db, 'deposito_catalogo'));
        const querySnapshot = await getDocs(q);
        depositoItemsCache = querySnapshot.docs.map(doc => ({
            codigo: doc.id,
            descripcion: doc.data().descripcion,
            stock: doc.data().stock
        }));

        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: depositoItemsCache
        }));

        if(input) {
            input.disabled = false;
            input.placeholder = "Ej: 4211800";
        }
    } catch (error) {
        console.error("Error al cargar lista de ítems:", error);
        if(input) {
            input.disabled = false;
            input.placeholder = "Error de conexión";
        }
    }
};

const initSearch = () => {
    const input = document.getElementById('codigo-pieza');
    const autocompleteList = document.getElementById('autocomplete-list');
    const detalleInput = document.getElementById('detalle-pieza');
    const imgContainer = document.getElementById('img-container');
    const previewPieza = document.getElementById('preview-pieza');
    const btnBuscar = document.getElementById('btn-buscar');

    const checkValid = () => {
        if (input.value.trim().length > 0 && detalleInput.value.trim().length > 0) {
            btnBuscar.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        } else {
            btnBuscar.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
        }
    };

    input.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase();
        
        let stripped = val.replace(/[^A-Z0-9]/g, '');
        let formatted = '';
        if (stripped.length > 0) formatted += stripped.substring(0, 2);
        if (stripped.length > 2) formatted += '-' + stripped.substring(2, 5);
        if (stripped.length > 5) formatted += '-' + stripped.substring(5, 7);
        
        if (input.value !== formatted) input.value = formatted;
        val = formatted;
        
        autocompleteList.innerHTML = '';
        detalleInput.value = '';
        imgContainer.classList.add('hidden');
        checkValid();
        
        if (!val) {
            autocompleteList.classList.add('hidden');
            return;
        }

        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');
        const matches = depositoItemsCache.filter(item => {
            const codigo = item.codigo.toUpperCase();
            const desc = (item.descripcion || '').toUpperCase();
            const codigoAlfanumerico = codigo.replace(/[^A-Z0-9]/g, '');
            return codigo.includes(val) || desc.includes(val) || (valAlfanumerico.length > 0 && codigoAlfanumerico.includes(valAlfanumerico));
        }).slice(0, 10);

        if (matches.length > 0) {
            autocompleteList.classList.remove('hidden');
            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = "px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0 group";
                div.innerHTML = `
                    <div class="flex items-center w-full justify-between gap-4">
                        <span class="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest whitespace-nowrap">${item.codigo}</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase text-right leading-tight break-words flex-1">${item.descripcion}</span>
                    </div>
                `;
                div.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = item.codigo;
                    detalleInput.value = item.descripcion;
                    autocompleteList.classList.add('hidden');
                    
                    previewPieza.src = `../assets/items/${item.codigo}.webp`;
                    previewPieza.style.opacity = '0';
                    imgContainer.classList.remove('hidden');
                    imgContainer.classList.add('flex');
                    checkValid();
                });
                autocompleteList.appendChild(div);
            });
        } else {
            autocompleteList.classList.add('hidden');
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => autocompleteList.classList.add('hidden'), 200);
        const val = input.value.toUpperCase();
        const valAlfanumerico = val.replace(/[^A-Z0-9]/g, '');
        
        if (valAlfanumerico) {
            const exactMatch = depositoItemsCache.find(item => {
                const codAlfanumerico = item.codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
                return codAlfanumerico === valAlfanumerico;
            });
            if (exactMatch) {
                 input.value = exactMatch.codigo;
                 detalleInput.value = exactMatch.descripcion;
                 previewPieza.src = `../assets/items/${exactMatch.codigo}.webp`;
                 previewPieza.style.opacity = '0';
                 imgContainer.classList.remove('hidden');
                 imgContainer.classList.add('flex');
            } else {
                 imgContainer.classList.add('hidden');
                 imgContainer.classList.remove('flex');
            }
        }
        checkValid();
    });

    btnBuscar.addEventListener('click', async () => {
        if (!input.value) return;
        currentItemCode = input.value;
        const btnOriginalText = btnBuscar.innerHTML;
        btnBuscar.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> Cargando...';
        
        await fetchMovimientos(currentItemCode);
        
        document.getElementById('stats-container').classList.remove('hidden');
        document.getElementById('stats-container').classList.add('flex');
        
        renderSemanal();
        renderMensual();
        renderAnual();
        
        btnBuscar.innerHTML = btnOriginalText;
    });
};

const fetchMovimientos = async (codigo) => {
    try {
        const q = query(collection(db, 'deposito_movimientos'), where("codigo", "==", codigo));
        const qs = await getDocs(q);
        
        movimientosData = qs.docs.map(doc => {
            const d = doc.data();
            return {
                ...d,
                fechaObj: d.fecha ? d.fecha.toDate() : new Date()
            };
        });
    } catch (error) {
        console.error("Error al cargar movimientos:", error);
    }
};

const initFilters = () => {
    const d = new Date();
    const selectMes = document.getElementById('select-mes');
    const selectAnio = document.getElementById('select-anio');
    
    selectMes.value = d.getMonth().toString();
    
    // Rellenar años (desde 2024 hasta año actual + 1)
    const currentYear = d.getFullYear();
    selectAnio.innerHTML = '';
    for(let y = 2024; y <= currentYear + 1; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        selectAnio.appendChild(opt);
    }

    selectMes.addEventListener('change', renderMensual);
    selectAnio.addEventListener('change', renderAnual);
};

const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
    },
    scales: {
        x: { grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } },
        y: { beginAtZero: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
    }
};

const renderSemanal = () => {
    const ctx = document.getElementById('chart-semanal').getContext('2d');
    
    // Crear array de últimos 7 días
    const labels = [];
    const ingresos = [0,0,0,0,0,0,0];
    const egresos = [0,0,0,0,0,0,0];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' }));
    }
    
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0,0,0,0);

    movimientosData.forEach(m => {
        if (m.fechaObj >= sevenDaysAgo && m.fechaObj <= today) {
            // Calcular indice (0 a 6)
            const diffTime = Math.abs(today - m.fechaObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            const idx = 6 - (diffDays > 0 ? diffDays - 1 : 0); // Aproximacion simple
            
            // Mas preciso
            for (let i = 0; i < 7; i++) {
                const dayLabel = new Date();
                dayLabel.setDate(today.getDate() - (6 - i));
                if (m.fechaObj.getDate() === dayLabel.getDate() && m.fechaObj.getMonth() === dayLabel.getMonth()) {
                    if (m.tipo === "Ingreso") ingresos[i] += Number(m.cantidad);
                    if (m.tipo === "Egreso") egresos[i] += Number(m.cantidad);
                }
            }
        }
    });

    if (chartSemanal) chartSemanal.destroy();
    
    chartSemanal = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, borderColor: THEME.ingreso.border, backgroundColor: THEME.ingreso.bg, tension: 0.3, fill: true },
                { label: 'Egresos', data: egresos, borderColor: THEME.egreso.border, backgroundColor: THEME.egreso.bg, tension: 0.3, fill: true }
            ]
        },
        options: defaultOptions
    });
};

const renderMensual = () => {
    const ctx = document.getElementById('chart-mensual').getContext('2d');
    const mesSeleccionado = parseInt(document.getElementById('select-mes').value);
    const anioActual = new Date().getFullYear();
    
    // Obtener dias del mes
    const diasEnMes = new Date(anioActual, mesSeleccionado + 1, 0).getDate();
    const labels = Array.from({length: diasEnMes}, (_, i) => `${i + 1}`);
    
    const ingresos = new Array(diasEnMes).fill(0);
    const egresos = new Array(diasEnMes).fill(0);

    movimientosData.forEach(m => {
        if (m.fechaObj.getMonth() === mesSeleccionado && m.fechaObj.getFullYear() === anioActual) {
            const diaIdx = m.fechaObj.getDate() - 1;
            if (m.tipo === "Ingreso") ingresos[diaIdx] += Number(m.cantidad);
            if (m.tipo === "Egreso") egresos[diaIdx] += Number(m.cantidad);
        }
    });

    if (chartMensual) chartMensual.destroy();

    chartMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, backgroundColor: THEME.ingreso.border, borderRadius: 4 },
                { label: 'Egresos', data: egresos, backgroundColor: THEME.egreso.border, borderRadius: 4 }
            ]
        },
        options: defaultOptions
    });
};

const renderAnual = () => {
    const ctx = document.getElementById('chart-anual').getContext('2d');
    const anioSeleccionado = parseInt(document.getElementById('select-anio').value);
    
    const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const ingresos = new Array(12).fill(0);
    const egresos = new Array(12).fill(0);

    movimientosData.forEach(m => {
        if (m.fechaObj.getFullYear() === anioSeleccionado) {
            const mesIdx = m.fechaObj.getMonth();
            if (m.tipo === "Ingreso") ingresos[mesIdx] += Number(m.cantidad);
            if (m.tipo === "Egreso") egresos[mesIdx] += Number(m.cantidad);
        }
    });

    if (chartAnual) chartAnual.destroy();

    chartAnual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: ingresos, backgroundColor: THEME.ingreso.border, borderRadius: 6 },
                { label: 'Egresos', data: egresos, backgroundColor: THEME.egreso.border, borderRadius: 6 }
            ]
        },
        options: {
            ...defaultOptions,
            scales: {
                x: { stacked: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } },
                y: { stacked: true, beginAtZero: true, grid: { color: THEME.grid }, ticks: { color: THEME.text, font: { family: "'Public Sans', sans-serif", weight: 'bold' } } }
            }
        }
    });
};
