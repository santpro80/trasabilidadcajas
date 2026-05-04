const fs = require('fs');
const path = require('path');

function processDirectory(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const fullPath = path.join(directory, item);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');

            if (!content.includes('fadeInMenu') && content.includes('<style>')) {
                // Insert right before </style> to ensure it gets applied
                const injection = `
        body {
            opacity: 0;
            animation: fadeInMenu 0.4s ease forwards;
            animation-delay: 0.15s;
        }

        @keyframes fadeInMenu {
            to { opacity: 1; }
        }
    \n</style>`;
                content = content.replace('</style>', injection);
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('FOUC protection applied to:', fullPath);
            }
        }
    }
}

// Empezar en carpeta public
processDirectory(path.join(__dirname, 'public'));
console.log('Script finalizado');
