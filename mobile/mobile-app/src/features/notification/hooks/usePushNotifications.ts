import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import Constants from 'expo-constants';
let Notifications: any = null;
try { if (Constants.appOwnership !== 'expo') { Notifications = require('expo-notifications'); } } catch(e) {}
import * as Device from 'expo-device';
import { useAuth } from '../../auth/hooks/useAuth';
import { registerForPushNotificationsAsync } from '../services/pushNotificationService';
import deviceTokenService from '../services/deviceTokenService';
import {
  resolveNotificationRoute,
  isDuplicateNotification,
} from '../utils/notificationNavigation';
import {
  setPendingRoute,
  setLastHandledNotificationId,
  addRealTimeNotification,
} from '../store/notificationSlice';

/**
 * Custom hook to register, manage, and handle push notifications for the authenticated user.
 * Supports Cold-Start resolution, background/foreground tap handling, and race-condition prevention.
 */
export function usePushNotifications() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useAuth();
  const currentTokenRef = useRef<string | null>(null);
  const notificationListenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);
  const coldStartCheckedRef = useRef(false);

  const userId = user?.id || (user as any)?._id;

  // 1. Asynchronous Token Registration & Lifecycle Management
  useEffect(() => {
    let isMounted = true;

    async function initializePush() {
      if (!isAuthenticated || !userId) return;

      try {
        const token = await registerForPushNotificationsAsync();
        if (!token || !isMounted) return;

        currentTokenRef.current = token;

        // Register token with backend database (caches locally to avoid duplicate calls)
        await deviceTokenService.registerToken(
          {
            pushToken: token,
            platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
            deviceId: Device.osBuildId || Device.osInternalBuildId || undefined,
            deviceModel: Device.modelName || undefined,
          },
          userId
        );

        console.log('[usePushNotifications] Push token active & synced with backend');
      } catch (err) {
        console.warn('[usePushNotifications] Failed to initialize push notifications:', err);
      }
    }

    if (isAuthenticated) {
      initializePush();
    } else if (currentTokenRef.current) {
      // Unregister token on logout
      const tokenToUnregister = currentTokenRef.current;
      currentTokenRef.current = null;
      deviceTokenService.unregisterToken(tokenToUnregister, userId).catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, userId]);

  // 2. Cold-Start Check: Detect if application was launched by tapping a notification
  useEffect(() => {
    if (Platform.OS === 'web' || coldStartCheckedRef.current) return;
    coldStartCheckedRef.current = true;

    async function checkColdStartNotification() {
      try {
        const lastResponse = await Notifications?.getLastNotificationResponseAsync();
        if (!lastResponse) return;

        const data = lastResponse.notification?.request?.content?.data;
        const notifId = data?.notificationId || lastResponse.notification?.request?.identifier;

        if (isDuplicateNotification(notifId)) return;

        console.log('[usePushNotifications] Cold start notification tap detected:', { notifId, data });
        const targetRoute = resolveNotificationRoute(data);

        dispatch(setPendingRoute(targetRoute));
        dispatch(setLastHandledNotificationId(notifId));
      } catch (err) {
        console.warn('[usePushNotifications] Error checking cold start notification:', err);
      }
    }

    checkColdStartNotification();
  }, [dispatch]);

  // 3. Foreground & Background Notification Listeners
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // A. Received while app is in foreground
    notificationListenerRef.current = Notifications?.addNotificationReceivedListener((notification: any) => {
      console.log('[usePushNotifications] Foreground notification received by Android system:', notification?.request?.content?.title);
      const content = notification?.request?.content;
      const data = content?.data || {};
      const notifId = data?.notificationId || notification?.request?.identifier;
      if (notifId && isDuplicateNotification(notifId)) return;

      const formattedNotification: any = {
        id: notifId,
        _id: notifId,
        title: content?.title || 'Nahom Alert',
        body: content?.body || '',
        type: data?.type || 'INFO',
        actionUrl: data?.actionUrl || null,
        metadata: data,
        createdAt: data?.createdAt || new Date().toISOString(),
        isRead: false,
      };
      dispatch(addRealTimeNotification(formattedNotification));
    });

    // B. User tapped notification while app was running or in background
    responseListenerRef.current = Notifications?.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      const notifId = data?.notificationId || response?.notification?.request?.identifier;

      if (isDuplicateNotification(notifId)) return;

      console.log('[usePushNotifications] Notification response tapped with data:', { notifId, data });
      const targetRoute = resolveNotificationRoute(data);

      dispatch(setLastHandledNotificationId(notifId));
      dispatch(setPendingRoute(targetRoute));

      if (!isAuthenticated) {
        console.log('[usePushNotifications] User unauthenticated; queued pending route:', targetRoute);
      }
    });

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
    };
  }, [isAuthenticated, dispatch]);
}

export default usePushNotifications;



