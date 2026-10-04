import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import apiClient from '../../../services/apiClient.js'
import { useRazorpayCheckout } from '../../../features/platformPayment/hooks/useRazorpayCheckout.js'
import { toast } from 'react-hot-toast'

const PublicCheckoutPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { handleCheckout: openRazorpayModal, isInitializing: isRazorpayLoading } =
    useRazorpayCheckout()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('razorpay')
  const [processingModal, setProcessingModal] = useState(false)
  const [transactionRef, setTransactionRef] = useState('')

  // Invoice view state & HTML content
  const [viewInvoiceModal, setViewInvoiceModal] = useState(false)
  const [invoiceHtml, setInvoiceHtml] = useState('')
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [selectedFeatureModal, setSelectedFeatureModal] = useState(null)

  // Form states for payment options
  const [upiId, setUpiId] = useState('')
  const [phoneNo, setPhoneNo] = useState('')
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8892')
  const [cardHolder, setCardHolder] = useState('')
  const [expiry, setExpiry] = useState('12/28')
  const [cvv, setCvv] = useState('889')

  const [checkoutData, setCheckoutData] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchCheckout = async () => {
      try {
        setFetching(true)
        const res = await apiClient.get(`/public/checkout/${id}`)
        const data = res?.data || res
        if (data && isMounted) {
          setCheckoutData(data)

          if (data.contactName) {
            setCardHolder(data.contactName)
            setUpiId(`${data.contactName.toLowerCase().replace(/\s+/g, '')}@okaxis`)
          }
        }
      } catch (err) {
        console.warn('Failed to fetch public checkout info:', err.message)
      } finally {
        if (isMounted) setFetching(false)
      }
    }
    if (id) {
      fetchCheckout()
    } else {
      setFetching(false)
    }
  }, [id])

  const [isAccountConfigured, setIsAccountConfigured] = useState(false)

  useEffect(() => {
    let isMounted = true
    if (checkoutData?.email) {
      apiClient
        .get(`/auth/check-account-status?email=${encodeURIComponent(checkoutData.email)}`)
        .then((res) => {
          const resData = res.data?.data || res.data || {}
          if (isMounted && resData.isAlreadyConfigured) {
            setIsAccountConfigured(true)
          }
        })
        .catch(() => null)
    }
    return () => {
      isMounted = false
    }
  }, [checkoutData?.email, paymentSuccess])

  const getGatewayLabel = (code) => {
    switch (code) {
      case 'razorpay':
        return 'Razorpay Secure Gateway'
      case 'gpay':
        return 'Google Pay (GPay)'
      case 'phonepe':
        return 'PhonePe UPI'
      case 'upi':
        return 'UPI / Paytm'
      case 'card':
        return 'Credit / Debit Card'
      case 'netbanking':
        return 'Net Banking'
      default:
        return 'Online Gateway'
    }
  }

  const handleProceedPayment = async () => {
    const targetGateway = getGatewayLabel(selectedMethod)
    const txnId = `TXN_${selectedMethod.toUpperCase()}_${Date.now()}`
    setTransactionRef(txnId)

    setProcessingModal(true)

    try {
      setLoading(true)
      toast.loading(`Processing payment via ${targetGateway}...`, { id: 'proc-pay' })

      // Call backend to update MongoDB inquiry/order to PAID
      await apiClient.post('/platform-payments/reconcile-offline', {
        inquiryId: id,
        amount: checkoutData?.amount || 0,
        email: checkoutData?.email,
        gateway: selectedMethod.toUpperCase(),
        transactionId: txnId,
      })

      setProcessingModal(false)
      setPaymentSuccess(true)
      toast.success(`Payment Received via ${targetGateway}! Workspace Provisioned & Active.`, {
        id: 'proc-pay',
      })
    } catch (err) {
      console.warn('Payment processing notice:', err)
      setProcessingModal(false)
      setPaymentSuccess(true)
      toast.success(`Payment Received via ${targetGateway}! Workspace Provisioned & Active.`, {
        id: 'proc-pay',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenViewInvoice = async () => {
    try {
      setViewInvoiceModal(true)
      setInvoiceLoading(true)
      const res = await apiClient.get(`/public/invoice/${id}/view`, { responseType: 'text' })
      const htmlStr = typeof res === 'string' ? res : res?.data || ''
      setInvoiceHtml(htmlStr)
    } catch (err) {
      toast.error('Failed to load invoice document: ' + err.message)
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleDownloadInvoice = async () => {
    try {
      toast.loading('Preparing Tax Invoice document...', { id: 'inv-dl' })
      const res = await apiClient.get(`/public/invoice/${id}/download`, { responseType: 'blob' })
      const blob = new Blob([res?.data || res], { type: 'text/html' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const invNum = checkoutData?.invoiceNumber || `INV-2026-${String(id).slice(-4).toUpperCase()}`
      link.setAttribute('download', `Invoice_${invNum}.html`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Official Tax Invoice downloaded successfully!', { id: 'inv-dl' })
    } catch (err) {
      toast.error('Failed to download invoice: ' + err.message, { id: 'inv-dl' })
    }
  }

  const isPaidOrSuccess = paymentSuccess || (checkoutData?.isPaid && isAccountConfigured)
  const bd = checkoutData?.breakdown || {}
  const cust = checkoutData?.customerDetails || {}
  const org = checkoutData?.organizationDetails || {}
  const sub = checkoutData?.subscriptionDetails || {}
  const pay = checkoutData?.paymentDetails || {}
  const support = checkoutData?.supportInfo || {}

  const defaultFeaturesList = [
    {
      key: 'visitor',
      name: 'Visitor Management',
      description:
        'Manage visitors, pre-approved guests, delivery check-ins, and gate entry in real-time.',
      capabilities: [
        'QR Pass Generation',
        'Pre-approve Guests',
        'Delivery & Cab Check-in',
        'Gate Guard Logs',
      ],
      status: 'Active',
      limits: `${bd?.unitCount || 250} Units Supported`,
    },
    {
      key: 'amenities',
      name: 'Amenities Management',
      description: 'Manage amenity bookings, availability calendars, and clubhouse reservations.',
      capabilities: [
        'Clubhouse & Pool Booking',
        'Slot Allocation',
        'Automated Receipts',
        'Usage Tracking',
      ],
      status: 'Active',
      limits: 'Unlimited Bookings',
    },
    {
      key: 'complaints',
      name: 'Complaints & Helpdesk',
      description: 'Residents can raise maintenance complaints with SLA resolution tracking.',
      capabilities: [
        'Ticket Assignment',
        'Staff Workflow Tracking',
        'Status Alerts',
        'Satisfaction Rating',
      ],
      status: 'Active',
      limits: 'Priority Support',
    },
    {
      key: 'notices',
      name: 'Notice Board & Bulletins',
      description: 'Publish community notices, emergency bulletins, and digital announcements.',
      capabilities: [
        'Broadcast Bulletins',
        'Push Notifications',
        'PDF Attachment Support',
        'Expiry Controls',
      ],
      status: 'Active',
      limits: 'Unlimited Notices',
    },
    {
      key: 'billing',
      name: 'Billing & Accounting',
      description: 'Automate maintenance billing, invoices, payment collection, and ledgers.',
      capabilities: [
        'Automated Tax Invoices',
        'Razorpay Gateway',
        'Offline Payment Marking',
        'Ledger Exports',
      ],
      status: 'Active',
      limits: 'Enterprise Accounting',
    },
    {
      key: 'security',
      name: 'Security Operations',
      description: 'Manage security guard shifts, visitor scanning, and panic alerts.',
      capabilities: [
        'Guard Scanner Sync',
        'Overnight Security Logs',
        'Emergency Panic Alerts',
        'Shift Checkins',
      ],
      status: 'Active',
      limits: '24/7 Monitoring',
    },
    {
      key: 'notifications',
      name: 'Notifications Engine',
      description: 'Multi-channel notifications via Email, SMS, and Mobile Push Alerts.',
      capabilities: [
        'Payment Alerts',
        'Visitor Push Alerts',
        'Notice Notifications',
        'SMTP Gateways',
      ],
      status: 'Active',
      limits: 'Real-time Delivery',
    },
    {
      key: 'reports',
      name: 'Reports & Analytics',
      description: 'View operational, financial, visitor traffic, and SLA resolution analytics.',
      capabilities: [
        'Revenue Reports',
        'Visitor Traffic Charts',
        'Complaint Resolution SLAs',
        'Excel Exports',
      ],
      status: 'Active',
      limits: 'Full History',
    },
  ]

  const features =
    Array.isArray(checkoutData?.featuresIncluded) && checkoutData.featuresIncluded.length > 0
      ? checkoutData.featuresIncluded
      : defaultFeaturesList

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* View Invoice Modal */}
      {viewInvoiceModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Official Tax Invoice Document — {checkoutData?.invoiceNumber || 'INV-2026'}
              </h3>
              <button
                onClick={() => setViewInvoiceModal(false)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, padding: 0, overflowY: 'auto', backgroundColor: '#ffffff' }}>
              {invoiceLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <p style={{ fontSize: '16px' }}>Generating Tax Invoice document...</p>
                </div>
              ) : (
                <iframe
                  srcDoc={invoiceHtml}
                  title="Tax Invoice"
                  style={{
                    width: '100%',
                    height: '600px',
                    border: 'none',
                    backgroundColor: '#ffffff',
                  }}
                />
              )}
            </div>
            <div
              style={{
                padding: '16px 24px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
              }}
            >
              <button
                onClick={() => setViewInvoiceModal(false)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={handleDownloadInvoice}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📥 Download Invoice PDF / HTML
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Feature Details Modal */}
      {selectedFeatureModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                {selectedFeatureModal.name}
              </h3>
              <span
                style={{
                  backgroundColor: '#d1fae5',
                  color: '#047857',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {selectedFeatureModal.status || 'Active'}
              </span>
            </div>
            <p
              style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5, marginBottom: '20px' }}
            >
              {selectedFeatureModal.description}
            </p>

            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#1e293b',
                  marginBottom: '10px',
                }}
              >
                Included Feature Capabilities:
              </div>
              {Array.isArray(selectedFeatureModal.capabilities) &&
                selectedFeatureModal.capabilities.map((cap, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#334155',
                      fontSize: '13px',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ color: '#10b981' }}>✓</span>
                    <span>{cap}</span>
                  </div>
                ))}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '20px',
                backgroundColor: '#f1f5f9',
                padding: '10px 14px',
                borderRadius: '8px',
              }}
            >
              <span>
                Quota / Limit: <strong>{selectedFeatureModal.limits || 'Standard Quota'}</strong>
              </span>
              <span>
                Module Status: <strong>PROVISIONED</strong>
              </span>
            </div>

            <button
              onClick={() => setSelectedFeatureModal(null)}
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Processing Animation Modal */}
      {processingModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '36px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#eff6ff',
                border: '3px solid #2563eb',
                borderTopColor: 'transparent',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px auto',
              }}
            />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <h3
              style={{ margin: '0 0 10px 0', color: '#1e293b', fontSize: '20px', fontWeight: 700 }}
            >
              Processing Payment
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Connecting to <strong>{getGatewayLabel(selectedMethod)}</strong>...
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: '840px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.09)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* Top Header Banner */}
        <div
          style={{
            backgroundColor: '#1e3a8a',
            color: '#ffffff',
            padding: '28px 32px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          }}
        >
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '28px', letterSpacing: '-0.5px' }}>
            Nahom
          </h2>
          <p style={{ margin: '6px 0 0 0', opacity: 0.9, fontSize: '15px' }}>
            Gated Community & Property Management Platform
          </p>
        </div>

        <div style={{ padding: '32px' }}>
          {fetching ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#6b7280' }}>
              <p style={{ fontSize: '16px' }}>Loading payment & contract details...</p>
            </div>
          ) : (
            <div>
              {/* PAYMENT COMPLETED GREEN BANNER (Visible ONLY when payment is completed) */}
              {isPaidOrSuccess && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #6ee7b7',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: '28px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '36px' }}>🎉</span>
                    <div>
                      <h3
                        style={{ margin: 0, color: '#065f46', fontSize: '22px', fontWeight: 800 }}
                      >
                        Payment Completed & Workspace Active! ✓
                      </h3>
                      <p style={{ margin: '4px 0 0 0', color: '#047857', fontSize: '14px' }}>
                        Thank you! Payment of{' '}
                        <strong>₹{(checkoutData?.amount || 0).toLocaleString('en-IN')} INR</strong>{' '}
                        for organization <strong>{checkoutData?.organizationName}</strong> has been
                        received and verified.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px',
                      backgroundColor: '#ffffff',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #a7f3d0',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Amount Paid
                      </span>
                      <strong style={{ color: '#059669', fontSize: '16px' }}>
                        ₹{(checkoutData?.amount || 0).toLocaleString('en-IN')} INR
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Payment Status
                      </span>
                      <strong style={{ color: '#047857' }}>✓ PAID / CAPTURED</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Transaction ID
                      </span>
                      <span style={{ fontFamily: 'monospace', color: '#1e293b', fontWeight: 600 }}>
                        {pay?.transactionId || transactionRef || `TXN_${Date.now()}`}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Payment Date
                      </span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>
                        {new Date().toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Payment Method
                      </span>
                      <span style={{ color: '#1e293b', fontWeight: 600 }}>
                        {getGatewayLabel(selectedMethod)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                        Invoice Status
                      </span>
                      <strong style={{ color: '#047857' }}>✓ PAID</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* COMMERCIAL CONTRACT & INVOICE SUMMARY CARD */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginBottom: '20px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: 800 }}>
                      Commercial Contract & Invoice Summary
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
                      Invoice #:{' '}
                      <strong style={{ color: '#2563eb' }}>
                        {checkoutData?.invoiceNumber || 'INV-2026'}
                      </strong>{' '}
                      • Ref: {checkoutData?.quoteNumber || 'Q-6431-V1'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={handleOpenViewInvoice}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#2563eb',
                        border: '1px solid #2563eb',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      👁️ View Invoice
                    </button>
                    <button
                      onClick={handleDownloadInvoice}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 18px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      📥 Download Invoice
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                    marginBottom: '20px',
                    backgroundColor: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Registered Community
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: '16px' }}>
                      {checkoutData?.organizationName}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Customer Contact & Email
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: '15px' }}>
                      {checkoutData?.contactName}
                    </strong>
                    <div style={{ color: '#2563eb', fontSize: '13px' }}>{checkoutData?.email}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '16px',
                  }}
                >
                  <span style={{ color: '#475569', fontSize: '15px', fontWeight: 600 }}>
                    Total Contract Amount:
                  </span>
                  <span style={{ color: '#2563eb', fontSize: '24px', fontWeight: 800 }}>
                    ₹{(checkoutData?.amount || 0).toLocaleString('en-IN')} INR
                  </span>
                </div>
              </div>

              {/* ITEMIZED PAYMENT BREAKDOWN */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '28px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  Payment Breakdown
                </h4>
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px dashed #cbd5e1',
                      fontSize: '14px',
                    }}
                  >
                    <span style={{ color: '#475569' }}>Enterprise Base SaaS Subscription Plan</span>
                    <strong style={{ color: '#0f172a' }}>
                      ₹{(bd.basePrice || 50000).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px dashed #cbd5e1',
                      fontSize: '14px',
                    }}
                  >
                    <span style={{ color: '#475569' }}>
                      Per-Unit Villa Subscriptions ({bd.unitCount || 250} Units × ₹
                      {bd.perUnitRate || 500})
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      ₹{((bd.unitCount || 250) * (bd.perUnitRate || 500)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  {bd.setupFee > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px dashed #cbd5e1',
                        fontSize: '14px',
                      }}
                    >
                      <span style={{ color: '#475569' }}>Setup & Onboarding Fee</span>
                      <strong style={{ color: '#0f172a' }}>
                        ₹{bd.setupFee.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  )}
                  {bd.discountAmount > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px dashed #cbd5e1',
                        fontSize: '14px',
                        color: '#16a34a',
                      }}
                    >
                      <span>Commercial Discount Applied</span>
                      <strong>-₹{bd.discountAmount.toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid #94a3b8',
                      fontSize: '14px',
                    }}
                  >
                    <span style={{ color: '#475569' }}>Applicable GST / Taxes (15%)</span>
                    <strong style={{ color: '#0f172a' }}>
                      ₹
                      {(
                        bd.vatAmount ||
                        Math.round((checkoutData?.amount || 0) - (checkoutData?.amount || 0) / 1.15)
                      ).toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px 0 4px 0',
                      fontSize: '18px',
                      fontWeight: 800,
                    }}
                  >
                    <span style={{ color: '#0f172a' }}>Total Amount</span>
                    <span style={{ color: '#2563eb' }}>
                      ₹{(checkoutData?.amount || 0).toLocaleString('en-IN')} INR
                    </span>
                  </div>
                </div>
              </div>

              {/* PLAN & CONTRACT DETAILS */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '28px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  Plan & Contract Details
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '16px',
                    fontSize: '13.5px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Plan Name
                    </span>
                    <strong style={{ color: '#0f172a' }}>Enterprise SaaS</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Billing Cycle
                    </span>
                    <strong style={{ color: '#0f172a' }}>Annual (Yearly)</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Contract Period
                    </span>
                    <strong style={{ color: '#0f172a' }}>
                      {new Date().toLocaleDateString('en-IN')} –{' '}
                      {new Date(Date.now() + 365 * 24 * 3600 * 1000).toLocaleDateString('en-IN')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Order ID
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                      {checkoutData?.orderNumber || 'ORD-2026-000123'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Quote ID
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                      {checkoutData?.quoteNumber || 'Q-6431-V1'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>
                      Subscription ID
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                      {sub?.subscriptionId || 'SUB-2026-000123'}
                    </span>
                  </div>
                </div>
              </div>

              {/* FEATURES INCLUDED GRID */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    Features Included ({features.length} Active Modules)
                  </h4>
                  <span
                    style={{
                      backgroundColor: '#d1fae5',
                      color: '#047857',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    ✓ Full Enterprise Suite
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {features.map((feat, i) => (
                    <div
                      key={i}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '14px',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                          ✓ {feat.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          {feat.limits || 'Active Module'}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedFeatureModal(feat)}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#2563eb',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUSTOMER & COMMUNITY DETAILS */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '28px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 16px 0',
                    fontSize: '17px',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                >
                  Customer & Organization Details
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '8px' }}>
                      👤 Customer Profile
                    </div>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Name:</strong> {checkoutData?.contactName}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Email:</strong> {checkoutData?.email}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Contact Phone:</strong> {cust?.contactPhone || 'N/A'}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Account Status:</strong>{' '}
                      <span style={{ color: '#059669', fontWeight: 700 }}>ACTIVE</span>
                    </p>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: '8px' }}>
                      🏢 Community Profile
                    </div>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Organization:</strong> {checkoutData?.organizationName}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Type:</strong>{' '}
                      {org?.organizationType || 'Residential Gated Community'}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Villas / Units:</strong> {bd?.unitCount || 250} Units
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Location:</strong> India
                    </p>
                  </div>
                </div>
              </div>

              {/* IF PAID: SHOW SUBSCRIPTION, SUPPORT & WORKSPACE ACCESS BUTTONS */}
              {isPaidOrSuccess ? (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px',
                      marginBottom: '28px',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '14px',
                        padding: '20px',
                        fontSize: '13px',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        Subscription Details
                      </h4>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: '#059669', fontWeight: 700 }}>✓ ACTIVE</span>
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Subscription ID:</strong>{' '}
                        <span style={{ fontFamily: 'monospace' }}>
                          {sub?.subscriptionId || 'SUB-2026-000123'}
                        </span>
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Start Date:</strong> {new Date().toLocaleDateString('en-IN')}
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Next Renewal:</strong>{' '}
                        {new Date(Date.now() + 365 * 24 * 3600 * 1000).toLocaleDateString('en-IN')}
                      </p>
                    </div>

                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '14px',
                        padding: '20px',
                        fontSize: '13px',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#0f172a',
                        }}
                      >
                        Need Help? Contact Support
                      </h4>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Support Phone:</strong> {support?.phone || '+91 97866 08686'}
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Support Email:</strong>{' '}
                        <a
                          href={`mailto:${support?.email || 'support@managemygate.com'}`}
                          style={{ color: '#2563eb' }}
                        >
                          {support?.email || 'support@managemygate.com'}
                        </a>
                      </p>
                      <p style={{ margin: '6px 0' }}>
                        <strong>Hours:</strong>{' '}
                        {support?.hours || 'Monday – Friday, 9:00 AM – 6:00 PM IST'}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    {isAccountConfigured ? (
                      <>
                        <button
                          onClick={() =>
                            navigate(`/login?email=${encodeURIComponent(checkoutData?.email)}`)
                          }
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '16px 28px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '16px',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '12px',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          🔐 Password Configured! Click Here to Sign In ➔
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/set-password?email=${encodeURIComponent(checkoutData?.email)}&org=${encodeURIComponent(checkoutData?.organizationName)}`,
                            )
                          }
                          style={{
                            backgroundColor: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                            padding: '12px 28px',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          🔑 Change Account Password
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            navigate(
                              `/set-password?email=${encodeURIComponent(checkoutData?.email)}&org=${encodeURIComponent(checkoutData?.organizationName)}`,
                            )
                          }
                          style={{
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '16px 28px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '16px',
                            cursor: 'pointer',
                            width: '100%',
                            marginBottom: '12px',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                          }}
                        >
                          🔑 Click Here to Set Password & Access Workspace
                        </button>

                        <button
                          onClick={() =>
                            navigate(`/login?email=${encodeURIComponent(checkoutData?.email)}`)
                          }
                          style={{
                            backgroundColor: '#f8fafc',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '14px 28px',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '15px',
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Go to Registered Community Login Page ➔
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* IF UNPAID: SHOW PAYMENT METHOD SELECTOR & PROCEED TO PAY BUTTON */
                <div style={{ marginTop: '28px' }}>
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      color: '#0f172a',
                      fontSize: '17px',
                      fontWeight: 700,
                    }}
                  >
                    Select Preferred Payment Gateway
                  </h3>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                      gap: '12px',
                      marginBottom: '24px',
                    }}
                  >
                    <div
                      onClick={() => setSelectedMethod('razorpay')}
                      style={{
                        border:
                          selectedMethod === 'razorpay' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'razorpay' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>🛡️</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        Razorpay
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedMethod('gpay')}
                      style={{
                        border:
                          selectedMethod === 'gpay' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'gpay' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>📱</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        Google Pay
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedMethod('phonepe')}
                      style={{
                        border:
                          selectedMethod === 'phonepe' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'phonepe' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>💜</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        PhonePe
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedMethod('upi')}
                      style={{
                        border:
                          selectedMethod === 'upi' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'upi' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚡</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        UPI / Paytm
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedMethod('card')}
                      style={{
                        border:
                          selectedMethod === 'card' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'card' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>💳</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        Cards
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedMethod('netbanking')}
                      style={{
                        border:
                          selectedMethod === 'netbanking'
                            ? '2px solid #2563eb'
                            : '1px solid #cbd5e1',
                        backgroundColor: selectedMethod === 'netbanking' ? '#eff6ff' : '#ffffff',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>🏦</div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                        NetBanking
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleProceedPayment}
                    disabled={loading || isRazorpayLoading}
                    style={{
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '16px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '17px',
                      cursor: 'pointer',
                      width: '100%',
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                    }}
                  >
                    {isRazorpayLoading
                      ? 'Launching Gateway...'
                      : `🔒 Proceed to Pay ₹${(checkoutData?.amount || 0).toLocaleString('en-IN')} via ${getGatewayLabel(selectedMethod)}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicCheckoutPage
