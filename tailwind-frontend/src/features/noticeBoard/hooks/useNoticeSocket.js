import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io } from 'socket.io-client'
import { fetchNotices, fetchNoticeStats } from '../store/noticeBoardThunk.js'

/**
 * Custom hook to manage the real-time Socket.io connection for Notice Board.
 * Listens for notice modifications and updates to reload lists and stats.
 */
export const useNoticeSocket = () => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth || {})

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) return

    // Resolve socket URL from environment configuration with backend fallback
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5006'

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })

    socket.on('connect', () => {
      // Join tenant/workspace room using orgId
      if (user.orgId) {
        socket.emit('join_room', `org:${user.orgId}`)
      }
    })

    const handleUpdate = (notice, eventType) => {
      const currentUserId = (user._id || user.id || '').toString()
      if (!currentUserId) {
        dispatch(fetchNotices())
        dispatch(fetchNoticeStats())
        return
      }

      if (eventType === 'created' || eventType === 'updated' || eventType === 'pinned_toggled') {
        const initiatorId =
          notice?.createdBy?._id || notice?.createdBy || notice?.updatedBy?._id || notice?.updatedBy
        if (initiatorId && initiatorId.toString() === currentUserId) {
          return // Skip double fetch for the initiator
        }
      } else if (eventType === 'deleted') {
        if (notice?.deletedBy && notice.deletedBy.toString() === currentUserId) {
          return // Skip double fetch for the initiator
        }
      }

      dispatch(fetchNotices())
      dispatch(fetchNoticeStats())
    }

    // Notice board real-time events
    socket.on('notice:created', (data) => handleUpdate(data, 'created'))
    socket.on('notice:updated', (data) => handleUpdate(data, 'updated'))
    socket.on('notice:deleted', (data) => handleUpdate(data, 'deleted'))
    socket.on('notice:pinned_toggled', (data) => handleUpdate(data, 'pinned_toggled'))

    return () => {
      socket.off('notice:created')
      socket.off('notice:updated')
      socket.off('notice:deleted')
      socket.off('notice:pinned_toggled')
      socket.disconnect()
    }
  }, [dispatch, user])

  return null
}

export default useNoticeSocket
