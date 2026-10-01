import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useRazorpayCheckout } from '../../platformPayment/hooks/useRazorpayCheckout.js'
import { usePlatformSubscription } from '../hooks/usePlatformSubscription.js'
import { GST_RATE } from '../../../config/taxConfig.js'

const TenantSubscriptionCenter = () => {
  const { handleCheckout, isInitializing } = useRazorpayCheckout()

  const { subscription, loading, fetchMySubscription } = usePlatformSubscription()
  const [renewalTerm, setRenewalTerm] = useState('YEARLY')

  const { user } = useSelector((state) => state.auth)

  useEffect(() => {
    fetchMySubscription()
  }, [fetchMySubscription])

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-600 font-medium">Loading Subscription Data...</div>
    )
  }

  if (!subscription) {
    return (
      <div className="p-8 text-center text-red-500 font-medium bg-red-50 rounded border border-red-200 m-6">
        No active subscription found for this organization.
      </div>
    )
  }

  const status = subscription.status // 'TRIAL', 'EXPIRING_SOON', 'EXPIRED', 'ACTIVE'

  // Base logic for calculating UI pricing
  const baseMonthlyRate = 100 // In a real scenario, this is fetched from the backend master pricing
  let multiplier = 1
  switch (renewalTerm) {
    case 'MONTHLY':
      multiplier = 1
      break
    case 'QUARTERLY':
      multiplier = 3
      break
    case 'HALF_YEARLY':
      multiplier = 6
      break
    case 'YEARLY':
      multiplier = 12
      break
    default:
      multiplier = 12
  }
  const calculatedPrice = baseMonthlyRate * multiplier
  const tax = calculatedPrice * GST_RATE // GST calculated dynamically
  const grandTotal = calculatedPrice + tax

  const onRenewClick = () => {
    handleCheckout({
      term: renewalTerm,
      amount: grandTotal, // In practice, backend handles exact amount verification
      userName: user?.name || user?.firstName,
      userEmail: user?.email,
      organisationId: subscription.organisationId,
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 bg-white rounded-xl shadow-lg mt-8 border border-gray-100">
      <h2 className="text-2xl md:text-3xl font-extrabold mb-8 text-gray-900 border-b pb-4">
        Subscription & Renewal Center
      </h2>

      {/* Status Banners */}
      {status === 'TRIAL' && (
        <div className="mb-8 p-4 bg-blue-50 text-blue-800 border-l-4 border-blue-500 rounded flex items-center shadow-sm">
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <strong className="block text-lg">Trial Period Active</strong>
            You have{' '}
            {Math.max(
              0,
              Math.ceil((new Date(subscription.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)),
            )}{' '}
            days remaining on your free trial.
          </div>
        </div>
      )}

      {status === 'EXPIRING_SOON' && (
        <div className="mb-8 p-4 bg-orange-50 text-orange-800 border-l-4 border-orange-500 rounded flex items-center shadow-sm">
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          <div>
            <strong className="block text-lg">Warning: Expiring Soon</strong>
            Your subscription is expiring soon. Please renew to avoid service interruption.
          </div>
        </div>
      )}

      {status === 'EXPIRED' && (
        <div className="mb-8 p-4 bg-red-50 text-red-800 border-l-4 border-red-500 rounded flex items-center shadow-sm">
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          <div>
            <strong className="block text-lg">Critical Lockout</strong>
            Your subscription has expired. Access to your community workspace is locked until
            payment is settled.
          </div>
        </div>
      )}

      {/* Current Subscription Info */}
      <div className="mb-10 bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="text-xl font-bold mb-4 text-gray-800">Current Plan Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Plan Name</p>
            <p className="font-semibold text-lg">{subscription.planName || 'Enterprise Plan'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Status</p>
            <p className="font-semibold text-lg inline-flex items-center">
              <span
                className={`w-3 h-3 rounded-full mr-2 ${status === 'ACTIVE' ? 'bg-green-500' : status === 'EXPIRED' ? 'bg-red-500' : status === 'TRIAL' ? 'bg-blue-500' : 'bg-orange-500'}`}
              ></span>
              {status}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Valid Until</p>
            <p className="font-semibold text-lg">
              {new Date(
                subscription.billingPeriodEnd || subscription.validTill,
              ).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Renewal Action */}
      <div>
        <h3 className="text-xl font-bold mb-4 text-gray-800">Renew or Upgrade Subscription</h3>

        <div className="flex flex-col gap-3 mb-8">
          <label
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${renewalTerm === 'MONTHLY' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="renewalTerm"
              value="MONTHLY"
              checked={renewalTerm === 'MONTHLY'}
              onChange={(e) => setRenewalTerm(e.target.value)}
              className="mr-4 w-5 h-5 text-blue-600"
            />
            <span className="text-lg font-medium text-gray-800">Extend Monthly</span>
            <span className="ml-auto font-bold text-gray-600">
              ₹{(baseMonthlyRate * 1).toFixed(2)}
            </span>
          </label>

          <label
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${renewalTerm === 'QUARTERLY' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="renewalTerm"
              value="QUARTERLY"
              checked={renewalTerm === 'QUARTERLY'}
              onChange={(e) => setRenewalTerm(e.target.value)}
              className="mr-4 w-5 h-5 text-blue-600"
            />
            <span className="text-lg font-medium text-gray-800">Change to Quarterly</span>
            <span className="ml-auto font-bold text-gray-600">
              ₹{(baseMonthlyRate * 3).toFixed(2)}
            </span>
          </label>

          <label
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${renewalTerm === 'HALF_YEARLY' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="renewalTerm"
              value="HALF_YEARLY"
              checked={renewalTerm === 'HALF_YEARLY'}
              onChange={(e) => setRenewalTerm(e.target.value)}
              className="mr-4 w-5 h-5 text-blue-600"
            />
            <span className="text-lg font-medium text-gray-800">Change to Half-Yearly</span>
            <span className="ml-auto font-bold text-gray-600">
              ₹{(baseMonthlyRate * 6).toFixed(2)}
            </span>
          </label>

          <label
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${renewalTerm === 'YEARLY' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500 shadow-sm' : 'hover:bg-gray-50'}`}
          >
            <input
              type="radio"
              name="renewalTerm"
              value="YEARLY"
              checked={renewalTerm === 'YEARLY'}
              onChange={(e) => setRenewalTerm(e.target.value)}
              className="mr-4 w-5 h-5 text-blue-600"
            />
            <div>
              <span className="text-lg font-medium text-gray-800 block">Extend 1 Year</span>
              <span className="text-sm font-semibold text-green-600">★ Recommended</span>
            </div>
            <span className="ml-auto font-bold text-gray-600">
              ₹{(baseMonthlyRate * 12).toFixed(2)}
            </span>
          </label>
        </div>

        <div className="bg-gray-800 text-white p-6 rounded-lg mb-8 shadow-inner">
          <div className="flex justify-between mb-3 text-gray-300 text-lg">
            <span>Subtotal:</span>
            <span>₹{calculatedPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-3 text-gray-300 text-lg">
            <span>Tax ({GST_RATE * 100}% GST):</span>
            <span>₹{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-extrabold text-2xl pt-4 border-t border-gray-600 text-green-400">
            <span>Total to Pay:</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onRenewClick}
          disabled={isInitializing}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-4 px-6 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all disabled:opacity-75 disabled:cursor-not-allowed text-lg flex items-center justify-center"
        >
          {isInitializing ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-6 w-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Initializing Secure Checkout...
            </>
          ) : (
            `Pay ₹${grandTotal.toFixed(2)} via Razorpay`
          )}
        </button>
      </div>
    </div>
  )
}

export default TenantSubscriptionCenter
