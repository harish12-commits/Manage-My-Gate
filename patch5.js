const fs = require('fs');
const file = 'mobile/mobile-app/app/(auth)/login.tsx';
let c = fs.readFileSync(file, 'utf8');

if (!c.includes('clearPendingRoute')) {
  c = c.replace(/import \{ useDispatch, useSelector \} from 'react-redux';/, "import { useDispatch, useSelector } from 'react-redux';\nimport { clearPendingRoute } from '@/src/features/notification/store/notificationSlice';");
}

c = c.replace(/if \(isCreateOrgIntent \|\| !hasOrg\) \{/, "dispatch(clearPendingRoute());\n        if (isCreateOrgIntent || !hasOrg) {");

fs.writeFileSync(file, c);
console.log('Added clearPendingRoute to login.tsx');
