import fs from 'fs';
import path from 'path';

function searchDir(dir: string, depth: number = 0) {
  if (depth > 4) return;
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (!file.includes('node_modules') && !file.includes('.git')) {
            searchDir(fullPath, depth + 1);
          }
        } else {
          if (file.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i) || file.includes('logo') || file.includes('image')) {
            console.log(`FOUND FILE: [${fullPath}] - size: ${stat.size} bytes`);
          }
        }
      } catch (e) {}
    });
  } catch (err) {}
}

console.log('--- SEARCHING EXTERNAL SYSTEM PATHS ---');
searchDir('/tmp');
searchDir('..');
console.log('--- DONE ---');
