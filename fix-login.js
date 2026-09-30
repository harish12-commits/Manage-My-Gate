const fs = require('fs');
let c = fs.readFileSync('mobile/mobile-app/app/(auth)/login.tsx', 'utf8');

c = c.replace(/pointerEvents="none"\s*>/g, 'style={{ pointerEvents: \'none\' }}\n          >');
c = c.replace(/<View className="absolute inset-0 bg-black\/20 dark:bg-black\/45" pointerEvents="none" \/>/g, '<View className="absolute inset-0 bg-black/20 dark:bg-black/45" style={{ pointerEvents: \'none\' }} />');
c = c.replace(/backgroundColor:\s*'rgba\(255,\s*255,\s*255,\s*0\.28\)',\s*}}\s*pointerEvents="none"/g, "backgroundColor: 'rgba(255, 255, 255, 0.28)',\n                              pointerEvents: 'none',\n                            }}");

fs.writeFileSync('mobile/mobile-app/app/(auth)/login.tsx', c);
