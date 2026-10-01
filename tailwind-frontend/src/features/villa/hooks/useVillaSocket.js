import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { fetchVillasAsync, fetchVillaStatsAsync } from '../store/villaSlice';
import logger from '../../../utils/logger';

export const useVillaSocket = (orgId) => {
  const dispatch = useDispatch();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!orgId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    logger.info(`Initializing real-time villa socket connection for org room: org:${orgId}`);
    
    socketRef.current = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      logger.info(`Villa Socket connected successfully. Joining room: org:${orgId}`);
      socket.emit('join_room', `org:${orgId}`);
    });

    socket.on('unit_created', (payload) => {
      logger.info('Real-time notification: unit_created', payload);
      dispatch(fetchVillasAsync({ page: 1, limit: 12 }));
      dispatch(fetchVillaStatsAsync());
    });

    socket.on('unit_updated', (payload) => {
      logger.info('Real-time notification: unit_updated', payload);
      dispatch(fetchVillasAsync({ page: 1, limit: 12 }));
      dispatch(fetchVillaStatsAsync());
    });

    socket.on('resident_assigned', (payload) => {
      logger.info('Real-time notification: resident_assigned', payload);
      dispatch(fetchVillasAsync({ page: 1, limit: 12 }));
      dispatch(fetchVillaStatsAsync());
    });

    socket.on('resident_type_updated', (payload) => {
      logger.info('Real-time notification: resident_type_updated', payload);
      dispatch(fetchVillasAsync({ page: 1, limit: 12 }));
      dispatch(fetchVillaStatsAsync());
    });

    // Clean up connections and listeners
    return () => {
      logger.info(`Disconnecting villa socket listeners and leaving room: org:${orgId}`);
      socket.off('unit_created');
      socket.off('unit_updated');
      socket.off('resident_assigned');
      socket.off('resident_type_updated');
      socket.disconnect();
    };
  }, [dispatch, orgId]);
};

export default useVillaSocket;
