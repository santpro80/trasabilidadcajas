const fs = require('fs');
const path = require('path');

const files = [
    'public/supervisor/menu.html',
    'public/operario/menu.html',
    'public/mantenimiento/menu.html'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Remove background-color and color from <style> blocks
    content = content.replace(/background-color:\s*#[a-f0-9A-F]+(\s*\/\*.*?\*\/)?;/g, '');
    content = content.replace(/color:\s*#[a-f0-9A-F]+(\s*\/\*.*?\*\/)?;/g, '');

    // Remove the html.dark body CSS block now that it's empty
    content = content.replace(/html\.dark\s*body\s*\{[\s\n]*\}/g, '');
    content = content.replace(/\/\*\s*Cuando la etiqueta HTML.*?\*\//g, '');

    // 2. Add Tailwind classes to body
    content = content.replace(
        /<body([^>]*)>/i,
        (match, capture) => {
            let inner = capture;
            // Extract the class attribute
            let classMatch = inner.match(/class=(['"])(.*?)\1/i);
            let currentClasses = classMatch ? classMatch[2] : '';

            // Remove previous exact class definitions
            currentClasses = currentClasses.replace(/bg-slate-50/g, '')
                .replace(/bg-\[#0a0f16\]/g, '')
                .replace(/text-slate-900/g, '')
                .replace(/text-\[#f1f5f9\]/g, '')
                .replace(/dark:bg-\[#0a0f16\]/g, '')
                .replace(/dark:text-\[#f1f5f9\]/g, '')
                .replace(/antialiased/g, '')
                .replace(/font-sans/g, '');

            let newClasses = 'bg-slate-50 dark:bg-[#0a0f16] text-slate-900 dark:text-[#f1f5f9] antialiased font-sans ' + currentClasses.trim();

            if (classMatch) {
                inner = inner.replace(classMatch[0], `class="${newClasses.trim()}"`);
            } else {
                inner += ` class="${newClasses.trim()}"`;
            }

            return `<body${inner}>`;
        }
    );

    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed body classes in', file);
}

// 3. Update global-sidebar.js background logic
let sidebarPath = 'public/js/global-sidebar.js';
let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
if (sidebarContent.includes('bg-[#161e2a]')) {
    sidebarContent = sidebarContent.replace(/bg-\[#161e2a\]/g, 'bg-slate-50 dark:bg-[#161e2a]');
    fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
    console.log('Fixed global-sidebar.js drawer background');
}

// 4. Update the hamburger button and text colors in the sidebar if needed
// "text-slate-100" -> "text-slate-900 dark:text-slate-100"
if (!sidebarContent.includes('dark:text-slate-100')) {
    sidebarContent = sidebarContent.replace(/text-slate-100/g, 'text-slate-900 dark:text-slate-100');
    fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');
    console.log('Fixed global-sidebar.js text color');
}
