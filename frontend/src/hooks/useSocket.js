import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useSelector } from 'react-redux'
import config from '../config/config.js'

export const useSocket = (namespace = '') => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const { token } = useSelector((state) => state.auth)

  useEffect(() => {
    if (!token) return

    // Ensure namespace starts with slash if provided, e.g. '/platform'
    const socketInstance = io(`${config.socketUrl}${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    })

    socketInstance.on('connect', () => {
      setIsConnected(true)
      console.log(`Socket connected: ${socketInstance.id}`)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [token, namespace])

  const emit = useCallback(
    (eventName, data) => {
      if (socket) {
        socket.emit(eventName, data)
      }
    },
    [socket],
  )

  return { socket, isConnected, emit }
}

export default useSocket
