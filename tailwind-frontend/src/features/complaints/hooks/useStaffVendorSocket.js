import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { fetchStaffVendorsAnalytics } from '../store/complaintSlice';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5006';

/**
 * Hook to listen for real‑time technician/technician‑analytics events.
 * It dispatches a fresh analytics load when relevant events occur.
 */
export const useStaffVendorSocket = (token) => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Technician socket connected');
    });

    // When any technician record changes, reload analytics
    socket.on('technicians:updated', () => {
      dispatch(fetchStaffVendorsAnalytics());
    });

    socket.on('technicians:analytics:updated', () => {
      dispatch(fetchStaffVendorsAnalytics());
    });

    socket.on('disconnect', () => {
      console.log('Technician socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, dispatch]);
};

export default useStaffVendorSocket;
