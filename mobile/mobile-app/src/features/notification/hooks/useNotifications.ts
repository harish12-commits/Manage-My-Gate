import { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../store/store';
import { useAppSocket } from '../../../hooks/useAppSocket';
import { useAuth } from '../../auth/hooks/useAuth';
import {
  fetchNotificationsThunk,
  markAsReadThunk,
  markAllAsReadThunk,
  deleteNotificationThunk,
  addRealTimeNotification,
  clearLatestNotification,
} from '../store/notificationSlice';

let activeNotificationListenersCount = 0;
let activeIncomingNotificationHandler: ((notification: any) => void) | null = null;

export const useNotifications = () => {
  const dispatch = useDispatch<AppDispatch>();
  const notificationState = useSelector((state: RootState) => state.notification);
  const { isAuthenticated } = useAuth();
  const initialFetchedRef = useRef(false);
  const { socket } = useAppSocket();

  const fetchNotifications = useCallback(
    (page = 1, limit = 10) => {
      if (!isAuthenticated) return;
      dispatch(fetchNotificationsThunk({ page, limit }));
    },
    [dispatch, isAuthenticated]
  );

  const markAsRead = useCallback(
    (id: string) => {
      dispatch(markAsReadThunk(id));
    },
    [dispatch]
  );

  const markAllAsRead = useCallback(() => {
    dispatch(markAllAsReadThunk());
  }, [dispatch]);

  const deleteNotification = useCallback(
    (id: string) => {
      return dispatch(deleteNotificationThunk(id)).unwrap();
    },
    [dispatch]
  );

  const dismissLatestNotification = useCallback(() => {
    dispatch(clearLatestNotification());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && !initialFetchedRef.current) {
      initialFetchedRef.current = true;
      fetchNotifications(1, 10);
    }
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    if (!socket) return;

    if (activeNotificationListenersCount === 0) {
      activeIncomingNotificationHandler = (notification: any) => {
        if (notification) {
          dispatch(addRealTimeNotification(notification));
        }
      };
      socket.on('INCOMING_NOTIFICATION', activeIncomingNotificationHandler);
    }
    activeNotificationListenersCount++;

    return () => {
      activeNotificationListenersCount--;
      if (activeNotificationListenersCount <= 0 && activeIncomingNotificationHandler) {
        socket.off('INCOMING_NOTIFICATION', activeIncomingNotificationHandler);
        activeIncomingNotificationHandler = null;
        activeNotificationListenersCount = 0;
      }
    };
  }, [socket, dispatch]);

  return {
    items: notificationState.items,
    unreadCount: notificationState.unreadCount,
    latestNotification: notificationState.latestNotification,
    pagination: notificationState.pagination,
    loading: notificationState.loading,
    error: notificationState.error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    dismissLatestNotification,
  };
};

export default useNotifications;
