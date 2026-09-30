const fs = require('fs');
const file = 'mobile/mobile-app/app/_layout.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(
  /\} else if \(pendingRoute\) \{\s*console\.log\('\[AuthRouteGuard\] Navigating to pending notification destination:', pendingRoute\);\s*dispatch\(clearPendingRoute\(\)\);\s*replaceOnce\(pendingRoute as any\);\s*\}/,
  `} else if (inAuthGroup) {
          if (pendingRoute) dispatch(clearPendingRoute());
          replaceOnce('/(resident)');
        } else if (pendingRoute) {
          console.log('[AuthRouteGuard] Navigating to pending notification destination:', pendingRoute);
          dispatch(clearPendingRoute());
          replaceOnce(pendingRoute as any);
        }`
);

fs.writeFileSync(file, c);
console.log('Patched _layout.tsx to strictly land on home page after auth');
