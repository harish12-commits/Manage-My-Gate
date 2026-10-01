import { useState, useMemo, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAmenities, fetchAllAmenitySlots } from '../store/amenitySlice.js';
import { createBooking } from '../services/amenityBookingApi.js';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

export const useResidentBooking = (initialAmenityId) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // State Machine
  const [step, setStep] = useState('date'); // 'date' | 'time' | 'review' | 'payment' | 'submitting' | 'success' | 'failed'
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentIntent, setPaymentIntent] = useState(null);
  
  const token = useSelector(state => state.auth?.token);
  const user = useSelector(state => state.auth?.user || {});

  // Single Source of Truth for Booking
  const [draft, setDraft] = useState({
    amenityId: initialAmenityId,
    bookingDate: '',
    startTime: '',
    endTime: '',
    duration: 0,
    price: 0,
    totalPrice: 0,
  });

  const { items, loading, allSlots, slotsLoading } = useSelector(state => state.amenities);
  
  const amenity = useMemo(() => items.find(i => i._id === initialAmenityId), [items, initialAmenityId]);

  useEffect(() => {
    if (!amenity && !loading) {
      dispatch(getAmenities());
    }
  }, [amenity, loading, dispatch]);

  const updateDraft = useCallback((updates) => {
    setDraft(prev => {
      const newDraft = { ...prev, ...updates };
      newDraft.totalPrice = (newDraft.price || 0) + (newDraft.deposit || 0);
      return newDraft;
    });
    setErrorMsg(''); // clear errors on edit
  }, []);

  const proceedToTime = () => {
    if (!draft.bookingDate) {
      setErrorMsg('Please select a date first.');
      return;
    }
    // Fetch slots when moving to time step
    // Fetch all slots when moving to time step
    dispatch(fetchAllAmenitySlots({ id: draft.amenityId, date: draft.bookingDate }));
    setStep('time');
  };

  const goBack = () => {
    if (step === 'time') setStep('date');
    if (step === 'payment') setStep('time');
    setErrorMsg('');
  };

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5006';
    const socket = io(backendUrl, { auth: { token } });

    socket.on('connect', () => {
      const userId = user.id || user._id;
      if (userId) socket.emit('join_room', `user:${userId}`);
    });

    const handleUpdate = () => {
      if (step === 'time' && draft.bookingDate) {
        dispatch(fetchAllAmenitySlots({ id: draft.amenityId, date: draft.bookingDate }));
      }
    };

    socket.on('bookingUpdated', handleUpdate);
    socket.on('paymentSuccess', handleUpdate);

    return () => {
      socket.off('bookingUpdated', handleUpdate);
      socket.off('paymentSuccess', handleUpdate);
      socket.disconnect();
    };
  }, [step, draft.bookingDate, draft.amenityId, dispatch, token, user]);

  const confirmBooking = async () => {
    setStep('submitting');
    setErrorMsg('');
    try {
      const payload = {
        amenityId: draft.amenityId,
        bookingDate: draft.bookingDate,
        startTime: draft.startTime,
        endTime: draft.endTime
      };
      
      const response = await createBooking(payload);
      
      if (response.paymentIntent) {
        setPaymentIntent(response.paymentIntent);
        setStep('payment');
      } else {
        toast.success('Booking confirmed successfully.');
        toast.success('Wallet updated successfully.');
        setStep('success');
      }
    } catch (err) {
      const errMsg = err.message || 'Failed to submit booking';
      setErrorMsg(errMsg);
      if (errMsg.includes('capacity') || errMsg.includes('already have a booking')) {
        toast.error('Slot already booked.');
      } else {
        toast.error('Booking failed.');
      }
      setStep('failed');
    }
  };

  const processMockPayment = async (isSuccess) => {
    if (!paymentIntent) return;
    setStep('submitting');
    try {
      const { simulatePayment } = await import('../services/paymentApi.js');
      await simulatePayment(paymentIntent.paymentId, isSuccess, isSuccess ? null : 'Insufficient funds in mock bank');
      if (isSuccess) {
        toast.success('Payment completed successfully.');
        toast.success('QR Code generated successfully.');
        toast.success('Wallet updated successfully.');
        setStep('success');
      } else {
        setErrorMsg('Payment Failed. Booking cancelled.');
        toast.error('Payment failed.');
        setStep('failed');
      }
    } catch (err) {
      setErrorMsg('Failed to process payment');
      toast.error('Payment failed.');
      setStep('failed');
    }
  };

  const complete = () => {
    navigate('/resident/amenities/history');
  };

  return {
    amenity,
    loading,
    slotsLoading,
    availableSlots: allSlots,
    step,
    draft,
    errorMsg,
    paymentIntent,
    updateDraft,
    proceedToTime,
    goBack,
    confirmBooking,
    processMockPayment,
    complete
  };
};

export default useResidentBooking;
