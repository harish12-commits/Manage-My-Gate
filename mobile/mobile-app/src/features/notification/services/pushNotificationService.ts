import { Platform } from 'react-native';
let Notifications: any = null;
try { if (Constants.appOwnership !== 'expo') { Notifications = require('expo-notifications'); } } catch(e) {}
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import storage from '../../../utils/storage';

// Configure how incoming notifications are handled when the app is in the foreground
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications?.AndroidNotificationPriority.MAX,
  }),
});

let channelsInitialized = false;

/**
 * Configure Android notification channels with high priority, appropriate sounds, and vibrations.
 * Uses stable channel IDs matching backend dispatch rules.
 */
export async function setupAndroidNotificationChannels() {
  if (Platform.OS !== 'android' || channelsInitialized) {
    return;
  }

  try {
    // 1. General & Community Announcements
    await Notifications?.setNotificationChannelAsync('general', {
      name: 'General Community Alerts',
      description: 'Standard notices, announcements, and system alerts',
      importance: Notifications?.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6A00',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 2. Default alias for backwards compatibility
    await Notifications?.setNotificationChannelAsync('default', {
      name: 'General Alerts',
      description: 'Default community and system alerts',
      importance: Notifications?.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 3. Visitor Management & Gate Approvals (MAX importance for urgent approvals)
    await Notifications?.setNotificationChannelAsync('visitors', {
      name: 'Visitor & Gate Requests',
      description: 'Urgent gate approvals, visitor check-ins, and guest arrivals',
      importance: Notifications?.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#2563EB',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 4. Billing, Invoices & Maintenance Payments
    await Notifications?.setNotificationChannelAsync('billing', {
      name: 'Billing & Payment Reminders',
      description: 'Alerts regarding invoices, maintenance dues, and payment confirmations',
      importance: Notifications?.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 5. Complaints & Maintenance Issues
    await Notifications?.setNotificationChannelAsync('complaints', {
      name: 'Complaints & Maintenance',
      description: 'Maintenance tickets, technician assignments, and issue resolutions',
      importance: Notifications?.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 6. Resident & Community Messages
    await Notifications?.setNotificationChannelAsync('messages', {
      name: 'Community Messages',
      description: 'Direct communications between residents, guards, and community admins',
      importance: Notifications?.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    // 7. Community & Workspace Invitations (MAX importance for urgent access decisions)
    await Notifications?.setNotificationChannelAsync('invitations', {
      name: 'Invitations & Access Approvals',
      description: 'Community invitations requiring acceptance or decline',
      importance: Notifications?.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#2563EB',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
    });

    channelsInitialized = true;
    console.log('[PushNotificationService] Android notification channels successfully configured');
  } catch (error) {
    console.warn('[PushNotificationService] Error setting up Android notification channels:', error);
  }
}

export type NotificationPermissionsStatus = Awaited<ReturnType<any>>;

/**
 * Check current notification permissions without prompting user.
 */
export async function checkNotificationPermissions(): Promise<NotificationPermissionsStatus | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await Notifications?.getPermissionsAsync();
  } catch (error) {
    console.warn('[PushNotificationService] Error checking permissions:', error);
    return null;
  }
}

/**
 * Request notification permissions from user, respecting previous denials to avoid nagging.
 * @param forcePrompt - If true, bypasses the previous request check.
 */
export async function requestNotificationPermissionsAsync(forcePrompt = false): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;

    const currentStatus = await Notifications?.getPermissionsAsync();
    if (currentStatus?.status === 'granted') {
      return true;
    }

    const alreadyRequested = await storage.getItem('notification_permission_requested');
    if (!forcePrompt && alreadyRequested === 'true' && currentStatus?.status === 'denied' && !currentStatus?.canAskAgain) {
      console.log('[PushNotificationService] Notification permission previously denied and cannot ask again without settings change.');
      return false;
    }

    await storage.setItem('notification_permission_requested', 'true');
    const result = await Notifications?.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }); const status = result?.status; console.log('[PushNotificationService] Permission request result:', status);
    return status === 'granted';
  } catch (error) {
    console.warn('[PushNotificationService] Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Request notification permissions and fetch the unique Expo push token.
 * Returns null if running on a simulator/emulator without push support or if permission is denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // console.log('[PushNotificationService] Push notifications not supported on Web target');
      return null;
    }

    await setupAndroidNotificationChannels();

    if (!Device.isDevice) {
      console.log('[PushNotificationService] Running on simulator/emulator; returning dev placeholder token.');
      return 'ExponentPushToken[SIMULATOR_DEV_TOKEN_MANAGE_MY_GATE]';
    }

    const isGranted = await requestNotificationPermissionsAsync(false);
    if (!isGranted) {
      console.log('[PushNotificationService] Notification permission not granted; push notifications inactive.');
      return null;
    }

    // Resolve projectId from expo constants if available
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications?.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    console.log('[PushNotificationService] Acquired Expo Push Token:', tokenData?.data);
    return tokenData?.data;
  } catch (error) {
    console.warn('[PushNotificationService] Failed to get Expo push token:', error);
    return null;
  }
}

export default {
  setupAndroidNotificationChannels,
  checkNotificationPermissions,
  requestNotificationPermissionsAsync,
  registerForPushNotificationsAsync,
};






