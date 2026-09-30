jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {
    ...actual,
    requireNativeModule: jest.fn((name) => {
      if (name === 'ExpoFetchModule') {
        return {
          NativeResponse: class NativeResponse {},
          NativeRequest: class NativeRequest {},
        };
      }
      return {};
    }),
  };
});

// Global Mocks for Jest environment
jest.mock('react-native-worklets', () => ({
  isWorkletFunction: jest.fn(() => false),
  createWorkletRuntime: jest.fn(),
  runOnJS: jest.fn((fn) => fn),
  runOnUI: jest.fn((fn) => fn),
  scheduleOnUI: jest.fn((fn) => fn),
  createSerializable: jest.fn((val) => val),
  serializableMappingCache: new Map(),
}));
require('react-native-reanimated/mock');

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:5002/api/v1',
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn().mockResolvedValue('mock-secure-token'),
  setItemAsync: jest.fn().mockResolvedValue(true),
  deleteItemAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('burnt', () => ({
  toast: jest.fn(),
  alert: jest.fn(),
}));

jest.mock('lucide-react-native', () => {
  const MockIcon = () => null;
  return new Proxy({}, { get: () => MockIcon });
});

// WebView (payment checkout page) is native; screens that can open checkout render it.
jest.mock('react-native-webview', () => ({ WebView: () => null, default: () => null }));

// expo-file-system's File/Directory/Paths extend native classes that don't exist under Jest;
// importing it un-mocked throws "Super expression must either be null or a function".
// Individual tests can still jest.mock() it with their own behaviour.
jest.mock('expo-file-system', () => {
  class File {
    constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || String(p)).join('/'); this.exists = false; }
    create() {} write() {} delete() {} text() { return Promise.resolve(''); } base64() { return Promise.resolve(''); }
  }
  class Directory {
    constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || String(p)).join('/'); this.exists = true; }
    create() {} delete() {}
  }
  return { File, Directory, Paths: { cache: new Directory('cache'), document: new Directory('document') } };
});
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///document/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  downloadAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/download' }),
}));
