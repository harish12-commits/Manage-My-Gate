import { configureStore } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import authReducer, { bootstrapAuth, loginUser, verifyOtpLogin } from '../store/authSlice';
import authService from '../services/authService';
import storage from '../../../utils/storage';

jest.mock('../services/authService', () => ({
  __esModule: true,
  default: { login: jest.fn(), verifyPhoneLogin: jest.fn(), switchContext: jest.fn() },
}));

const createStore = () => configureStore({ reducer: { auth: authReducer } });
const originalPlatform = Platform.OS;
const response = { success: true, data: { token: 'test-token', refreshToken: 'test-refresh', user: { id: 'user-1', name: 'Test User' } } };

afterAll(() => { Platform.OS = originalPlatform; });

describe.each(['ios', 'android'] as const)('%s session preference', (platform) => {
  beforeEach(async () => {
    Platform.OS = platform;
    for (const key of ['token', 'refreshToken', 'user', 'keep_signed_in']) await storage.removeItem(key);
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    (authService.login as jest.Mock).mockResolvedValue(response);
    (authService.verifyPhoneLogin as jest.Mock).mockResolvedValue(response);
    (authService.switchContext as jest.Mock).mockResolvedValue(undefined);
  });

  it.each(['password', 'otp'])('restores a saved %s session when enabled', async (method) => {
    await storage.setItem('keep_signed_in', 'true');
    const store = createStore();
    if (method === 'password') await store.dispatch(loginUser({ login: 'test@example.com', password: 'password' }));
    else await store.dispatch(verifyOtpLogin({ identifier: '+15555550123', code: '123456', isEmail: false }));
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('token', 'test-token');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refreshToken', 'test-refresh');
    const reopenedStore = createStore();
    await reopenedStore.dispatch(bootstrapAuth());
    expect(reopenedStore.getState().auth.isAuthenticated).toBe(true);
    expect(reopenedStore.getState().auth.user?.id).toBe('user-1');
  });

  it.each(['password', 'otp'])('clears a %s session at startup when disabled', async (method) => {
    await storage.setItem('keep_signed_in', 'false');
    const store = createStore();
    if (method === 'password') await store.dispatch(loginUser({ login: 'test@example.com', password: 'password' }));
    else await store.dispatch(verifyOtpLogin({ identifier: '+15555550123', code: '123456', isEmail: false }));
    expect(store.getState().auth.isAuthenticated).toBe(true);
    const reopenedStore = createStore();
    await reopenedStore.dispatch(bootstrapAuth());
    expect(reopenedStore.getState().auth.isAuthenticated).toBe(false);
    for (const key of ['token', 'refreshToken', 'user']) {
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      expect(await storage.getItem(key)).toBeNull();
    }
    expect(authService.switchContext).not.toHaveBeenCalled();
  });
});
