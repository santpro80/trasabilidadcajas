const fs = require('fs');
const files = [
    'public/supervisor/js/modelado-caja.js',
    'public/operario/js/numeros-de-serie.js',
    'public/operario/js/lista-items-por-caja.js',
    'public/operario/js/estados-cajas.js'
];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        let newContent = content.replace(/\\`/g, '`');
        newContent = newContent.replace(/\\\$/g, '$');
        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            console.log('Fixed', file);
        } else {
            console.log('No changes needed for', file);
        }
    } catch(e) {
        console.error('Error on', file, e.message);
    }
});
