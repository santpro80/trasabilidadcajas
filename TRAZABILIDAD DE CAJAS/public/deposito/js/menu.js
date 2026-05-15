import { requireDepositoAuth } from './firebase-config-deposito.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await requireDepositoAuth(['supervisor', 'operario']);
        const role = authData.userData.role || 'operario';
        const isSupervisor = role === 'supervisor';

        const nameSpan = document.getElementById('user-display-name');
        const roleTitle = document.getElementById('role-title');
        const roleSpan = document.getElementById('user-role-display');
        const colOperatividad = document.getElementById('col-operatividad');
        const colAdministracion = document.getElementById('col-administracion');

        if(nameSpan) nameSpan.textContent = authData.userData.name || authData.user.email;
        if(roleTitle) roleTitle.textContent = isSupervisor ? 'Panel Supervisor' : 'Panel Operario';
        if(roleSpan) roleSpan.textContent = `DEPÓSITO DE CAJAS - ${role.toUpperCase()}`;

        const menuItems = [
            {
                id: 'carga-datos',
                title: 'Movimientos Operativos',
                desc: 'Registrar Ingresos y Egresos',
                icon: 'add_box',
                link: 'carga-datos.html',
                bg: 'bg-blue-50 dark:bg-blue-500/10',
                text: 'text-blue-600 dark:text-blue-400',
                roles: ['operario', 'supervisor'],
                col: 'operatividad'
            },
            {
                id: 'historial',
                title: 'Historial',
                desc: 'Registro completo de movimientos',
                icon: 'history',
                link: 'historial.html',
                bg: 'bg-slate-100 dark:bg-slate-500/10',
                text: 'text-slate-600 dark:text-slate-400',
                roles: ['supervisor', 'operario'],
                col: 'administracion'
            },
            {
                id: 'catalogo',
                title: 'Listado de Ítems',
                desc: 'Listado visual de ítems con stock actual',
                icon: 'category',
                link: 'catalogo.html',
                bg: 'bg-pink-50 dark:bg-pink-500/10',
                text: 'text-pink-600 dark:text-pink-400',
                roles: ['supervisor'],
                col: 'administracion'
            },
            {
                id: 'estadisticas',
                title: 'Estadísticas',
                desc: 'Análisis y gráficos temporales',
                icon: 'bar_chart',
                link: 'estadisticas.html',
                bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                text: 'text-emerald-600 dark:text-emerald-400',
                roles: ['supervisor'],
                col: 'administracion'
            },
            {
                id: 'alertas',
                title: 'Alertas de Stock',
                desc: 'Configurar alertas y reposición',
                icon: 'warning',
                link: 'alertas-stock.html',
                bg: 'bg-orange-50 dark:bg-orange-500/10',
                text: 'text-orange-600 dark:text-orange-400',
                roles: ['supervisor'],
                col: 'administracion'
            },
            {
                id: 'migracion',
                title: 'Migración CSV',
                desc: 'Carga masiva de base de datos',
                icon: 'upload_file',
                link: 'migracion.html',
                bg: 'bg-amber-50 dark:bg-amber-500/10',
                text: 'text-amber-600 dark:text-amber-400',
                roles: ['supervisor'],
                col: 'administracion'
            },
            {
                id: 'usuarios',
                title: 'Gestión Usuarios',
                desc: 'Administrar permisos',
                icon: 'group',
                link: 'gestion-usuarios.html',
                bg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
                text: 'text-fuchsia-600 dark:text-fuchsia-400',
                roles: ['supervisor'],
                col: 'administracion'
            }
        ];

        let htmlOperatividad = '';
        let htmlAdministracion = '';

        menuItems.forEach(item => {
            if (item.roles.includes(role)) {
                const cardHtml = `
                    <a href="${item.link}" class="flex items-center gap-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl p-4 lg:p-5 group hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 transform lg:hover:-translate-y-1">
                        <div class="size-11 rounded-xl ${item.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                            <span class="material-symbols-outlined text-[24px] ${item.text}">${item.icon}</span>
                        </div>
                        <div class="flex flex-col flex-1">
                            <h3 class="text-[13px] sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-0.5">${item.title}</h3>
                            <p class="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-tight">${item.desc}</p>
                        </div>
                    </a>
                `;

                if (item.col === 'operatividad') {
                    htmlOperatividad += cardHtml;
                } else {
                    htmlAdministracion += cardHtml;
                }
            }
        });

        if (colOperatividad) colOperatividad.innerHTML = htmlOperatividad || '<p class="text-xs text-slate-500">Sin acceso asignado</p>';
        if (colAdministracion) {
            if (htmlAdministracion) {
                colAdministracion.innerHTML = htmlAdministracion;
            } else {
                colAdministracion.parentElement.style.display = 'none'; // Ocultar columna entera si está vacía
            }
        }

    } catch (error) {
        console.error("Error al inicializar el menú del depósito", error);
    }
});
