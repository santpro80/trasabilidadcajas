import { doc, updateDoc, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { db } from '../../supervisor/js/firebase-config.js';
import { initApp, currentUser } from './app.js';

let usersList = [];
let filteredUsers = [];
let searchQuery = '';

initApp().then(async (user) => {
    document.getElementById('loading-state').remove();
    document.getElementById('admin-content').classList.remove('hidden');

    // Load users
    try {
        const q = query(collection(db, "users"), orderBy("name"));
        const snapshot = await getDocs(q);

        // ONLY GET USERS WHO ALREADY HAVE 'pedidos' in their apps array
        usersList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => Array.isArray(u.apps) && u.apps.includes('pedidos'));
        filteredUsers = [...usersList];
        renderUsers();
    } catch (error) {
        console.error("Error loading users", error);
        document.getElementById('users-container').innerHTML = '<p class="text-center text-rose-500 py-10 font-bold">Error cargando usuarios.</p>';
    }

    document.getElementById('search-users').addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        filteredUsers = usersList.filter(u =>
            (u.name && u.name.toLowerCase().includes(searchQuery)) ||
            (u.email && u.email.toLowerCase().includes(searchQuery))
        );
        renderUsers();
    });
});

function renderUsers() {
    const container = document.getElementById('users-container');
    if (filteredUsers.length === 0) {
        container.innerHTML = `
            <div class="py-20 text-center flex flex-col items-center opacity-50 col-span-2">
                <span class="material-symbols-outlined text-6xl text-slate-400 mb-2">person_off</span>
                <p class="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay usuarios en esta aplicación</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredUsers.map(u => {
        const rolePedidos = u.role_pedidos || 'operario';

        return `
            <div class="bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <span class="material-symbols-outlined text-villalba-blue">shield_person</span>
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-slate-900 dark:text-white leading-tight">${u.name || 'Sin nombre'}</h3>
                        <p class="text-[10px] text-slate-500 font-medium mb-1">${u.email}</p>
                        <div class="flex flex-wrap gap-1.5 mt-1">
                            <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-500/10 text-villalba-blue border border-blue-200 dark:border-blue-500/20">
                                Rol: ${rolePedidos}
                            </span>
                            ${u.sector_pedidos ? `
                            <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-500/20">
                                Sector: ${u.sector_pedidos}
                            </span>
                            ` : `
                            <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-500/10 text-slate-500 border border-slate-200 dark:border-slate-500/20">
                                Sin Sector
                            </span>
                            `}
                        </div>
                    </div>
                </div>
                <div class="flex items-center">
                    <button onclick="window.admin.editUser('${u.id}')" class="w-full md:w-auto px-5 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-[10px] border border-slate-200 dark:border-slate-700 font-black uppercase tracking-[0.15em] transition-all flex justify-center items-center gap-2">
                        <span class="material-symbols-outlined text-[16px]">edit_square</span> Gestionar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.admin = {
    editUser: (id) => {
        const u = usersList.find(x => x.id === id);
        if (!u) return;

        const rolePedidos = u.role_pedidos || 'operario';

        const dialog = document.createElement('div');
        dialog.className = "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity";
        dialog.innerHTML = `
            <div class="bg-white dark:bg-surface-dark w-full max-w-md rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 size-8 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                    <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
                
                <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">Rol en Pedidos</h2>
                <p class="text-xs text-slate-500 font-medium mb-6 flex items-center gap-1.5"><span class="material-symbols-outlined text-[14px]">alternate_email</span> ${u.name || u.email}</p>

                <div class="space-y-4">
                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">Asignar Nivel de Acceso</label>
                        <div class="relative">
                            <select id="sel-role-pedidos-${id}" class="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-villalba-blue/30 shadow-sm appearance-none cursor-pointer">
                                <option value="operario" ${rolePedidos === 'operario' ? 'selected' : ''}>Operario Básico</option>
                                <option value="supervisor" ${rolePedidos === 'supervisor' ? 'selected' : ''}>Administrador de Pedidos</option>
                            </select>
                            <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    <div>
                        <label class="block text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 mt-4">Sector del Usuario</label>
                        <div class="relative">
                            <select id="sel-sector-${id}" class="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3.5 text-sm font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-villalba-blue/30 shadow-sm appearance-none cursor-pointer">
                                <option value="" ${!u.sector_pedidos ? 'selected' : ''}>Sin asignar</option>
                                <option value="Mecanizado" ${u.sector_pedidos === 'Mecanizado' ? 'selected' : ''}>Mecanizado</option>
                                <option value="Depósito" ${u.sector_pedidos === 'Depósito' ? 'selected' : ''}>Depósito</option>
                                <option value="Dirección Técnica" ${u.sector_pedidos === 'Dirección Técnica' ? 'selected' : ''}>Dirección Técnica</option>
                                <option value="Lavado" ${u.sector_pedidos === 'Lavado' ? 'selected' : ''}>Lavado</option>
                                <option value="Reacondicionamiento de Cajas" ${u.sector_pedidos === 'Reacondicionamiento de Cajas' ? 'selected' : ''}>Reacondicionamiento de Cajas</option>
                                <option value="Pulido" ${u.sector_pedidos === 'Pulido' ? 'selected' : ''}>Pulido</option>
                                <option value="Reparación de Cajas" ${u.sector_pedidos === 'Reparación de Cajas' ? 'selected' : ''}>Reparación de Cajas</option>
                                <option value="Oficina Técnica" ${u.sector_pedidos === 'Oficina Técnica' ? 'selected' : ''}>Oficina Técnica</option>
                                <option value="Logística" ${u.sector_pedidos === 'Logística' ? 'selected' : ''}>Logística</option>
                                <option value="Expedición" ${u.sector_pedidos === 'Expedición' ? 'selected' : ''}>Expedición</option>
                                <option value="Reacondicionamiento de Motores" ${u.sector_pedidos === 'Reacondicionamiento de Motores' ? 'selected' : ''}>Reacondicionamiento de Motores</option>
                                <option value="Laboratorio" ${u.sector_pedidos === 'Laboratorio' ? 'selected' : ''}>Laboratorio</option>
                                <option value="Comercio" ${u.sector_pedidos === 'Comercio' ? 'selected' : ''}>Comercio</option>
                                <option value="Sucursales" ${u.sector_pedidos === 'Sucursales' ? 'selected' : ''}>Sucursales</option>
                            </select>
                            <span class="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    <div class="pt-4">
                        <button id="btn-save-${id}" class="w-full py-4 bg-villalba-blue hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex justify-center items-center gap-2">
                            Guardar Nivel
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById(`btn-save-${id}`).addEventListener('click', async (e) => {
            const btn = e.target;
            const newRolePedidos = document.getElementById(`sel-role-pedidos-${id}`).value;
            const newSector = document.getElementById(`sel-sector-${id}`).value;

            btn.disabled = true;
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[20px]">sync</span> Actualizando...';

            try {
                // Actualizar DB principal de Trazabilidad
                await updateDoc(doc(db, "users", id), {
                    role_pedidos: newRolePedidos,
                    sector_pedidos: newSector
                });

                // Update local memory to reflect immediately
                u.role_pedidos = newRolePedidos;
                u.sector_pedidos = newSector;
                renderUsers();

                dialog.remove();
            } catch (err) {
                console.error(err);
                alert("Error al guardar cambios");
                btn.disabled = false;
                btn.innerHTML = 'Guardar Nivel';
            }
        });
    }
};
