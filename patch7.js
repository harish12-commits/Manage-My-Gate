const fs = require('fs');
const file = 'mobile/mobile-app/app/(auth)/login.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/router\.replace\(\{ pathname: '\/\(auth\)\/setup-organization', params: \{ intent: 'create-org' \} \}\);\s*else \{/g, `router.replace({ pathname: '/(auth)/setup-organization', params: { intent: 'create-org' } });\n        } else {`);

fs.writeFileSync(file, c);
console.log('Fixed syntax error in login.tsx');
