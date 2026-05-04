const fs = require('fs');

const processFiles = (files, replacer) => {
    files.forEach(file => {
        try {
            if (!fs.existsSync(file)) return;
            let content = fs.readFileSync(file, 'utf8');
            let newContent = replacer(content);
            if (content !== newContent) {
                fs.writeFileSync(file, newContent, 'utf8');
                console.log('Fixed headers in', file);
            }
        } catch(e) { console.error('Error on', file, e.message); }
    });
};

// 1. modelos-de-cajas
processFiles([
    'public/supervisor/modelos-de-cajas.html',
    'public/operario/modelos-de-cajas.html'
], (content) => {
    return content.replace(
        '<div class="mb-8 text-left">',
        '<div class="glass-card rounded-[2rem] p-6 lg:p-8 mb-8 text-left border border-white/20 dark:border-white/5 shadow-xl relative overflow-hidden">'
    );
});

// 2. modelado-caja
processFiles([
    'public/supervisor/modelado-caja.html',
    'public/operario/modelado-caja.html'
], (content) => {
    return content.replace(
        '<div class="mb-8 text-left">',
        '<div class="glass-card rounded-[2rem] p-6 lg:p-8 mb-8 text-left border border-white/20 dark:border-white/5 shadow-xl relative overflow-hidden">'
    );
});

// 3. numeros-de-serie
processFiles([
    'public/supervisor/numeros-de-serie.html',
    'public/operario/numeros-de-serie.html'
], (content) => {
    return content.replace(
        '<div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">',
        '<div class="glass-card rounded-[2rem] p-6 lg:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/20 dark:border-white/5 shadow-xl relative overflow-hidden">'
    ).replace(
        '<button id="add-caja-btn" class="hidden md:flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-500/20 hover:-translate-y-1 transition-all">',
        '<button id="add-caja-btn" class="hidden md:flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all">'
    ).replace(
        '<h1 id="model-name-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2">Cargando...</h1>',
        '<h1 id="model-name-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2 uppercase">Cargando...</h1>'
    );
});

