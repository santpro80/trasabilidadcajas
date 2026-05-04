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
            updateMaxWidth(fullPath);
        }
    }
}

function updateMaxWidth(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace max-width: 800px with max-width: 1200px
    const newContent = content.replace(/max-width:\s*800px/g, 'max-width: 1200px');

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated width -> ${filePath}`);
    }
}

processDirectory(publicDir);
console.log("All widths updated.");
