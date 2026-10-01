import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { addRealTimeNotification } from '../store/notificationSlice.js';

/**
 * Custom hook to manage the real-time Socket.io connection and listeners
 * for incoming notification events.
 * 
 * @param {string} userId - The unique ID of the authenticated user.
 */
export const useNotificationSocket = (userId) => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Resolve socket URL from environment configuration with backend fallback
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join_room', `user:${userId}`);
    });

    socket.on('INCOMING_NOTIFICATION', (payload) => {
      dispatch(addRealTimeNotification(payload));
    });

    return () => {
      socket.off('INCOMING_NOTIFICATION');
      socket.disconnect();
    };
  }, [userId, dispatch]);
};

export default useNotificationSocket;
