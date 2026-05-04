const fs = require('fs');

const files = [
    'public/supervisor/menu.html',
    'public/operario/menu.html',
    'public/mantenimiento/menu.html'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Make CSS responsive
    const oldStyleBody = `        body {
            margin: 0;
            min-height: 100vh;
            background-color: #0a0f16;
            color: #f1f5f9;
            opacity: 0;
            animation: fadeInMenu 0.4s ease forwards;
            animation-delay: 0.15s;
        }`;

    const newStyleBody = `        body {
            margin: 0;
            min-height: 100vh;
            background-color: #f8fafc; /* Lighter background */
            color: #0f172a; /* Dark text */
            opacity: 0;
            animation: fadeInMenu 0.4s ease forwards;
            animation-delay: 0.15s;
        }

        html.dark body {
            background-color: #0a0f16;
            color: #f1f5f9;
        }`;

    const oldStyleCard = `.glass-card {
            background: rgba(22, 30, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(12px);
        }`;

    const newStyleCard = `.glass-card {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(12px);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
        }

        html.dark .glass-card {
            background: rgba(22, 30, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: none;
        }`;

    if (content.includes(oldStyleBody)) {
        content = content.replace(oldStyleBody, newStyleBody);
    }

    if (content.includes(oldStyleCard)) {
        content = content.replace(oldStyleCard, newStyleCard);
    }

    // Replace Tailwind classes for light mode
    if (!content.includes('dark:text-white')) {
        content = content.replace(/text-white/g, 'text-slate-900 dark:text-white');
    }
    if (!content.includes('dark:text-slate-400')) {
        content = content.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
    }
    if (!content.includes('dark:border-white\\/10')) {
        content = content.replace(/border-white\/10/g, 'border-slate-200 dark:border-white/10');
    }
    if (!content.includes('dark:hover:bg-slate-800')) {
        content = content.replace(/hover:bg-slate-800/g, 'hover:bg-slate-100 dark:hover:bg-slate-800');
    }
    if (!content.includes('dark:text-slate-300')) {
        content = content.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
    }

    // Some specific cases like the background colors of the left icons
    // Some buttons have text-rose-100, etc. that can stay as is (they are inside coloured buttons).

    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
}
