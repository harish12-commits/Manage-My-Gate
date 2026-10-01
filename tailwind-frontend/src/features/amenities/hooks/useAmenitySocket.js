import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { getAmenities } from '../store/amenitySlice.js';

/**
 * Custom hook to manage the real-time Socket.io connection for Amenities
 * Listens for amenity and booking changes to dispatch Redux updates.
 */
export const useAmenitySocket = (params = {}) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) return;

    // Resolve socket URL from environment configuration with backend fallback
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      // Join tenant/workspace room if necessary (e.g. orgId)
      if (user.orgId) {
        socket.emit('join_room', `org:${user.orgId}`);
      }
    });

    const handleUpdate = () => {
      // Dispatch action to refresh global amenities list
      dispatch(getAmenities(paramsRef.current));
    };

    // Amenity Events
    socket.on('amenity:created', handleUpdate);
    socket.on('amenity:updated', handleUpdate);
    socket.on('amenity:deleted', handleUpdate);

    // Booking Events that could affect availability
    socket.on('booking:created', handleUpdate);
    socket.on('booking:updated', handleUpdate);
    socket.on('booking:status_updated', handleUpdate);
    socket.on('booking:cancelled', handleUpdate);

    return () => {
      socket.off('amenity:created', handleUpdate);
      socket.off('amenity:updated', handleUpdate);
      socket.off('amenity:deleted', handleUpdate);
      socket.off('booking:created', handleUpdate);
      socket.off('booking:updated', handleUpdate);
      socket.off('booking:status_updated', handleUpdate);
      socket.off('booking:cancelled', handleUpdate);
      socket.disconnect();
    };
  }, [dispatch, user]);

  return null;
};

export default useAmenitySocket;
