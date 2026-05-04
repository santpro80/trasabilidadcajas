const fs = require('fs');
const files = [
    'public/supervisor/modelos-de-cajas.html',
    'public/operario/modelos-de-cajas.html'
];

files.forEach(file => {
    try {
        let content = fs.readFileSync(file, 'utf8');
        
        // Remove md:grid-cols-2 to make it a single column
        content = content.replace(/md:grid-cols-2/g, '');
        
        // Fix encoding artifacts 
        content = content.replace(/MEN./g, 'MENÚ');
        content = content.replace(/GESTI.N/g, 'GESTIÓN');
        
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed layout and encoding in', file);
    } catch(e) {
        console.error('Error on', file, e.message);
    }
});
