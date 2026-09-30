const fs = require('fs');

function replaceDashboard(file) {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/\/\(resident\)\/dashboard/g, '/(resident)');
  fs.writeFileSync(file, c);
}

replaceDashboard('mobile/mobile-app/app/(auth)/login.tsx');
replaceDashboard('mobile/mobile-app/app/index.tsx');
console.log('Updated redirects to root home page');
