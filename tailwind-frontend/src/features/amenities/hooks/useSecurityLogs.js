import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { getSecurityLogs, getDashboardStats, setFilters, setPage, addLogRealTime } from '../store/securityLogSlice.js';
import { createManualVerification } from '../services/securityLogApi.js';
import toast from 'react-hot-toast';

export const useSecurityLogs = () => {
  const dispatch = useDispatch();
  const { logs, dashboard, pagination, filters, loading, error } = useSelector(state => state.securityLogs);
  const { user } = useSelector(state => state.auth || {});

  const fetchLogs = useCallback(() => {
    const params = {
      ...filters,
      page: pagination.page,
      limit: pagination.limit
    };
    // Remove empty strings so backend doesn't see them as filters
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    dispatch(getSecurityLogs(params));
  }, [dispatch, filters, pagination.page, pagination.limit]);

  const fetchStats = useCallback(() => {
    dispatch(getDashboardStats());
  }, [dispatch]);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  // Real-time Socket.IO listener
  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socket.on('connect', () => {
      socket.emit('join_room', `org:${user.orgId}`);
    });

    socket.on('SECURITY_LOG_CREATED', (logData) => {
      dispatch(addLogRealTime(logData));

      if (logData.scanType === 'Entry' && logData.status === 'Success') {
        toast.success('✅ Resident entered successfully.');
      } else if (logData.scanType === 'Exit' && logData.status === 'Success') {
        toast.success('✅ Resident exited successfully.');
      } else if (logData.status === 'Denied') {
        toast.error(`❌ Access denied: ${logData.reason || 'Invalid scan'}`);
      } else if (logData.scanType === 'Refund') {
        toast.success('✅ Refund processed successfully.');
      } else if (logData.scanType === 'Booking Cancelled') {
        toast('⚠ Booking cancelled.', { icon: '⚠️' });
      } else if (logData.scanType === 'QR Expired') {
        toast('⚠ QR Code expired.', { icon: '⚠️' });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [dispatch, user]);

  const handleFilterChange = (key, value) => {
    dispatch(setFilters({ [key]: value }));
  };

  const handlePageChange = (newPage) => {
    dispatch(setPage(newPage));
  };

  const handleManualVerification = async (payload) => {
    try {
      await createManualVerification(payload);
      toast.success('Manual verification logged successfully.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log manual verification');
    }
  };

  const clearFilters = () => {
    dispatch(setFilters({
      search: '',
      status: '',
      scanType: '',
      amenityId: '',
      dateRange: 'today'
    }));
  };

  return {
    logs,
    dashboard,
    pagination,
    filters,
    loading,
    error,
    handleFilterChange,
    handlePageChange,
    handleManualVerification,
    clearFilters,
    refresh: () => { fetchLogs(); fetchStats(); }
  };
};

export default useSecurityLogs;
