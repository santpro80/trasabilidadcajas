const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function processDirectory(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const fullPath = path.join(directory, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (item !== 'pedidos-internos' && item !== 'node_modules') {
                processDirectory(fullPath);
            }
        } else if (stat.isFile() && item.endsWith('.html')) {
            fixHeader(fullPath);
        }
    }
}

function fixHeader(filePath) {
    if (filePath.includes('Untitled-1.html')) return; // Skip temp files

    let content = fs.readFileSync(filePath, 'utf8');

    // Pattern 1: <header> ... <h1> ... </h1>
    const headerMatch = content.match(/<header>([\s\S]*?)(<h1[\s\S]*?<\/h1>)/);
    // Pattern 2: <div class="app-header"> ... <h1> ... </h1>
    const appHeaderMatch = content.match(/class="app-header">([\s\S]*?)(<h1[\s\S]*?<\/h1>)/);

    if (!content.includes('class="header-left"')) {
        if (headerMatch) {
            const beforeH1 = headerMatch[1];
            const h1Tag = headerMatch[2];
            const newHeaderContent = `<header>${beforeH1}<div class="header-left">${h1Tag}</div>`;
            content = content.replace(/<header>[\s\S]*?<h1[\s\S]*?<\/h1>/, newHeaderContent);
            console.log(`Wrapped header in -> ${path.basename(filePath)}`);
        } else if (appHeaderMatch) {
            const beforeH1 = appHeaderMatch[1];
            const h1Tag = appHeaderMatch[2];
            const newHeaderContent = `class="app-header">${beforeH1}<div class="header-left">${h1Tag}</div>`;
            content = content.replace(/class="app-header">[\s\S]*?<h1[\s\S]*?<\/h1>/, newHeaderContent);
            console.log(`Wrapped app-header in -> ${path.basename(filePath)}`);
        }

        fs.writeFileSync(filePath, content, 'utf8');
    }
}

processDirectory(publicDir);
console.log("Global header wrap complete.");
