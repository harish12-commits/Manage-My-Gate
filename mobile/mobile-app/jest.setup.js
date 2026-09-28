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

jest.mock('react-native-svg', () => {
  const React = require('react');
  const createMockComponent = (name) => {
    const Component = (props) => React.createElement(name, props, props.children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: createMockComponent('Svg'),
    Svg: createMockComponent('Svg'),
    Circle: createMockComponent('Circle'),
    Ellipse: createMockComponent('Ellipse'),
    G: createMockComponent('G'),
    Text: createMockComponent('Text'),
    TSpan: createMockComponent('TSpan'),
    TextPath: createMockComponent('TextPath'),
    Path: createMockComponent('Path'),
    Polygon: createMockComponent('Polygon'),
    Polyline: createMockComponent('Polyline'),
    Line: createMockComponent('Line'),
    Rect: createMockComponent('Rect'),
    Use: createMockComponent('Use'),
    Image: createMockComponent('Image'),
    Symbol: createMockComponent('Symbol'),
    Defs: createMockComponent('Defs'),
    LinearGradient: createMockComponent('LinearGradient'),
    RadialGradient: createMockComponent('RadialGradient'),
    Stop: createMockComponent('Stop'),
    ClipPath: createMockComponent('ClipPath'),
    Pattern: createMockComponent('Pattern'),
    Mask: createMockComponent('Mask'),
  };
});

