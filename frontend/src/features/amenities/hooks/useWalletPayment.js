import { useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import config, { isMockRazorpayKey } from '../../../config/config.js'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { createWalletRechargeOrder, verifyWalletRechargePayment } from '../services/walletApi.js'

export const useWalletPayment = () => {
  const { t } = useTranslation()
  const { user } = useSelector((state) => state.auth || {})
  const [loading, setLoading] = useState(false)

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const rechargeWallet = useCallback(
    async (amountVal, onSuccess, onFailure) => {
      setLoading(true)
      try {
        // 1. Create order on backend first
        const orderRes = await createWalletRechargeOrder(amountVal)
        if (!orderRes || !orderRes.data) {
          throw new Error(t('payment.order_creation_failed', 'Failed to create payment order.'))
        }

        const orderData = orderRes.data
        const effectiveKey = orderData.key || config.razorpayKey || config.razorpayKeyId
        const isMockOrder =
          orderData.isMock ||
          orderData.id?.startsWith('order_mock_') ||
          isMockRazorpayKey(effectiveKey)

        if (isMockOrder) {
          // Wait 1 second to show gateway connecting state
          await new Promise((resolve) => setTimeout(resolve, 1000))

          const confirmPayment = window.confirm(
            t(
              'payment.mock_confirm',
              `[Mock Gateway Mode] Confirm wallet top-up of ₹${amountVal}?\n\n(Tip: Configure VITE_RAZORPAY_KEY and RAZORPAY_KEY_ID in .env to use official Razorpay modal with GPay / PhonePe / Cards / UPI)`,
            ),
          )
          if (confirmPayment) {
            const verifyPayload = {
              razorpay_order_id: orderData.id,
              razorpay_payment_id: `pay_mock_${Date.now()}`,
              razorpay_signature: `sig_mock_${Date.now()}`,
              amount: amountVal,
            }
            const verification = await verifyWalletRechargePayment(verifyPayload)
            if (verification.success) {
              toast.success(t('payment.recharge_success', 'Wallet recharged successfully!'))
              if (onSuccess) onSuccess(verification.data)
            } else {
              throw new Error(verification.message || 'Signature verification failed')
            }
          } else {
            setLoading(false)
            toast.error(t('payment.cancelled', 'Payment cancelled by user.'))
            if (onFailure) onFailure(new Error('Payment cancelled by user'))
          }
          return
        }

        // 2. Real Razorpay SDK Flow
        const isLoaded = await loadRazorpayScript()
        if (!isLoaded) {
          toast.error(t('payment.script_failed', 'Failed to load Razorpay payment gateway SDK.'))
          setLoading(false)
          if (onFailure) onFailure(new Error('SDK load failure'))
          return
        }

        if (!window.Razorpay) {
          setLoading(false)
          toast.error(
            t(
              'payment.gateway_loading',
              'Payment gateway is still loading. Please try again in a moment.',
            ),
          )
          if (onFailure) onFailure(new Error('Payment gateway not ready'))
          return
        }

        const options = {
          key: effectiveKey,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: t('payment.org_name', 'Gated Community'),
          description: t('payment.wallet_recharge', 'Digital Wallet Top-Up'),
          order_id: orderData.id,
          handler: async function (response) {
            try {
              setLoading(true)
              const verifyPayload = {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: amountVal,
              }
              const verification = await verifyWalletRechargePayment(verifyPayload)
              if (verification.success) {
                toast.success(t('payment.recharge_success', 'Wallet recharged successfully!'))
                if (onSuccess) onSuccess(verification.data)
              } else {
                throw new Error(verification.message || 'Signature verification failed')
              }
            } catch (err) {
              toast.error(err.message || t('payment.failed', 'Payment verification failed.'))
              if (onFailure) onFailure(err)
            } finally {
              setLoading(false)
            }
          },
          prefill: {
            name: user?.name || user?.username || '',
            email: user?.email || '',
            contact: user?.phone || user?.contact || user?.mobile || '',
          },
          notes: {
            purpose: 'Digital Wallet Recharge',
            userId: user?.id || user?._id || '',
          },
          theme: {
            color: '#321fdb',
          },
          modal: {
            ondismiss: function () {
              setLoading(false)
              toast.error(t('payment.cancelled', 'Payment cancelled by user.'))
              if (onFailure) onFailure(new Error('Payment cancelled by user'))
            },
          },
        }

        const rzp = new window.Razorpay(options)
        rzp.open()
      } catch (error) {
        setLoading(false)
        toast.error(error.message || t('payment.error', 'An error occurred during payment setup.'))
        if (onFailure) onFailure(error)
      }
    },
    [user, t],
  )

  return {
    rechargeWallet,
    loading,
  }
}

export default useWalletPayment
