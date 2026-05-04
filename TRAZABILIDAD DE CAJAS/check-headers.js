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
            checkHeader(fullPath);
        }
    }
}

function checkHeader(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if it has a header or .app-header
    if ((content.includes('<header') || content.includes('class="app-header"')) && !content.includes('class="header-left"')) {
        console.log(`Missing header-left wrapper in -> ${filePath}`);
    }
}

processDirectory(publicDir);
console.log("Header check complete.");
