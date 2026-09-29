import { LogBox } from 'react-native';

const IGNORED_WARNINGS = [
  'Listening to push token changes is not yet fully supported on web',
  'props.pointerEvents is deprecated. Use style.pointerEvents',
  '"shadow*" style props are deprecated. Use "boxShadow"',
  'Unknown event handler property',
  'TouchableMixin is deprecated. Please use Pressable.',
  'Animated: `useNativeDriver` is not supported',
  'Reduced motion setting is enabled on this device',
  '[Reanimated] Reading from `value` during component render',
  '[Reanimated] Writing to `value` during component render'
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
};
