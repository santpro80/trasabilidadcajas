const fs = require('fs');
const files = [
    'public/supervisor/modelado-caja.html',
    'public/operario/modelado-caja.html'
];

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) return;
        
        let content = fs.readFileSync(file, 'latin1'); // Read assuming latin1/windows-1252
        
        // Fix encoding errors if any
        content = content.replace(/MEN./g, 'MENÚ');
        content = content.replace(/GESTI.N/g, 'GESTIÓN');
        
        // Add theme.js if missing
        if (!content.includes('theme.js')) {
            content = content.replace("initGlobalSidebar();</script>", 
                "initGlobalSidebar(); import '../js/theme.js';</script>");
        }
        
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed encoding and added theme.js to', file);
    } catch(e) {
        console.error('Error on', file, e.message);
    }
});
