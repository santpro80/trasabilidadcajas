const fs = require('fs');
const supPath = 'public/supervisor/lista-items-por-caja.html';
const opPath = 'public/operario/lista-items-por-caja.html';

const supContent = fs.readFileSync(supPath, 'utf8');
let opContent = fs.readFileSync(opPath, 'utf8');

const mainRegex = /<main [\s\S]*?<\/main>/m;
const supMainMatch = supContent.match(mainRegex);

if (supMainMatch && opContent.match(mainRegex)) {
    let newOpMain = supMainMatch[0];
    // Remove the Reporte button for Operario
    newOpMain = newOpMain.replace(
        /<button id="download-pdf-btn"[\s\S]*?<\/button>/m,
        ''
    );
    
    opContent = opContent.replace(mainRegex, newOpMain);
    fs.writeFileSync(opPath, opContent, 'utf8');
    console.log('Synchronized Operario HTML');
}
