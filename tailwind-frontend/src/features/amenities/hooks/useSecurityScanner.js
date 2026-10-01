import { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { checkInBooking, fetchRecentScans } from '../services/amenityBookingApi.js';
import io from 'socket.io-client';

export const useSecurityScanner = () => {
  const { user } = useSelector(state => state.auth || {});
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processCheckIn = useCallback(async (bookingId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await checkInBooking(bookingId);
      // response contains the updated booking along with isExit and message flags
      setScanResult({
        success: true,
        booking: response || { _id: bookingId },
        message: response?.message || 'Check-in successful.'
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to check in.';
      setScanResult({
        success: false,
        message: errorMsg
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = useCallback((data) => {
    if (!data) return;
    
    // Simple debounce to prevent multiple rapid scans
    if (loading || scanResult) return;

    try {
      const payload = JSON.parse(data);
      if (payload && payload.bookingId) {
        processCheckIn(payload.bookingId);
      } else {
        throw new Error('Invalid QR Format');
      }
    } catch (e) {
      setScanResult({
        success: false,
        message: 'Unrecognized QR Code format. Please scan a valid GatedCommunity Resident Wallet pass.'
      });
    }
  }, [loading, scanResult, processCheckIn]);

  const handleManualEntry = useCallback((bookingId) => {
    if (!bookingId || bookingId.trim() === '') return;
    processCheckIn(bookingId.trim());
  }, [processCheckIn]);

  const resetScanner = useCallback(() => {
    setScanResult(null);
    setError(null);
  }, []);

  const [recentScans, setRecentScans] = useState([]);

  const loadRecentScans = useCallback(async () => {
    try {
      const data = await fetchRecentScans();
      console.log('Fetched recent scans:', data);
      setRecentScans(data || []);
    } catch (err) {
      console.error('Failed to fetch recent scans:', err);
    }
  }, []);

  // Fetch initially and set up socket listener for real-time updates
  useEffect(() => {
    loadRecentScans();
    
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    
    // Join the organization room to receive broadcasts
    socket.on('connect', () => {
      const orgId = user?.orgId;
      if (orgId) {
        socket.emit('join_room', `org:${orgId}`);
      }
    });

    socket.on('bookingUpdated', () => {
      loadRecentScans();
    });
    
    socket.on('bookingCompleted', () => {
      loadRecentScans();
    });
    
    return () => {
      socket.disconnect();
    };
  }, [loadRecentScans, user?.orgId]);

  return {
    scanResult,
    loading,
    error,
    recentScans,
    handleScan,
    handleManualEntry,
    resetScanner
  };
};

export default useSecurityScanner;
