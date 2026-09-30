const fs = require('fs');
const file = 'mobile/mobile-app/app/_layout.tsx';
let c = fs.readFileSync(file, 'utf8');

const replacement = `const IGNORED_WARNINGS = [
  'Listening to push token changes is not yet fully supported on web',
  'props.pointerEvents is deprecated. Use style.pointerEvents',
  '"shadow*" style props are deprecated. Use "boxShadow"',
  'Unknown event handler property',
  'TouchableMixin is deprecated. Please use Pressable.',
  'Animated: \`useNativeDriver\` is not supported'
];

LogBox.ignoreLogs(IGNORED_WARNINGS);

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && IGNORED_WARNINGS.some(w => args[0].includes(w))) return;
  originalConsoleWarn(...args);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && IGNORED_WARNINGS.some(w => args[0].includes(w))) return;
  originalConsoleError(...args);
};`;

c = c.replace(/LogBox\.ignoreLogs\(\[[\s\S]*?\]\);/, replacement);

fs.writeFileSync(file, c);
console.log('Replaced console log overrides.');
