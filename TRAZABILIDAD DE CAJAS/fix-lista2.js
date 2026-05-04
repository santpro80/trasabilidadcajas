const fs = require('fs');

const file = 'public/operario/lista-items-por-caja.html';
let content = fs.readFileSync(file, 'utf8');

const searchFor = `<div class="mb-8 text-left">
            <h1 id="box-serial-number-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2 uppercase">Cargando...</h1>
            <p class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold">Listado de Ítems en Caja</p>
        </div>

        <div class="flex flex-col md:flex-row items-center gap-4 mb-8 w-full">`;

const fullRegex = /<div class="mb-8 text-left">[\s\S]*?<h1 id="box-serial-number-display"[\s\S]*?<\/div>[\s\S]*?<div class="flex flex-col md:flex-row items-center gap-4 mb-8 w-full">/m;

const match = content.match(fullRegex);
if(match) {
    const replaceWith = `<div class="glass-card rounded-[2.5rem] p-6 lg:p-10 mb-8 border border-white/20 dark:border-white/5 shadow-xl relative overflow-hidden z-10 w-full">
            <div class="mb-8 text-left relative z-20">
                <h1 id="box-serial-number-display" class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2 uppercase">Cargando...</h1>
                <p class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold">Listado de Ítems en Caja</p>
            </div>

            <div class="flex flex-col md:flex-row items-center gap-6 relative z-20 w-full">`;
    content = content.replace(fullRegex, replaceWith);
    
    // Now close the absolute inset.
    // the next line was: `<div class="relative flex-1 w-full">`
    // so we just need to append the absolute div before the closing `</div> <!-- END FLEX -->`
    // Wait, the flex wrapper finishes after the buttons.
    content = content.replace(
        '</button>\n            </div>\n        </div>', 
        '</button>\n            </div>\n        </div>\n            <div class="absolute inset-0 bg-gradient-to-r from-villalba-blue/0 to-villalba-blue/5 opacity-10 transition-opacity"></div>\n        </div>'
    );
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed operario');
} else {
    console.log('Not found');
}
