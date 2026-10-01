import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { getActiveVisitors } from '../store/visitorLogSlice.js';

/**
 * Custom Hook: useGuardWalkInListener
 * 
 * Listens for real-time GATE_APPROVAL_RESOLVED events from Socket.io,
 * alerts the guard via toast notifications when a resident approves/denies entry,
 * and refreshes the active visitors list in the Redux store.
 */
export const useGuardWalkInListener = () => {
  const dispatch = useDispatch();
  const activeOrgId = useSelector(state => state.workspace?.activeOrganizationId);
  const { user } = useSelector((state) => state.auth || {});
  const userId = user?._id || user?.id;

  useEffect(() => {
    if (!userId || !activeOrgId) {
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join_room', `user:${userId}`);
      socket.emit('join_room', `org:${activeOrgId}:guards`);
    });

    socket.on('GATE_APPROVAL_RESOLVED', (payload) => {
      const visitorName = payload.snapshot?.visitorName || 'Walk-in Visitor';
      const status = payload.logStatus;

      if (status === 'INSIDE') {
        toast.success(`Walk-in entry for "${visitorName}" was APPROVED by host.`, { duration: 6000 });
      } else if (status === 'REJECTED') {
        toast.error(`Walk-in entry for "${visitorName}" was DENIED by host.`, { duration: 6000 });
      }

      // Automatically refresh the active visitors list so the Guard Console displays the update
      dispatch(getActiveVisitors(activeOrgId));
    });

    return () => {
      socket.off('GATE_APPROVAL_RESOLVED');
      socket.disconnect();
    };
  }, [userId, activeOrgId, dispatch]);
};

export default useGuardWalkInListener;
