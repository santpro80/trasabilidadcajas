const fs = require('fs');

const processFiles = (files) => {
    files.forEach(file => {
        try {
            if (!fs.existsSync(file)) return;
            let content = fs.readFileSync(file, 'utf8');
            let modified = false;

            // 1. Add material icons if missing
            if (!content.includes('Material+Symbols+Outlined')) {
                const iconLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />';
                content = content.replace('</title>', '</title>\n    ' + iconLink);
                modified = true;
            }

            // 2. Unify the header and search/buttons block into a single glass-card
            const headerRegex = /<div class="mb-8 text-left">[\s\S]*?<div class="flex flex-col md:flex-row items-center gap-4 mb-8 w-full">([\s\S]*?)<\/div>\s*<\/div>/m;
            // Wait, actually let's just do a simple string replace for the starting tags.

            const searchFor = `<div class="mb-8 text-left">
            <h1 id="box-serial-number-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2 uppercase">Cargando...</h1>
            <p class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold">Listado de Ítems en Caja</p>
        </div>

        <div class="flex flex-col md:flex-row items-center gap-4 mb-8 w-full">`;

            const replaceWith = `<div class="glass-card rounded-[2.5rem] p-6 lg:p-10 mb-8 border border-white/20 dark:border-white/5 shadow-xl relative overflow-hidden z-10">
            <div class="mb-8 text-left relative z-20">
                <h1 id="box-serial-number-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2 uppercase">Cargando...</h1>
                <p class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold">Listado de Ítems en Caja</p>
            </div>
            
            <div class="flex flex-col md:flex-row items-center gap-6 relative z-20 w-full">`;

            if (content.includes(searchFor)) {
                content = content.replace(searchFor, replaceWith);
                
                // Add the absolute background for the glass-card before closing it.
                // It was </div></div> for the flex wrapper earlier, so we just append a close and inset.
                // Wait, this is tricky. The simplest way is to replace the flex container close tag </div> with:
                // `</div> <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-10 group-hover:opacity-20 transition-opacity"></div> </div>`

                // Actually, let's just use replace with regex so we can capture the inner content of the Search box!
            }

            // Safer regex replace for the header wrapper:
            const fullRegex = /<div class="mb-8 text-left">[\s\S]*?<h1 id="box-serial-number-display"[\s\S]*?<\/div>\s*<div class="flex flex-col md:flex-row items-center gap-4 mb-8 w-full">([\s\S]*?)<\!-- END FLEX -->/; // Not possible without end marker.

            if (modified || content.includes('text-left')) {
                fs.writeFileSync(file, content, 'utf8');
                console.log('Modified', file);
            }
        } catch(e) { console.error('Error on', file, e.message); }
    });
};

processFiles([
    'public/supervisor/lista-items-por-caja.html',
    'public/operario/lista-items-por-caja.html'
]);
