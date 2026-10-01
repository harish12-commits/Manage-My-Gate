import { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchMyWallet, addMoneyToWallet } from '../services/walletApi.js';
import toast from 'react-hot-toast';
import io from 'socket.io-client'; // Assuming standard setup or adjust if there's a custom hook

export const useResidentWallet = () => {
  const [walletData, setWalletData] = useState({ balance: 0, activePasses: [], transactionHistory: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const user = useSelector(state => state.auth?.user || { name: 'Resident', email: '' });
  const token = useSelector(state => state.auth?.token); // Assuming token for socket if needed

  const loadWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMyWallet();
      setWalletData({
        balance: response?.balance || 0,
        activePasses: response?.activePasses || [],
        transactionHistory: response?.transactionHistory || []
      });
    } catch (err) {
      setError(err.message || 'Failed to load wallet');
      toast.error('Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMoney = async (amount, method) => {
    setIsLoading(true);
    try {
      await addMoneyToWallet(amount, method);
      toast.success(`Successfully added $${amount} via ${method}`);
      await loadWallet();
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add money');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelPass = async (bookingId, reason) => {
    setIsLoading(true);
    try {
      const { cancelBooking } = await import('../services/amenityBookingApi.js');
      await cancelBooking(bookingId, reason);
      toast.success('Booking cancelled successfully.');
      await loadWallet();
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to cancel booking');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Set up socket listener for real-time updates
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5006';
    // Using a generic connection for demo, in real app use the central socket context if available
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
      loadWallet();
    };

    socket.on('bookingUpdated', handleUpdate);
    socket.on('paymentSuccess', handleUpdate);
    socket.on('paymentRefunded', handleUpdate);
    socket.on('walletUpdated', handleUpdate);

    return () => {
      socket.off('bookingUpdated', handleUpdate);
      socket.off('paymentSuccess', handleUpdate);
      socket.off('paymentRefunded', handleUpdate);
      socket.off('walletUpdated', handleUpdate);
      socket.disconnect();
    };
  }, [loadWallet, token]);

  return {
    walletData,
    activePasses: walletData.activePasses,
    transactionHistory: walletData.transactionHistory,
    balance: walletData.balance,
    loading: isLoading,
    error,
    loadWallet,
    addMoney,
    cancelPass
  };
};

export default useResidentWallet;
