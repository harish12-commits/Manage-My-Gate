const fs = require('fs');
const file = 'mobile/mobile-app/app/(auth)/login.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/style=\{\{\s*pointerEvents:\s*'none'\s*\}\}/g, 'pointerEvents="none"');

fs.writeFileSync(file, c);
console.log('Reverted pointerEvents in login.tsx');
