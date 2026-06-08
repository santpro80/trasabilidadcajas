// global-sidebar.js

export function initGlobalSidebar() {
    if (document.getElementById('global-sidebar-overlay')) return;

    // 1. Inject Tailwind with Preflight DISABLED
    if (typeof window.tailwind === 'undefined' && !document.getElementById('tailwind-globals')) {
        const sc = document.createElement('script');
        sc.src = "https://cdn.tailwindcss.com";
        sc.id = 'tailwind-globals';
        
        sc.onload = () => {
            const config = document.createElement('script');
            config.textContent = `
                tailwind.config = {
                    corePlugins: { preflight: false },
                    darkMode: 'class',
                    theme: { extend: { colors: { 'villalba-blue': '#2563eb' } } }
                }
            `;
            document.head.appendChild(config);
        };
        document.head.appendChild(sc);

        if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
            const font = document.createElement('link');
            font.rel = "stylesheet";
            font.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";
            document.head.appendChild(font);
        }
    }

    // 2. Apps and Context Information
    const getBase = () => {
        const path = window.location.pathname;
        if (window.location.hostname.includes('github.io')) {
            const repo = path.split('/')[1];
            return `/${repo}/`;
        }
        return '/';
    };
    const baseRoot = getBase();

    const userRoleTrazabilidad = localStorage.getItem('userRole') || 'operario';
    const rawRolePedidos = localStorage.getItem('rolePedidos');
    const rawRoleDeposito = localStorage.getItem('roleDeposito');
    
    const userRolePedidos = rawRolePedidos || userRoleTrazabilidad;
    const userRoleDeposito = rawRoleDeposito || userRoleTrazabilidad;
    
    const userName = localStorage.getItem('userName') || 'Usuario';
    
    // Use ONLY apps explicitly habilitated in the database
    let userApps = JSON.parse(localStorage.getItem('userApps') || '["trazabilidad"]');
    
    // Detect current app context
    const path = window.location.pathname;
    const isPedidosContext = path.includes('pedidos-internos');
    const isDepositoContext = path.includes('deposito');
    
    let currentRole;
    if (isPedidosContext) currentRole = userRolePedidos;
    else if (isDepositoContext) currentRole = userRoleDeposito;
    else currentRole = userRoleTrazabilidad;

    const isSupervisor = currentRole === 'supervisor';
    const isMantenimiento = currentRole === 'mantenimiento';

    // 3. App Buttons HTML
    let appsHtml = '';
    if (userApps.includes('trazabilidad')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}supervisor/menu.html'" class="flex flex-col items-center gap-2 p-3 rounded-xl ${!isPedidosContext && !isDepositoContext ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-10 rounded-xl bg-gradient-to-br from-[#6e8efb] to-[#a777e3] flex items-center justify-center">
                    <span class="text-white font-black text-xs">TZ</span>
                </div>
                <span class="text-[8px] font-black ${!isPedidosContext && !isDepositoContext ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-widest text-center">Trazabilidad</span>
            </button>
        `;
    }
    if (userApps.includes('pedidos')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}pedidos-internos/menu.html'" class="flex flex-col items-center gap-2 p-3 rounded-xl ${isPedidosContext ? 'bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-10 rounded-xl bg-blue-600 flex items-center justify-center">
                    <span class="text-white font-black text-xs">PD</span>
                </div>
                <span class="text-[8px] font-black ${isPedidosContext ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-widest text-center">Pedidos</span>
            </button>
        `;
    }
    
    if (userApps.includes('deposito')) {
        appsHtml += `
            <button onclick="window.location.href='${baseRoot}deposito/menu.html'" class="flex flex-col items-center gap-2 p-3 rounded-xl ${isDepositoContext ? 'bg-indigo-500/20 border-indigo-500/40 shadow-lg shadow-indigo-500/10' : 'bg-slate-200/50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-800'} border cursor-pointer lg:hover:-translate-y-1 transition-all">
                <div class="size-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                    <span class="text-white font-black text-xs">DP</span>
                </div>
                <span class="text-[8px] font-black ${isDepositoContext ? 'text-indigo-500' : 'text-slate-500'} uppercase tracking-widest text-center">Depósito</span>
            </button>
        `;
    }

    // 4. Quick Access Menu Generation
    const menuItems = [];

    if (isPedidosContext) {
        const base = `${baseRoot}pedidos-internos/`;
        menuItems.push({ label: 'Mis Pedidos', icon: 'receipt_long', link: base + 'mis-pedidos.html' });
        menuItems.push({ label: 'Gestión Pedidos', icon: 'inventory_2', link: base + 'gestion-pedidos.html' });
        menuItems.push({ label: 'Panel Admin', icon: 'admin_panel_settings', link: base + 'panel-admin.html' });
        menuItems.push({ label: 'Reportes', icon: 'bar_chart', link: base + 'reportes.html' });
        menuItems.push({ label: 'Configuración', icon: 'settings', link: base + 'configuracion.html' });
    } else if (isDepositoContext) {
        const base = `${baseRoot}deposito/`;
        menuItems.push({ label: 'Carga de Datos', icon: 'add_box', link: base + 'carga-datos.html' });
        menuItems.push({ label: 'Egresos Fallidos', icon: 'report_off', link: base + 'egresos-fallidos.html' });
        menuItems.push({ label: 'Historial', icon: 'history', link: base + 'historial.html' });
        if (isSupervisor) {
            menuItems.push({ label: 'Alertas de Stock', icon: 'warning', link: base + 'alertas-stock.html' });
            menuItems.push({ label: 'Listado de Ítems / Stock', icon: 'category', link: base + 'catalogo.html' });
            menuItems.push({ label: 'Estadísticas', icon: 'bar_chart', link: base + 'estadisticas.html' });
            menuItems.push({ label: 'Migración CSV', icon: 'upload_file', link: base + 'migracion.html' });
            menuItems.push({ label: 'Gestión Usuarios', icon: 'group', link: base + 'gestion-usuarios.html' });
            menuItems.push({ label: 'Ajuste de Stock', icon: 'edit_document', link: base + 'ajuste-stock.html' });
        }
    } else {
        const base = `${baseRoot}${userRoleTrazabilidad}/`;
        if (!isMantenimiento) menuItems.push({ label: 'Modelos de Cajas', icon: 'inventory_2', link: base + 'modelos-de-cajas.html' });
        const ticketLink = isSupervisor ? base + 'tickets-supervisor.html' : base + 'tickets-operador.html';
        menuItems.push({ label: 'Tickets', icon: 'confirmation_number', link: ticketLink });
        menuItems.push({ label: 'Reportar Problema', icon: 'report_problem', link: base + 'reportar-problema.html' });
        if (isSupervisor || isMantenimiento) {
            menuItems.push({ label: 'Ver Problemas', icon: 'bug_report', link: base + 'ver-problemas.html' });
        }
        if (isSupervisor) {
            menuItems.push({ label: 'Historial', icon: 'history', link: base + 'lista-historial.html' });
            menuItems.push({ label: 'Informe Diario', icon: 'today', link: base + 'informe-diario.html' });
            menuItems.push({ label: 'Estadísticas', icon: 'monitoring', link: base + 'estadisticas.html' });
            menuItems.push({ label: 'Catálogo de Ítems', icon: 'category', link: base + 'catalogo-items.html' });
            menuItems.push({ label: 'Usuarios App', icon: 'manage_accounts', link: base + 'gestion-usuarios.html' });
            menuItems.push({ label: 'Buscar Reporte', icon: 'manage_search', link: base + 'buscar-reporte.html' });
        }
    }

    let menuHtml = '';
    menuItems.forEach(item => {
        menuHtml += `
            <button onclick="window.location.href='${item.link}'" class="flex items-center w-full gap-4 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 border-none bg-transparent cursor-pointer group">
                <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">${item.icon}</span>
                <span class="text-[11px] font-bold uppercase tracking-wide flex-1 text-left">${item.label}</span>
            </button>
        `;
    });

    // 5. Drawer HTML (MATCHING SCREENSHOT)
    const sidebarHtml = `
        <div id="global-sidebar-overlay" style="display: none;" class="fixed inset-0 bg-black/60 z-[99998] hidden backdrop-blur-sm transition-opacity" onclick="toggleGlobalSidebar()"></div>
        <aside id="global-side-drawer" style="display: none; font-family: 'Inter', sans-serif;" class="fixed inset-y-0 left-0 z-[99999] w-72 bg-slate-50 dark:bg-[#161e2a] border-r border-slate-200 dark:border-slate-800 transform -translate-x-full transition-transform duration-300 flex flex-col p-6 shadow-2xl text-slate-900 dark:text-slate-100 h-full overflow-hidden">
            <div class="flex items-center justify-between mb-8 shrink-0">
                <div class="flex flex-col">
                    <span class="text-sm font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">TERIAN</span>
                    <span class="text-[10px] font-medium tracking-[0.2em] uppercase text-villalba-blue leading-none mt-0.5">Systems</span>
                </div>
                <button onclick="toggleGlobalSidebar()" class="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-200 dark:bg-slate-800/50 p-1.5 rounded-lg border-none cursor-pointer">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>

            <!-- App Switcher -->
            <div class="mb-6 shrink-0">
                <h3 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-3 px-2">Mis Aplicaciones</h3>
                <div class="grid grid-cols-3 gap-2">
                    ${appsHtml}
                </div>
            </div>

            <!-- Main Buttons -->
            <div class="flex flex-col gap-2 mb-6 shrink-0">
                <button onclick="window.location.href='${isPedidosContext ? baseRoot + 'pedidos-internos/menu.html' : isDepositoContext ? baseRoot + 'deposito/menu.html' : baseRoot + userRoleTrazabilidad + '/menu.html'}'" class="flex items-center w-full gap-4 p-3 rounded-xl bg-villalba-blue text-white shadow-lg shadow-blue-500/20 border-none cursor-pointer group">
                    <span class="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">grid_view</span>
                    <span class="text-[11px] font-black uppercase tracking-widest flex-1 text-left">Menú Principal</span>
                </button>
                <button onclick="toggleGlobalTheme()" class="flex items-center w-full gap-4 p-3 rounded-xl bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                    <span class="material-symbols-outlined text-[20px] theme-icon-global group-hover:rotate-12 transition-transform">dark_mode</span>
                    <span class="text-[11px] font-bold uppercase tracking-wide flex-1 text-left theme-text-global">Modo Oscuro</span>
                </button>
            </div>

            <!-- Quick Access -->
            <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                <h3 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-3 px-2">Acceso Directo</h3>
                <nav class="flex flex-col gap-1">
                    ${menuHtml}
                </nav>
            </div>

            <!-- Bottom Section -->
            <div class="mt-auto pt-6 shrink-0 flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800">
                <button onclick="handleGlobalLogout()" class="flex items-center w-full gap-4 p-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-rose-500 border-none bg-transparent cursor-pointer group font-bold">
                    <span class="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">logout</span>
                    <span class="text-xs uppercase tracking-wide">Cerrar Sesión</span>
                </button>
                
                <!-- Profile Section -->
                <div class="flex items-center gap-3 p-3 bg-slate-200/50 dark:bg-slate-800/40 rounded-xl border border-slate-300 dark:border-slate-800">
                    <div class="size-10 rounded-full bg-villalba-blue flex items-center justify-center text-white shrink-0 font-black shadow-inner">
                        ${userName.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-xs font-bold text-slate-900 dark:text-white truncate uppercase">${userName}</span>
                        <span class="text-[10px] text-slate-500 uppercase tracking-widest truncate">${currentRole}</span>
                    </div>
                </div>
            </div>
        </aside>
        <style>
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.4); }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', sidebarHtml);

    // Hamburger button injection
    const headerLeft = document.querySelector('.header-left');
    if (headerLeft && !document.getElementById('global-hamburger-btn')) {
        const hamburgerHtml = `
            <button id="global-hamburger-btn" onclick="toggleGlobalSidebar()" style="background:transparent; border:none; color:inherit; cursor:pointer; padding:5px; margin-right:12px; display:inline-flex; align-items:center; border-radius: 8px; flex-shrink: 0;">
                <svg viewBox="0 0 24 24" fill="none" class="w-7 h-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 26px; height: 26px;">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
        `;
        headerLeft.insertAdjacentHTML('afterbegin', hamburgerHtml);
    }

    // Logout handler
    window.handleGlobalLogout = () => {
        localStorage.clear();
        window.location.href = baseRoot + 'login.html';
    };

    // 6. Sidebar Logic
    window.toggleGlobalSidebar = () => {
        const overlay = document.getElementById('global-sidebar-overlay');
        const drawer = document.getElementById('global-side-drawer');
        const isOpen = drawer.style.display === 'flex';

        if (!isOpen) {
            overlay.style.display = 'block';
            drawer.style.display = 'flex';
            setTimeout(() => {
                overlay.classList.remove('hidden');
                overlay.classList.add('opacity-100');
                drawer.classList.remove('-translate-x-full');
            }, 10);
        } else {
            overlay.classList.remove('opacity-100');
            drawer.classList.add('-translate-x-full');
            setTimeout(() => {
                overlay.style.display = 'none';
                drawer.style.display = 'none';
            }, 300);
        }
    };

    // Keyboard ESC shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const drawer = document.getElementById('global-side-drawer');
            if (drawer && drawer.style.display === 'flex') {
                toggleGlobalSidebar();
            } else {
                const targetUrl = isPedidosContext ? baseRoot + 'pedidos-internos/menu.html' : isDepositoContext ? baseRoot + 'deposito/menu.html' : baseRoot + userRoleTrazabilidad + '/menu.html';
                if (!window.location.pathname.endsWith('menu.html')) {
                    window.location.href = targetUrl;
                }
            }
        }
    });

    // 7. Persistent "What's New" Modal v2.1 (Desactivado)
    const currentVersion = 'v2_1';
    if (false && !localStorage.getItem(`update_seen_${currentVersion}`)) {
        const updateModalHtml = `
            <div id="update-modal-overlay" class="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4 opacity-0 transition-opacity duration-500">
                <div class="glass-card bg-white dark:bg-[#161e2a] w-full max-w-lg rounded-[2rem] p-8 shadow-2xl transform scale-95 transition-transform duration-500 relative overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#6e8efb] to-[#a777e3]"></div>
                    <div class="flex items-center justify-center mb-6">
                        <div class="size-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
                            <span class="material-symbols-outlined text-4xl">rocket_launch</span>
                        </div>
                    </div>
                    <h2 class="text-2xl font-black text-center text-slate-800 dark:text-white uppercase tracking-tight mb-2">¡Bienvenido a TERIAN Systems!</h2>
                    <p class="text-xs text-center text-slate-500 font-bold uppercase tracking-widest mb-8">Versión 2.1 - Mejoras de Trazabilidad</p>
                    <ul class="space-y-4 mb-8">
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-emerald-500 mt-0.5 text-[20px]">palette</span>
                            <div>
                                <strong class="text-sm text-slate-800 dark:text-slate-200 block uppercase tracking-wide">Rediseño Visual Premium</strong>
                                <span class="text-[11px] text-slate-500 leading-tight">Interfaces de Buscar por Préstamo y Listado de Ítems modernizadas, más rápidas y atractivas.</span>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-villalba-blue mt-0.5 text-[20px]">menu_open</span>
                            <div>
                                <strong class="text-sm text-slate-800 dark:text-slate-200 block uppercase tracking-wide">Nuevo Menú Lateral y Atajos</strong>
                                <span class="text-[11px] text-slate-500 leading-tight">Navega fácilmente desde el menú desplegable (arriba a la izquierda). Además, ahora puedes presionar la tecla <strong>ESC</strong> en cualquier momento para volver al inicio rápidamente.</span>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-purple-500 mt-0.5 text-[20px]">format_list_bulleted</span>
                            <div>
                                <strong class="text-sm text-slate-800 dark:text-slate-200 block uppercase tracking-wide">Estandarización de Términos</strong>
                                <span class="text-[11px] text-slate-500 leading-tight">El antiguo "Catálogo" ahora es el "Listado de Ítems", con visualización completa de descripciones largas y selección inteligente.</span>
                            </div>
                        </li>
                    </ul>
                    <button id="close-update-btn" class="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest text-[11px] hover:-translate-y-1 hover:shadow-lg transition-all active:scale-95">
                        Entendido
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', updateModalHtml);
        setTimeout(() => {
            const overlay = document.getElementById('update-modal-overlay');
            if (overlay) {
                overlay.classList.remove('opacity-0');
                overlay.firstElementChild.classList.remove('scale-95');
            }
        }, 100);
        document.getElementById('close-update-btn').addEventListener('click', () => {
            const overlay = document.getElementById('update-modal-overlay');
            overlay.classList.add('opacity-0');
            overlay.firstElementChild.classList.add('scale-95');
            setTimeout(() => {
                overlay.remove();
                localStorage.setItem(`update_seen_${currentVersion}`, 'true');
            }, 500);
        });
    }
}
initGlobalSidebar();
