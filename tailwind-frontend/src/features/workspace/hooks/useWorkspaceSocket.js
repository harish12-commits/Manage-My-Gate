import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { fetchCurrentWorkspace } from '../store/workspaceSlice';

const useWorkspaceSocket = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  
  useEffect(() => {
    if (!user) return;
    
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      if (user.role === 'Super Admin' || user.role === 'Platform Super Admin') {
        socket.emit('join_room', `role:${user.role}`);
      } else if (user.orgId) {
        socket.emit('join_room', `org:${user.orgId}`);
      }
    });

    const handleWorkspaceUpdated = () => {
      // Re-fetch current workspace silently to update Sidebar and permissions
      dispatch(fetchCurrentWorkspace());
    };

    socket.on('workspace:updated', handleWorkspaceUpdated);
    socket.on('workspace:statusChanged', handleWorkspaceUpdated);
    socket.on('workspace:deleted', handleWorkspaceUpdated);
    socket.on('workspace:restored', handleWorkspaceUpdated);
    
    socket.on('APP_MODULE_MODULE_UPDATED', handleWorkspaceUpdated);
    socket.on('APP_MODULE_MODULE_STATUS_CHANGED', handleWorkspaceUpdated);
    socket.on('APP_MODULE_MODULE_DELETED', handleWorkspaceUpdated);
    socket.on('APP_MODULE_MODULE_RESTORED', handleWorkspaceUpdated);

    return () => {
      socket.off('workspace:updated', handleWorkspaceUpdated);
      socket.off('workspace:statusChanged', handleWorkspaceUpdated);
      socket.off('workspace:deleted', handleWorkspaceUpdated);
      socket.off('workspace:restored', handleWorkspaceUpdated);

      socket.off('APP_MODULE_MODULE_UPDATED', handleWorkspaceUpdated);
      socket.off('APP_MODULE_MODULE_STATUS_CHANGED', handleWorkspaceUpdated);
      socket.off('APP_MODULE_MODULE_DELETED', handleWorkspaceUpdated);
      socket.off('APP_MODULE_MODULE_RESTORED', handleWorkspaceUpdated);

      socket.disconnect();
    };
  }, [dispatch, user]);
};

export default useWorkspaceSocket;
