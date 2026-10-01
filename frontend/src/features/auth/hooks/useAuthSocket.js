import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import config from '../../../config/config.js'
import { logout, switchWorkspaceContext } from '../store/authSlice'
import { toast } from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

/**
 * useAuthSocket Custom Hook
 *
 * Manages WebSocket connection for real-time auth event listening.
 * Listens for user-specific session revocation events.
 */
export const useAuthSocket = () => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const user = useSelector((state) => state.auth.user)
  const token = useSelector((state) => state.auth.token)
  const socketRef = useRef(null)

  useEffect(() => {
    // Only connect if user is authenticated and token exists
    if (!user || !user.id || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    const socketUrl = config.socketUrl

    // Connect to WebSocket with token authentication
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })
    socketRef.current = socket

    // Join room dedicated to current user
    socket.on('connect', () => {
      socket.emit('join_room', `user:${user.id}`)
      if (user.orgId) {
        socket.emit('join_room', `org:${user.orgId}`)
      }
    })

    // Listen to session revocation events
    const handleSessionRevoked = (data) => {
      // Trigger error toast and immediately logout user
      toast.error(t('auth.session.revoked', 'Your session has been revoked. Please log in again.'))
      dispatch(logout())
    }

    // Listen to real-time unit allocation or user updates to refresh state seamlessly
    const handleResidentAssigned = (data) => {
      if (data?.userId === user.id || data?.residentId === user.id) {
        toast.success(t('auth.unit.allocated', 'You have been allocated to a unit.'))
        dispatch(switchWorkspaceContext({ targetOrgId: user.orgId, targetVillaId: data.villaId }))
      }
    }

    const handleRecordUpdated = (data) => {
      if (data?.type === 'USER' && data?.userId === user.id) {
        dispatch(switchWorkspaceContext({ targetOrgId: user.orgId }))
      }
    }

    socket.on('SESSION_REVOKED', handleSessionRevoked)
    socket.on('resident_assigned', handleResidentAssigned)
    socket.on('RECORD_UPDATED', handleRecordUpdated)

    return () => {
      socket.off('SESSION_REVOKED', handleSessionRevoked)
      socket.off('resident_assigned', handleResidentAssigned)
      socket.off('RECORD_UPDATED', handleRecordUpdated)
      socket.disconnect()
      socketRef.current = null
    }
  }, [dispatch, user, token, t])

  // Hook doesn't need to return anything
}

export default useAuthSocket
