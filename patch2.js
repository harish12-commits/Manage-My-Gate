const fs = require('fs');
const file = 'mobile/mobile-app/app/(auth)/login.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/pointerEvents:\s*'none',/g, '');
c = c.replace(/<\/Animated\.View>/g, '</Animated.View>'); 
c = c.replace(/backgroundColor:\s*'rgba\(255, 255, 255, 0\.28\)',\s*\}\}/g, 'backgroundColor: \'rgba(255, 255, 255, 0.28)\', }}\n                          pointerEvents="none"');

fs.writeFileSync(file, c);
console.log('Fixed pointerEvents on buttons');
