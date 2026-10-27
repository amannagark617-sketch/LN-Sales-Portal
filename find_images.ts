import fs from 'fs';
import path from 'path';

function walk(dir: string) {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('dist')) {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

try {
  console.log('--- SEARCHING WORKSPACE FOR IMAGES ---');
  const images = walk('.');
  console.log('Found images:', images);
} catch (err) {
  console.error('Error scanning:', err);
}
