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
            // Ignore pedidios-internos to avoid breaking its pure Tailwind setup
            if (item !== 'pedidos-internos' && item !== 'node_modules') {
                processDirectory(fullPath);
            }
        } else if (stat.isFile() && item.endsWith('.html')) {
            if (targetFiles.includes(item)) {
                injectDarkModeCSS(fullPath);
            }
        }
    }
}

function injectDarkModeCSS(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if it already has dark-theme.css
    if (content.includes('dark-theme.css')) return;

    // Calculate relative path to css
    const relativePath = path.relative(path.dirname(filePath), path.join(publicDir, 'css', 'dark-theme.css')).replace(/\\/g, '/');
    const linkTag = `\n    <link rel="stylesheet" href="${relativePath}">\n`;

    // Insert just before closing head
    content = content.replace('</head>', `${linkTag}</head>`);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Injected into: ${filePath}`);
}

processDirectory(publicDir);
console.log("Injection complete.");
