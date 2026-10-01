import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { fetchDashboardAnalytics } from '../store/complaintSlice.js';

/**
 * Custom hook to manage the real-time Socket.io connection for Analytics
 */
export const useComplaintAnalyticsSocket = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  
  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      if (user.orgId) {
        socket.emit('join_room', `org:${user.orgId}`);
      }
    });

    const handleUpdate = () => {
      // Reload the analytics dashboard using current defaults
      dispatch(fetchDashboardAnalytics({}));
    };

    // Listen for all complaint-related analytics events
    const events = [
      'complaint:created',
      'complaint:updated',
      'complaint:assigned',
      'complaint:closed',
      'complaint:reopened',
      'complaint:escalated',
      'maintenance:updated',
      'feedback:submitted'
    ];

    events.forEach(evt => socket.on(evt, handleUpdate));

    return () => {
      events.forEach(evt => socket.off(evt, handleUpdate));
      socket.disconnect();
    };
  }, [dispatch, user]);

  return null;
};

export default useComplaintAnalyticsSocket;
