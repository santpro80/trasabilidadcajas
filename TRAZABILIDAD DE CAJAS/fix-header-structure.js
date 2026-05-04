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

        // Find the header tag and wrap the h1 in .header-left div
        // We match <header> ... <h1> ... </h1>
        const headerMatch = content.match(/<header>([\s\S]*?)(<h1[\s\S]*?<\/h1>)/);

        if (headerMatch && !content.includes('class="header-left"')) {
            const beforeH1 = headerMatch[1];
            const h1Tag = headerMatch[2];
            const newHeaderContent = `<header>${beforeH1}<div class="header-left">${h1Tag}</div>`;
            content = content.replace(/<header>[\s\S]*?<h1[\s\S]*?<\/h1>/, newHeaderContent);

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Wrapped H1 in .header-left -> ${target}`);
        } else {
            console.log(`Header or H1 not found / already wrapped -> ${target}`);
        }
    }
});
