import { auth, onAuthStateChanged, signOut } from './firebase-config-pedidos.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { db } from '../../supervisor/js/firebase-config.js';

const sideDrawer = document.getElementById('side-drawer');

export let currentUser = null;

export function initApp() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userApps = JSON.parse(localStorage.getItem('userApps') || '[]');

                let rolePedidos = 'operario';
                try {
                    const snap = await getDoc(doc(db, 'users', user.uid));
                    if (snap.exists()) {
                        rolePedidos = snap.data().role_pedidos || 'operario';
                    }
                } catch (e) { console.error('Error fetching role pedidos', e); }

                const userName = localStorage.getItem('userName') || user.email;

                if (!userApps.includes('pedidos')) {
                    alert("No tienes permiso para acceder a Pedidos Internos.");
                    window.location.href = '../login.html';
                    return;
                }

                currentUser = {
                    name: userName,
                    role: rolePedidos,
                    apps: userApps,
                    uid: user.uid,
                    email: user.email
                };

                // sideDrawer rendered by global-sidebar.js via theme.js
                // if (sideDrawer) renderSideDrawer();
                resolve(currentUser);
            } else {
                window.location.href = '../login.html';
            }
        });
    });
}

export function renderSideDrawer() {
    let menuHtml = `
        <div class="flex flex-col h-full w-full bg-white dark:bg-surface-dark overflow-y-auto p-6 pb-8">
            <div class="flex items-center justify-between mb-10">
                <div class="flex flex-col">
                    <span class="text-sm font-black tracking-tighter uppercase leading-none text-slate-900 dark:text-white">TERIAN</span>
                    <span class="text-[10px] font-medium tracking-[0.2em] uppercase text-villalba-blue leading-none mt-0.5">Systems</span>
                </div>
                <button onclick="document.getElementById('side-drawer').classList.add('-translate-x-full'); document.getElementById('side-drawer-overlay').classList.add('hidden');" class="p-2 bg-slate-800/10 dark:bg-slate-800/50 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>
            
            <div class="mb-4">
                <h3 class="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mb-3 px-2">Mis Aplicaciones</h3>
                <div class="grid grid-cols-2 gap-2">
    `;

    if (currentUser.apps.includes('trazabilidad')) {
        menuHtml += `
                    <button onclick="window.goToTrazabilidad()" class="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 transition-all group cursor-pointer">
                        <div class="size-10 rounded-xl bg-gradient-to-br from-[#6e8efb] to-[#a777e3] flex items-center justify-center shadow-md group-hover:-translate-y-1 transition-transform">
                            <span class="text-white font-black text-xs">TZ</span>
                        </div>
                        <span class="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-center">Trazabilidad</span>
                    </button>
        `;
    }

    if (currentUser.apps.includes('pedidos')) {
        menuHtml += `
                    <div class="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 cursor-default">
                        <div class="size-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span class="text-white font-black text-xs">PD</span>
                        </div>
                        <span class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest text-center">Pedidos</span>
                    </div>
        `;
    }

    menuHtml += `
                </div>
            </div>

            <nav class="flex flex-col gap-1 mb-6">
                <button onclick="toggleGlobalTheme()" class="flex items-center w-full gap-4 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-transparent dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    <span class="material-symbols-outlined text-[20px] theme-icon-global">light_mode</span>
                    <span class="text-xs font-bold uppercase tracking-wide flex-1 text-left theme-text-global">Cambiar Tema</span>
                </button>
                 <a href="menu.html"
                    class="flex items-center w-full gap-4 p-3 rounded-xl bg-villalba-blue text-white shadow-lg shadow-blue-500/20 text-decoration-none cursor-pointer hover:opacity-90 transition-opacity">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span>
                    <span class="text-xs font-bold uppercase tracking-wide flex-1 text-left">Menú Principal</span>
                </a>
            </nav>

            <div class="mt-auto pt-6">
                <button onclick="window.logoutGlobal()" class="flex items-center w-full gap-3 p-3 mb-4 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer">
                    <span class="material-symbols-outlined text-[20px]">logout</span>
                    <span class="text-xs font-bold uppercase tracking-wide">Cerrar Sesión</span>
                </button>
                
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div class="size-10 rounded-full bg-villalba-blue/10 flex items-center justify-center text-villalba-blue shrink-0">
                        <span class="material-symbols-outlined">person</span>
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-xs font-bold text-slate-900 dark:text-white truncate">${currentUser?.name}</span>
                        <span class="text-[10px] text-slate-500 uppercase tracking-widest truncate">${currentUser?.role}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    sideDrawer.innerHTML = menuHtml;
}

window.goToTrazabilidad = function () {
    const role = localStorage.getItem('userRole');
    if (role === 'supervisor') {
        window.location.href = '../supervisor/menu.html';
    } else if (role === 'mantenimiento') {
        window.location.href = '../mantenimiento/menu.html?prompt_notifications=true';
    } else {
        window.location.href = '../operario/menu.html';
    }
}

window.logoutGlobal = async function () {
    try {
        await signOut(auth);
        window.location.href = '../login.html';
    } catch (e) {
        console.error(e);
        window.location.href = '../login.html';
    }
}
