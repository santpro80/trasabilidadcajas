const fs = require('fs');
const path = require('path');

const targets = [
    'public/supervisor/tickets-supervisor.html',
    'public/supervisor/tickets-operador.html',
    'public/supervisor/ticket-detalle.html',
    'public/operario/tickets-supervisor.html',
    'public/operario/tickets-operador.html',
    'public/operario/ticket-detalle.html',
    'public/mantenimiento/tickets-supervisor.html',
    'public/mantenimiento/tickets-operador.html',
    'public/mantenimiento/ticket-detalle.html'
];

targets.forEach(target => {
    const filePath = path.join(__dirname, target);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Inject dark-theme.css link if missing
        if (!content.includes('dark-theme.css')) {
            content = content.replace('</head>', '    <link rel="stylesheet" href="../css/dark-theme.css">\n</head>');
            console.log(`Injected dark-theme.css -> ${target}`);
        }

        // Fix max-width (sometimes it's 900px or 1000px in these files)
        content = content.replace(/max-width:\s*\d+px/g, 'max-width: 1200px');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated width and CSS check -> ${target}`);
    } else {
        console.log(`File not found -> ${target}`);
    }
});
