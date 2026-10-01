import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { addPendingApproval, resolveWalkIn, setActiveGateRequest } from '../store/visitorLogSlice.js';

/**
 * Custom Hook: useWalkInListener
 * 
 * Manages the Socket.io connection for incoming gate approval requests (walk-ins)
 * and bridges it to the Redux store, following the lifecycle cleanup rules.
 */
export const useWalkInListener = () => {
  const dispatch = useDispatch();

  // 1. Selector mapping
  const pendingApprovals = useSelector((state) => state.visitorLog.pendingApprovals);
  const { user } = useSelector((state) => state.auth || {});
  const userId = user?._id || user?.id;

  // 2. Setup Socket Connection inside useEffect
  useEffect(() => {
    if (!userId) {
      return;
    }

    // Resolve Socket URL from environment
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join_room', `user:${userId}`);
    });

    // Capture incoming approval request from socket emission
    socket.on('GATE_APPROVAL_REQUEST', (payload) => {
      const visitorName = payload.snapshot?.visitorName || 'Walk-in Visitor';
      
      // Emit interactive clickable toast that opens the global approval modal
      toast((t) => 
        React.createElement('div', {
          onClick: () => {
            dispatch(setActiveGateRequest(payload));
            toast.dismiss(t.id);
          },
          style: { cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }
        },
          React.createElement('div', { style: { fontWeight: '700', color: 'var(--primary, #0084FF)' } }, '🔔 Gate Entry Request'),
          React.createElement('div', { style: { fontSize: '13px', color: 'var(--text-main, #0F172A)' } }, 
            React.createElement('strong', null, visitorName),
            ' is waiting at the gate. Click to Approve/Deny.'
          )
        ),
        { duration: 8000 }
      );

      dispatch(addPendingApproval(payload));
    });

    // Cleanup: Remove listeners and disconnect socket on component unmount
    return () => {
      socket.off('GATE_APPROVAL_REQUEST');
      socket.disconnect();
    };
  }, [userId, dispatch]);

  // 3. Expose request resolver action
  const resolveWalkInRequest = useCallback(
    (logId, status) => {
      return dispatch(resolveWalkIn({ id: logId, status }));
    },
    [dispatch]
  );

  return {
    pendingApprovals,
    resolveWalkInRequest
  };
};

export default useWalkInListener;
