import fs from 'fs';
import path from 'path';

function findFiles(dir, exts) {
  let results = [];
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results = results.concat(findFiles(full, exts));
      } else if (stat.isFile()) {
        if (exts.includes(path.extname(name))) results.push(full);
      }
    }
  } catch (e) {
    // ignore
  }
  return results;
}

function cleanContent(content) {
  const patterns = [
    /console\.(log|info|debug|trace|table|dir|group|assert)\s*\([^;]*\);?/g,
    /console\.(log|info|debug|trace|table|dir|group|assert)\s*\([^\n]*\)\s*\n/g,
  ];
  let cleaned = content;
  for (const p of patterns) cleaned = cleaned.replace(p, '');
  // remove multiple blank lines
  cleaned = cleaned.replace(/\n{2,}/g, '\n\n');
  return cleaned;
}

const targets = [
  path.join(process.cwd(), 'backend', 'dist'),
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), 'frontend', 'dist', 'assets')
];
let modified = 0;
for (const t of targets) {
  if (!fs.existsSync(t)) continue;
  const files = findFiles(t, ['.js', '.mjs', '.cjs']);
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const cleaned = cleanContent(content);
      if (cleaned !== content) {
        fs.writeFileSync(f, cleaned, 'utf8');
        console.log('Cleaned:', path.relative(process.cwd(), f));
        modified++;
      }
    } catch (e) {
      console.error('Error cleaning', f, e.message);
    }
  }
}
console.log(`Done. Modified ${modified} files.`);
