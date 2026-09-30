const fs = require('fs');
const file = 'mobile/mobile-app/app/(auth)/login.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/\} else if \(pendingRoute\) \{\s*return;\s*\}/, '');
c = c.replace(/const pendingRoute = useSelector[\s\S]*?;/, '');

fs.writeFileSync(file, c);
console.log('Removed pendingRoute logic from login.tsx');
