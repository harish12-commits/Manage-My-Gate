const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('.expo') && !full.includes('dist')) {
        results = results.concat(walk(full));
      }
    } else if (full.endsWith('.tsx') || full.endsWith('.ts') || full.endsWith('.jsx') || full.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const baseDir = path.join(__dirname, '..');
const files = walk(baseDir);

const fixedWidthButtons = [];
const headerTitles = [];

files.forEach(f => {
  const rel = path.relative(baseDir, f);
  const content = fs.readFileSync(f, 'utf8');

  // Search for buttons with fixed widths like w-24, w-28, w-32, etc in a row layout
  if ((content.includes('<Button') || content.includes('<TouchableOpacity')) && content.match(/className="[^"]*flex-row[^"]*"/)) {
    if (content.match(/className="[^"]*\bw-(?:20|24|28|32|36|40|48)\b[^"]*"/)) {
      fixedWidthButtons.push(rel);
    }
  }

  if (content.includes('Header') || content.includes('header')) {
    if (content.includes('numberOfLines={1}') && !content.includes('adjustsFontSizeToFit')) {
      headerTitles.push(rel);
    }
  }
});

console.log('Fixed width buttons count:', fixedWidthButtons.length);
console.log('Header titles needing font scaling count:', headerTitles.length);

console.log('\n--- Fixed width button files ---');
console.log(fixedWidthButtons.slice(0, 20).join('\n'));

console.log('\n--- Header title files needing font scaling ---');
console.log(headerTitles.slice(0, 20).join('\n'));
