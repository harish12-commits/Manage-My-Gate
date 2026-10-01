import { useState, useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import apiClient from '../../../services/apiClient.js'
import { toast } from 'react-hot-toast'
import { useSocket } from '../../../hooks/useSocket.js'
import config, { isMockRazorpayKey } from '../../../config/config.js'

export const useRazorpayCheckout = () => {
  const [isInitializing, setIsInitializing] = useState(false)
  const [activeOrderId, setActiveOrderId] = useState(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { socket } = useSocket()

  useEffect(() => {
    if (!socket) return

    const handleUpdate = (data) => {
      if (
        activeOrderId &&
        (data.orderId === activeOrderId ||
          data.razorpay_order_id === activeOrderId ||
          data.id === activeOrderId)
      ) {
        if (data.status === 'PAID' || data.status === 'COMPLETED' || data.status === 'ACTIVE') {
          toast.dismiss('verify-payment')
          toast.success('Payment Successful! Your subscription is now active.')
          dispatch({ type: 'subscription/setStatus', payload: 'ACTIVE' })
          setIsInitializing(false)
          setActiveOrderId(null)
          navigate('/dashboard')
        }
      }
    }

    socket.on('PAYMENT_CAPTURED', handleUpdate)
    socket.on('PROVISIONING_JOB_UPDATE', handleUpdate)

    return () => {
      socket.off('PAYMENT_CAPTURED', handleUpdate)
      socket.off('PROVISIONING_JOB_UPDATE', handleUpdate)
    }
  }, [socket, activeOrderId, dispatch, navigate])

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleCheckout = useCallback(
    async (checkoutPayload) => {
      try {
        setIsInitializing(true)

        // Step 1: Call our backend POST /platform-payments/create-order to generate a Razorpay order_id
        const response = await apiClient.post('/platform-payments/create-order', checkoutPayload)
        const dataPayload = response?.data || response
        const order = dataPayload?.order || dataPayload

        const orderId = order?.id || order?.orderId || `order_${Date.now()}`
        const amountInPaise = order?.amount || Math.round((checkoutPayload?.amount || 186300) * 100)
        const currency = order?.currency || checkoutPayload?.currency || 'INR'
        const keyId = order?.key || config.razorpayKeyId || 'rzp_test_mockkey'
        const isMock = isMockRazorpayKey(keyId)

        if (isMock) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const confirmPayment = window.confirm(
            `[Mock Mode] Confirm subscription payment of ₹${checkoutPayload?.amount || 1863}?`,
          )
          if (confirmPayment) {
            try {
              await apiClient.post('/platform-payments/reconcile-offline', {
                inquiryId: checkoutPayload?.inquiryId,
                amount: checkoutPayload?.amount,
                gateway: 'RAZORPAY',
                transactionId: `TXN_MOCK_${Date.now()}`,
                email: checkoutPayload?.userEmail,
              })
              toast.success('Payment Verified! Your organization workspace is provisioned.')
              setIsInitializing(false)
              if (typeof checkoutPayload?.onSuccess === 'function') {
                checkoutPayload.onSuccess({ razorpay_payment_id: `pay_mock_${Date.now()}` })
              }
            } catch (err) {
              toast.error('Mock payment error: ' + (err.response?.data?.message || err.message))
              setIsInitializing(false)
            }
          } else {
            setIsInitializing(false)
          }
          return
        }

        // Step 2: Load the Razorpay Checkout script dynamically
        const isLoaded = await loadRazorpayScript()
        if (!isLoaded) {
          toast.error('Razorpay SDK failed to load. Are you online?')
          setIsInitializing(false)
          return
        }

        setActiveOrderId(orderId)

        // Step 3: Initialize new window.Razorpay(options) passing the order_id, amount, and company branding
        const options = {
          key: keyId,
          amount: amountInPaise,
          currency: currency,
          name: 'Nahom',
          description: 'Subscription Renewal',
          order_id: orderId, // This is the Razorpay order_id

          // Step 4: On the handler success callback
          handler: async function (response) {
            setIsInitializing(true) // Keep UI in a loading state
            toast.loading('Payment captured. Verifying with server...', { id: 'verify-payment' })

            try {
              await apiClient.post('/platform-payments/reconcile-offline', {
                inquiryId: checkoutPayload?.inquiryId,
                amount: checkoutPayload?.amount,
                gateway: 'RAZORPAY',
                transactionId:
                  response?.razorpay_payment_id ||
                  response?.razorpay_order_id ||
                  `TXN_RZP_${Date.now()}`,
                email: checkoutPayload?.userEmail,
              })

              toast.dismiss('verify-payment')
              toast.success('Payment Verified! Your organization workspace is provisioned.')
              setIsInitializing(false)
              if (typeof checkoutPayload?.onSuccess === 'function') {
                checkoutPayload.onSuccess(response)
              }
            } catch (err) {
              toast.dismiss('verify-payment')
              toast.error(
                'Payment verification warning: ' + (err.response?.data?.message || err.message),
              )
              setIsInitializing(false)
              if (typeof checkoutPayload?.onSuccess === 'function') {
                checkoutPayload.onSuccess(response)
              }
            }
          },
          prefill: {
            name: checkoutPayload.userName,
            email: checkoutPayload.userEmail,
          },
          theme: {
            color: '#3399cc',
          },
          modal: {
            ondismiss: function () {
              // Handle modal dismissal: reset the loading state
              setIsInitializing(false)
              toast.info('Payment cancelled')
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', function (response) {
          toast.error(`Payment Failed: ${response.error.description}`)
          setIsInitializing(false)
          setActiveOrderId(null)
        })

        rzp.open()
      } catch (error) {
        toast.error(error.message || 'Error initializing payment')
        setIsInitializing(false)
        setActiveOrderId(null)
      }
    },
    [dispatch, navigate],
  )

  return { handleCheckout, isInitializing }
}
