import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const useAdminBookingSocket = (onRefreshNeeded) => {
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

    const handleRefresh = (data) => {
      // We can optionally check if the event falls in our current date range,
      // but for simplicity and guaranteeing data consistency, we trigger a refresh.
      if (onRefreshNeeded) {
        onRefreshNeeded();
      }
    };

    const handleBookingCreated = (data) => {
      toast.success(`New booking created by ${data.userId?.name || 'a resident'}`);
      handleRefresh(data);
    };

    const handleBookingCancelled = (data) => {
      toast.error(`Booking cancelled by ${data.cancelledBy?.name || 'a resident'}`);
      handleRefresh(data);
    };

    const handleBookingCheckedIn = (data) => {
      toast.success(`Resident checked in: ${data.userId?.name || 'Unknown'}`);
      handleRefresh(data);
    };

    const handlePaymentSuccess = (data) => {
      handleRefresh(data);
    };

    socket.on('amenity_booking_created', handleBookingCreated);
    socket.on('amenity_booking_cancelled', handleBookingCancelled);
    socket.on('amenity_booking_checked_in', handleBookingCheckedIn);
    socket.on('amenity_booking_completed', handleRefresh);
    socket.on('payment_success', handlePaymentSuccess);

    return () => {
      socket.off('amenity_booking_created', handleBookingCreated);
      socket.off('amenity_booking_cancelled', handleBookingCancelled);
      socket.off('amenity_booking_checked_in', handleBookingCheckedIn);
      socket.off('amenity_booking_completed', handleRefresh);
      socket.off('payment_success', handlePaymentSuccess);
      socket.disconnect();
    };
  }, [user, onRefreshNeeded]);

  return null;
};

export default useAdminBookingSocket;
