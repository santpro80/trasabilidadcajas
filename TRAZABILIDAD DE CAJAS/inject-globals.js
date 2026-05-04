const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const targetFiles = [
    "modelos-de-cajas.html", "modelado-caja.html", "numeros-de-serie.html",
    "agregar-caja.html", "lista-items-por-caja.html", "tickets-supervisor.html",
    "tickets-operario.html", "tickets-detalle.html", "estados-cajas.html",
    "buscarreporte.html", "buscar-por-prestamo.html", "reportar-problema.html",
    "ver-problemas.html", "lista-historial.html", "informe-diario.html",
    "estadisticas.html", "register.html", "gestion-usurios.html",
    "redir-import.html", "cuenta.html", "importar-esquema.html",
    "importar-datos.html"
];

function processDirectory(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (item !== 'pedidos-internos' && item !== 'node_modules') {
                processDirectory(fullPath);
            }
        } else if (stat.isFile() && item.endsWith('.html')) {
            if (targetFiles.includes(item)) {
                injectAssets(fullPath);
            }
        }
    }
}

function injectAssets(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Calculate relative path for dark-theme.css
    const relativePath = path.relative(path.dirname(filePath), path.join(publicDir, 'css', 'dark-theme.css')).replace(/\\/g, '/');

    const assetsToInject = `
    <!-- INJECTED GLOBALS -->
    <link rel="stylesheet" href="${relativePath}">
    <script>
        window.tailwind = {
            config: {
                corePlugins: { preflight: false },
                darkMode: 'class',
                theme: { extend: { colors: { 'villalba-blue': '#2563eb' } } }
            }
        };
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { visibility: hidden; } body.loaded { visibility: visible; }</style>
    <!-- END INJECTED GLOBALS -->
    `;

    // Only inject if not already injected
    if (!content.includes('INJECTED GLOBALS')) {
        // Regex to replace </head> case-insensitively
        const newContent = content.replace(/<\/head>/i, `${assetsToInject}\n</head>`);
        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Success -> ${filePath}`);
        } else {
            console.log(`Failed finding </head> -> ${filePath}`);
        }
    } else {
        console.log(`Already injected -> ${filePath}`);
    }
}

processDirectory(publicDir);
console.log("Injection complete.");
