import './global-sidebar.js';

export function initTheme() {
    const storedTheme = localStorage.getItem('villalba-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = storedTheme === 'dark' || (!storedTheme && prefersDark);

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeUI(isDark);
}

export function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('villalba-theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
}

function updateThemeUI(isDark) {
    // Busca los textos e iconos del tema por clase
    const texts = document.querySelectorAll('.theme-text-global');
    const icons = document.querySelectorAll('.theme-icon-global');

    texts.forEach(t => t.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro');
    icons.forEach(i => i.textContent = isDark ? 'light_mode' : 'dark_mode');
}

// Auto-run on module load
initTheme();

// Expose toggle function globally for inline onclick handlers
window.toggleGlobalTheme = toggleTheme;
