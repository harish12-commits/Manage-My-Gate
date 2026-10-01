import { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchMyBookings } from '../services/amenityBookingApi.js';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

export const useResidentHistory = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const token = useSelector(state => state.auth?.token);
  const user = useSelector(state => state.auth?.user || {});

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMyBookings();
      // Ensure newest bookings first
      const sortedBookings = (response.data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(sortedBookings);
    } catch (err) {
      setError(err.message || 'Failed to load booking history');
      toast.error('Failed to load booking history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set up socket listener for real-time updates
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5006';
    const socket = io(backendUrl, {
      auth: { token }
    });

    socket.on('connect', () => {
      const userId = user.id || user._id;
      if (userId) {
        socket.emit('join_room', `user:${userId}`);
      }
    });

    const handleUpdate = () => {
      loadBookings();
    };

    socket.on('bookingUpdated', handleUpdate);
    socket.on('paymentSuccess', handleUpdate);
    socket.on('paymentRefunded', handleUpdate);

    return () => {
      socket.off('bookingUpdated', handleUpdate);
      socket.off('paymentSuccess', handleUpdate);
      socket.off('paymentRefunded', handleUpdate);
      socket.disconnect();
    };
  }, [loadBookings, token]);

  return {
    bookings,
    loading: isLoading,
    error,
    loadBookings
  };
};

export default useResidentHistory;
