import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useAppSocket from '../../../hooks/useAppSocket';
import { upsertAmenity, removeAmenity } from '../store/amenitySlice';
import { upsertBooking } from '../store/amenityBookingSlice';
import { fetchWalletThunk } from '../../wallet/store/walletSlice';

export const useAmenitySocket = () => {
  const { socket } = useAppSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket) return;

    // --- Amenity Core Events ---
    
    const handleAmenityCreated = (amenity: any) => {
      console.log('Socket: AMENITY_CREATED received', amenity);
      dispatch(upsertAmenity(amenity));
    };

    const handleAmenityUpdated = (amenity: any) => {
      console.log('Socket: AMENITY_UPDATED received', amenity);
      dispatch(upsertAmenity(amenity));
    };

    const handleAmenityDeleted = (amenity: any) => {
      console.log('Socket: AMENITY_DELETED received', amenity);
      const id = amenity._id || amenity.id;
      if (id) dispatch(removeAmenity(id));
    };

    // --- Amenity Booking Events & v2 Reservation Events ---

    const handleBookingCreated = (booking: any) => {
      console.log('Socket: AMENITY_BOOKING_CREATED / AMENITY_RESERVATION_CREATED received', booking);
      dispatch(upsertBooking(booking));
      (dispatch as any)(fetchWalletThunk());
    };

    const handleBookingCheckin = (booking: any) => {
      console.log('Socket: AMENITY_CHECKIN received', booking);
      dispatch(upsertBooking(booking));
    };

    const handleBookingCancelled = (booking: any) => {
      console.log('Socket: AMENITY_BOOKING_CANCELLED / AMENITY_RESERVATION_CANCELLED received', booking);
      dispatch(upsertBooking(booking));
      (dispatch as any)(fetchWalletThunk());
    };

    // Attach listeners (v1 & v2 events)
    socket.on('AMENITY_CREATED', handleAmenityCreated);
    socket.on('AMENITY_UPDATED', handleAmenityUpdated);
    socket.on('AMENITY_DELETED', handleAmenityDeleted);
    socket.on('AMENITY_BOOKING_CREATED', handleBookingCreated);
    socket.on('amenity_booking_created', handleBookingCreated);
    socket.on('AMENITY_RESERVATION_CREATED', handleBookingCreated);
    socket.on('AMENITY_RESERVATION_CONFIRMED', handleBookingCreated);
    socket.on('AMENITY_CHECKIN', handleBookingCheckin);
    socket.on('amenity_checkin', handleBookingCheckin);
    socket.on('AMENITY_BOOKING_CANCELLED', handleBookingCancelled);
    socket.on('amenity_booking_cancelled', handleBookingCancelled);
    socket.on('AMENITY_RESERVATION_CANCELLED', handleBookingCancelled);

    // Cleanup listeners on unmount
    return () => {
      socket.off('AMENITY_CREATED', handleAmenityCreated);
      socket.off('AMENITY_UPDATED', handleAmenityUpdated);
      socket.off('AMENITY_DELETED', handleAmenityDeleted);
      socket.off('AMENITY_BOOKING_CREATED', handleBookingCreated);
      socket.off('amenity_booking_created', handleBookingCreated);
      socket.off('AMENITY_RESERVATION_CREATED', handleBookingCreated);
      socket.off('AMENITY_RESERVATION_CONFIRMED', handleBookingCreated);
      socket.off('AMENITY_CHECKIN', handleBookingCheckin);
      socket.off('amenity_checkin', handleBookingCheckin);
      socket.off('AMENITY_BOOKING_CANCELLED', handleBookingCancelled);
      socket.off('amenity_booking_cancelled', handleBookingCancelled);
      socket.off('AMENITY_RESERVATION_CANCELLED', handleBookingCancelled);
    };
  }, [socket, dispatch]);

  return { socket };
};

export default useAmenitySocket;
