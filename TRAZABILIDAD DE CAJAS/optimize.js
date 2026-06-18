const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const htmlFiles = walkSync(path.join(__dirname, 'public')).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Remove Tailwind CDN and config
  const tailwindRegex = /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>\s*tailwind\.config[\s\S]*?<\/script>/;
  
  if (tailwindRegex.test(content)) {
    // Determine relative path for CSS
    const relativePathToPublic = path.relative(path.dirname(file), path.join(__dirname, 'public'));
    const cssPath = relativePathToPublic === '' ? './css/tailwind.css' : `${relativePathToPublic.replace(/\\/g, '/')}/css/tailwind.css`;
    
    content = content.replace(tailwindRegex, `<link rel="stylesheet" href="${cssPath}">`);
    changed = true;
  }

  // 2. Preconnect to fonts
  if (!content.includes('<link rel="preconnect" href="https://fonts.googleapis.com">')) {
    content = content.replace('<head>', `<head>\n    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`);
    changed = true;
  }

  // 3. Defer model-viewer if present and not dynamically loaded
  // Actually, we'll just leave model-viewer alone if it's too risky to break it right now.
  // We can add display=swap to material symbols
  if (content.includes('Material+Symbols+Outlined') && !content.includes('&display=swap')) {
    content = content.replace(/family=Material\+Symbols\+Outlined([^"']*)["']/, 'family=Material+Symbols+Outlined$1&display=swap"');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Optimized ${file}`);
  }
});
