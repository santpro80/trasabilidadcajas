const fs = require('fs');
const files = [
    'public/supervisor/numeros-de-serie.html',
    'public/operario/numeros-de-serie.html'
];
const iconLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />';

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) return;
        let content = fs.readFileSync(file, 'utf8');
        if (!content.includes('Material+Symbols+Outlined')) {
            content = content.replace('</title>', '</title>\n    ' + iconLink);
            fs.writeFileSync(file, content, 'utf8');
            console.log('Fixed icons in', file);
        } else {
            console.log('Icons already present in', file);
        }
    } catch(e) {
        console.error('Error on', file, e.message);
    }
});
