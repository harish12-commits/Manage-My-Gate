import { useEffect, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import useSocket from '../../../hooks/useSocket.js'
import { syncRealtimeInvoice, fetchMyDues } from '../store/billingSlice.js'
import { fetchWalletBalance, syncWalletBalance } from '../store/walletSlice.js'
import logger from '../../../utils/logger.js'

/**
 * Custom Hook: useBillingSocket
 *
 * Silent background listener that manages the real-time Socket.io connections
 * and listeners for invoice billing & wallet balance updates.
 * Conforms to the "Thin View" pattern by encapsulating all socket logic.
 *
 * @param {string} userId - The unique ID of the authenticated user to join user:${userId} room
 * @param {string} communityOrOrgId - Active community or organization ID to join org:${communityOrOrgId} room
 */
export const useBillingSocket = (userId, communityOrOrgId) => {
  const dispatch = useDispatch()

  const rooms = useMemo(() => {
    const list = []
    if (userId) list.push(`user:${userId}`)
    if (communityOrOrgId) list.push(`org:${communityOrOrgId}`)
    return list
  }, [userId, communityOrOrgId])

  const { socket, isConnected, emit } = useSocket()

  // Deduplication cache & debounced refetch timer
  const processedEventsRef = useRef(new Map())
  const refetchTimerRef = useRef(null)

  useEffect(() => {
    if (!socket || !isConnected) return

    logger.info(`Registering billing & wallet real-time listeners for rooms: ${rooms.join(', ')}`)

    // Join rooms dynamically
    rooms.forEach(room => emit('join_room', room))

    // Helper: Event Deduplicator within a 3-second window
    const isDuplicateEvent = (eventName, payload) => {
      const eventId =
        payload?._id ||
        payload?.id ||
        payload?.invoiceId ||
        payload?.invoice?._id ||
        payload?.invoice?.id ||
        payload?.data?._id ||
        payload?.data?.id ||
        (Array.isArray(payload) ? payload[0]?._id || payload[0]?.id : undefined) ||
        (Array.isArray(payload?.invoices) ? payload.invoices[0]?._id || payload.invoices[0]?.id : undefined) ||
        (typeof payload === 'object' && payload !== null ? JSON.stringify(payload).slice(0, 120) : String(payload));

      const key = `${eventName}:${eventId}:${payload?.status || ''}`
      const now = Date.now()
      const lastSeen = processedEventsRef.current.get(key)

      if (processedEventsRef.current.size > 100) {
        processedEventsRef.current.forEach((timestamp, k) => {
          if (now - timestamp > 10000) processedEventsRef.current.delete(k)
        })
      }

      if (lastSeen && now - lastSeen < 3000) {
        return true
      }

      processedEventsRef.current.set(key, now)
      return false
    }

    // Helper: Debounced REST refetcher
    const triggerDebouncedRefetch = () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
      }
      refetchTimerRef.current = setTimeout(() => {
        dispatch(fetchMyDues())
      }, 300)
    }

    // 1. Invoice Generation Handler
    const handleInvoiceGenerated = (payload) => {
      if (isDuplicateEvent('invoice_generated', payload)) return
      logger.info('Real-time notification: invoice_generated', payload)
      if (payload) dispatch(syncRealtimeInvoice(payload))
      triggerDebouncedRefetch()
    }

    // 2. Invoice Status Update Handler
    const handleInvoiceStatusUpdated = (payload) => {
      if (isDuplicateEvent('invoice_status_updated', payload)) return
      logger.info('Real-time notification: invoice_status_updated / INVOICE_UPDATED', payload)
      if (payload) dispatch(syncRealtimeInvoice(payload))
      triggerDebouncedRefetch()
    }

    // 3. Payment Success Handler (Cross-slice dispatching to billing + wallet)
    const handlePaymentSuccess = (payload) => {
      if (isDuplicateEvent('PAYMENT_SUCCESS', payload)) return
      logger.info('Real-time notification: PAYMENT_SUCCESS', payload)
      if (payload?.invoice) dispatch(syncRealtimeInvoice(payload.invoice))
      triggerDebouncedRefetch()
      dispatch(fetchWalletBalance())
    }

    // 4. Digital Wallet Update Handler (Cross-slice dispatching to wallet)
    const handleWalletUpdated = (payload) => {
      if (isDuplicateEvent('WALLET_UPDATED', payload)) return
      logger.info('Real-time notification: WALLET_UPDATED / walletUpdated', payload)
      if (payload) {
        dispatch(syncWalletBalance(payload))
      }
      dispatch(fetchWalletBalance())
      triggerDebouncedRefetch()
    }

    // Reconnect handler to ensure room re-subscription and state sync after network restoration
    const handleReconnect = () => {
      logger.info(`Socket reconnected. Re-subscribing to rooms: ${rooms.join(', ')}`)
      rooms.forEach(room => emit('join_room', room))
      triggerDebouncedRefetch()
      dispatch(fetchWalletBalance())
    }

    // Register event listeners
    socket.on('reconnect', handleReconnect)
    socket.on('invoice_generated', handleInvoiceGenerated)
    socket.on('invoice_status_updated', handleInvoiceStatusUpdated)
    socket.on('INVOICE_UPDATED', handleInvoiceStatusUpdated)
    socket.on('INVOICE_STATUS_UPDATED', handleInvoiceStatusUpdated)
    socket.on('PAYMENT_SUCCESS', handlePaymentSuccess)
    socket.on('WALLET_UPDATED', handleWalletUpdated)
    socket.on('walletUpdated', handleWalletUpdated)
    
    // Listen for offline payment submission to update the admin billing ledger instantly
    socket.on('offline_payment_submitted', (payload) => {
      if (isDuplicateEvent('offline_payment_submitted', payload)) return
      logger.info('Real-time notification: offline_payment_submitted', payload)
      if (payload?.invoice) {
        dispatch(syncRealtimeInvoice(payload.invoice))
      }
    })

    // Lifecycle Cleanup
    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current)
      }
      logger.info(`Cleaning up billing & wallet real-time listeners for rooms: ${rooms.join(', ')}`)
      socket.off('reconnect', handleReconnect)
      socket.off('invoice_generated', handleInvoiceGenerated)
      socket.off('invoice_status_updated', handleInvoiceStatusUpdated)
      socket.off('INVOICE_UPDATED', handleInvoiceStatusUpdated)
      socket.off('INVOICE_STATUS_UPDATED', handleInvoiceStatusUpdated)
      socket.off('PAYMENT_SUCCESS', handlePaymentSuccess)
      socket.off('WALLET_UPDATED', handleWalletUpdated)
      socket.off('walletUpdated', handleWalletUpdated)
      socket.off('offline_payment_submitted')
    }
  }, [socket, isConnected, emit, dispatch, rooms])
}

export default useBillingSocket
