import React from 'react'
import { useSelector } from 'react-redux'
import { usePlatformQuote } from '../hooks/usePlatformQuote.js'

const InstantQuoteAction = ({ quoteId, payload }) => {
  const { loading, orderStatus, generateOrder } = usePlatformQuote()

  const quotes = useSelector((state) => {
    const rawQuotes = state.platformBilling?.quotes
    if (!rawQuotes) return []
    return Array.isArray(rawQuotes) ? rawQuotes : rawQuotes.data || rawQuotes.docs || []
  })

  const invoices = useSelector((state) => {
    const rawInvoices = state.platformBilling?.invoices
    if (!rawInvoices) return []
    return Array.isArray(rawInvoices) ? rawInvoices : rawInvoices.data || rawInvoices.docs || []
  })

  const orders = useSelector((state) => {
    const rawOrders = state.platformBilling?.orders
    if (!rawOrders) return []
    return Array.isArray(rawOrders) ? rawOrders : rawOrders.data || rawOrders.docs || []
  })

  const targetInquiryStr = String(quoteId?._id || quoteId?.id || quoteId || '').trim()
  const hasValidId = targetInquiryStr.length === 24

  const isLocalStoragePersisted =
    hasValidId && localStorage.getItem('order_generated_' + targetInquiryStr) === 'true'

  const existingAcceptedQuote = hasValidId
    ? quotes.find((q) => {
        if (!q) return false
        const qInquiryStr = String(q.inquiryId?._id || q.inquiryId?.id || q.inquiryId || '').trim()
        const qIdStr = String(q._id || q.id || '').trim()
        const matchesId = qInquiryStr === targetInquiryStr || qIdStr === targetInquiryStr
        const isAccepted =
          q.status === 'ACCEPTED' || q.status === 'PAID' || q.orderEligibility === 'ORDER_CREATED'
        return matchesId && isAccepted
      })
    : null

  const existingOrder = hasValidId
    ? orders.find((o) => {
        if (!o) return false
        const oInquiryStr = String(o.inquiryId?._id || o.inquiryId?.id || o.inquiryId || '').trim()
        const oQuoteStr = String(o.quoteId?._id || o.quoteId?.id || o.quoteId || '').trim()
        return (
          (oInquiryStr === targetInquiryStr || oQuoteStr === targetInquiryStr) &&
          (oInquiryStr !== '' || oQuoteStr !== '')
        )
      })
    : null

  const existingInvoice = hasValidId
    ? invoices.find((inv) => {
        if (!inv) return false
        const invInquiryStr = String(
          inv.inquiryId?._id || inv.inquiryId?.id || inv.inquiryId || '',
        ).trim()
        return invInquiryStr === targetInquiryStr && invInquiryStr !== ''
      })
    : null

  const isOrderGenerated = Boolean(
    orderStatus === 'PAYMENT_PENDING' ||
    orderStatus === 'PROVISIONING' ||
    orderStatus === 'TRIAL_PENDING' ||
    existingAcceptedQuote ||
    existingOrder ||
    existingInvoice ||
    isLocalStoragePersisted,
  )

  const handleDispatchOrder = async () => {
    if (
      window.confirm(
        'Are you sure you want to generate the order and start the trial? This will create an invoice and a Razorpay payment link.',
      )
    ) {
      localStorage.setItem('order_generated_' + targetInquiryStr, 'true')
      await generateOrder(quoteId, payload)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
      {isOrderGenerated ? (
        <div className="alert alert-info" style={{ width: '100%', textAlign: 'center' }}>
          <strong>Order Generated!</strong>
          <p style={{ margin: '5px 0' }}>
            The Razorpay Payment Link has been generated and sent to the customer.
          </p>
          <p style={{ margin: '0' }}>
            You can track payment in <strong>Payment & Invoice</strong> and tenant status in{' '}
            <strong>Provisioning Pipeline</strong>.
          </p>
        </div>
      ) : (
        <>
          <button
            onClick={() => {}}
            disabled={loading}
            className="btn"
            style={{
              flex: 1,
              backgroundColor: '#fff',
              border: '1px solid #ced4da',
              color: '#495057',
              fontWeight: 'bold',
              padding: '12px',
            }}
          >
            Save Draft
          </button>
          <button
            onClick={handleDispatchOrder}
            disabled={loading}
            className="btn btn-primary"
            style={{
              flex: 1,
              fontWeight: 'bold',
              padding: '12px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
            }}
          >
            {loading ? 'Processing...' : 'Generate & Start Trial'}
          </button>
        </>
      )}
    </div>
  )
}

export default InstantQuoteAction
