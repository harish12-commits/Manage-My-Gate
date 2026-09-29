/**
 * Per-suite setup for the mobile → backend E2E suite.
 * Mocks stop at native/platform boundaries; everything app-level runs for real.
 */

// ── Secure storage: in-memory, per suite (replaces jest.setup's constant-token mock) ──
jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    isAvailableAsync: jest.fn(async () => true),
    getItemAsync: jest.fn(async (k: string) => (mem.has(k) ? mem.get(k) : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      mem.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      mem.delete(k);
    }),
  };
});

// ── Router: records navigation so tests can assert on it ──
jest.mock('expo-router', () => {
  const React = require('react');
  const nav: { params: any; calls: any[]; redirects: any[] } = { params: {}, calls: [], redirects: [] };
  (globalThis as any).__e2eNav = nav;
  const record = (method: string) => jest.fn((...args: any[]) => nav.calls.push({ method, args }));
  const router = {
    push: record('push'),
    replace: record('replace'),
    navigate: record('navigate'),
    back: record('back'),
    dismiss: record('dismiss'),
    dismissAll: record('dismissAll'),
    setParams: record('setParams'),
    canGoBack: jest.fn(() => true),
  };
  const Passthrough = ({ children }: any) => children ?? null;
  const Stack: any = Passthrough;
  Stack.Screen = () => null;
  const Tabs: any = Passthrough;
  Tabs.Screen = () => null;
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: () => nav.params,
    useGlobalSearchParams: () => nav.params,
    useSegments: () => [],
    usePathname: () => '/',
    useNavigation: () => ({ setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()), goBack: router.back }),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, []),
    Redirect: ({ href }: any) => {
      nav.redirects.push(href);
      return null;
    },
    Link: Passthrough,
    Stack,
    Tabs,
  };
});

// ── Camera: tests "scan" by calling simulateScan() from e2e/helpers/camera ──
jest.mock('expo-camera', () => {
  const camera: { onBarcodeScanned: any } = { onBarcodeScanned: null };
  (globalThis as any).__e2eCamera = camera;
  const CameraView = (props: any) => {
    camera.onBarcodeScanned = props.onBarcodeScanned || null;
    return null;
  };
  return {
    CameraView,
    Camera: CameraView,
    useCameraPermissions: () => [{ granted: true, status: 'granted', canAskAgain: true }, jest.fn(async () => ({ granted: true }))],
  };
});

// ── WebView (payment checkout page): native; tests complete checkout by calling the
//    modal's onSuccess with a gateway response, exactly as the WebView bridge does ──
jest.mock('react-native-webview', () => ({ WebView: () => null, default: () => null }));

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

// ── Animation runtime: render final styles synchronously ──
jest.mock('react-native-worklets', () => ({
  isWorkletFunction: jest.fn(() => false),
  createWorkletRuntime: jest.fn(),
  runOnJS: jest.fn((fn: any) => fn),
  runOnUI: jest.fn((fn: any) => fn),
  scheduleOnUI: jest.fn((fn: any) => fn),
  scheduleOnRN: jest.fn((fn: any, ...args: any[]) => fn(...args)),
  createSerializable: jest.fn((val: any) => val),
  serializableMappingCache: new Map(),
  makeShareable: jest.fn((val: any) => val),
  makeMutable: jest.fn((val: any) => ({ value: val })),
}));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  return {
    ...Reanimated,
    useAnimatedStyle: (fn: any) => (typeof fn === 'function' ? fn() : {}),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[0],
  };
});

// ── Modal: render children inline while visible ──
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const { View } = require('react-native');
  const MockModal = ({ children, visible, testID }: any) =>
    visible ? <View testID={testID || 'mock-modal'}>{children}</View> : null;
  MockModal.displayName = 'Modal';
  return { __esModule: true, default: MockModal };
});

// ── App shell chrome outside the visitor module ──
jest.mock('@/components/navigation/BottomNavigationBar', () => ({ BottomNavigationBar: () => null }));
jest.mock('@/components/navigation/RoleSwitchModal', () => ({ RoleSwitchModal: () => null }));
jest.mock('@/components/navigation/VillaSwitchModal', () => ({ VillaSwitchModal: () => null }));

// ── Record every real API exchange made through the app's apiClient ──
// Recorded at the adapter (transport) level: the app's own response interceptor unwraps
// responses, so interceptors registered here would never see the raw exchange.
import axios from 'axios';
import apiClient from '@/src/services/apiClient';
import { setDefaultPhoneCountry } from '@/src/utils/phone';

// Seeded communities are Indian; pin the phone default so bare numbers read as +91 regardless of host locale.
setDefaultPhoneCountry('IN');
import { resetApiLog, recordApiExchange } from '../helpers/api';

// Under jest-expo axios resolves its browser build, so requests go through Node's global
// fetch. Disable connection reuse so a socket idled out by the backend is never replayed.
require('./httpNoReuse');
const transport = axios.getAdapter(apiClient.defaults.adapter);
apiClient.defaults.adapter = async (config) => {
  try {
    const response = await transport(config);
    recordApiExchange(config, response.status, response.data);
    return response;
  } catch (error: any) {
    recordApiExchange(config, error.response?.status ?? 0, error.response?.data ?? error.message);
    throw error;
  }
};

beforeEach(() => {
  resetApiLog();
  const nav = (globalThis as any).__e2eNav;
  if (nav) {
    nav.calls.length = 0;
    nav.redirects.length = 0;
    nav.params = {};
  }
});
