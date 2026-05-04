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
                undoInject(fullPath);
            }
        }
    }
}

function undoInject(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the INJECTED GLOBALS block entirely
    const startIndex = content.indexOf('<!-- INJECTED GLOBALS -->');
    const endIndex = content.indexOf('<!-- END INJECTED GLOBALS -->');
    if (startIndex !== -1 && endIndex !== -1) {
        const block = content.substring(startIndex, endIndex + '<!-- END INJECTED GLOBALS -->'.length);
        content = content.replace(block, '');
        // Also remove any stray dark-theme.css link that was injected previously
        content = content.replace(/<link rel="stylesheet" href="[^"]*dark-theme\.css">\s*/g, '');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Reverted -> ${filePath}`);
    } else {
        // Fallback for previous manual inject if any
        let changed = false;
        if (content.includes('dark-theme.css')) {
            content = content.replace(/<link rel="stylesheet" href="[^"]*dark-theme\.css">\s*/g, '');
            changed = true;
        }
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Cleaned -> ${filePath}`);
        } else {
            console.log(`Pristine -> ${filePath}`);
        }
    }
}

processDirectory(publicDir);
console.log("Revert complete.");
