import React, { useEffect, useState } from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling.js'

const PlatformQuotesView = () => {
  const { quotes = [], fetchAllData } = usePlatformBilling()
  const [selectedQuote, setSelectedQuote] = useState(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Platform Quotes</h1>
          <div className="sub">Pricing breakdown snapshots including Free Trial terms.</div>
        </div>
      </div>
      <div className="panel panel-body table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Quote #</th>
              <th>Community</th>
              <th>Trial Duration</th>
              <th>Post-Trial Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((item) => {
              const orgName =
                item.organizationId?.name ||
                item.organizationName ||
                item.communitySnapshot?.organizationName ||
                item.customerSnapshot?.organizationName ||
                item.inquiryId?.organizationName ||
                'Your Community'
              const total = item.totalAmount || item.grandTotal || 0
              return (
                <tr key={item._id || item.id}>
                  <td>
                    <strong>{item.quoteNumber || item._id}</strong>
                  </td>
                  <td>{orgName}</td>
                  <td>
                    <span className={`badge ${item.trialDays > 0 ? 'blue' : 'gray'}`}>
                      {item.trialDays ? `${item.trialDays} Days Free Trial` : '14 Days Free Trial'}
                    </span>
                  </td>
                  <td>
                    <strong>₹{total.toLocaleString('en-IN')}</strong>
                  </td>
                  <td>
                    <span
                      className={`badge ${item.status === 'ACCEPTED' || item.status === 'APPROVED' ? 'green' : 'blue'}`}
                    >
                      {item.status || 'ACCEPTED'}
                    </span>
                  </td>
                  <td>
                    <button className="btn small primary" onClick={() => setSelectedQuote(item)}>
                      View Snapshot
                    </button>
                  </td>
                </tr>
              )
            })}
            {quotes.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  No quotes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quote Snapshot Modal */}
      {selectedQuote && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h2>Quote Snapshot — {selectedQuote.quoteNumber || selectedQuote._id}</h2>
              <button className="close-btn" onClick={() => setSelectedQuote(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div>
                <strong>Community Name:</strong>{' '}
                {selectedQuote.organizationId?.name ||
                  selectedQuote.organizationName ||
                  selectedQuote.communitySnapshot?.organizationName ||
                  selectedQuote.customerSnapshot?.organizationName ||
                  selectedQuote.inquiryId?.organizationName ||
                  'Your Community'}
              </div>
              <div>
                <strong>Plan &amp; Tier:</strong>{' '}
                {selectedQuote.pricingSnapshot?.planName ||
                  selectedQuote.pricingSnapshot?.tier ||
                  selectedQuote.planName ||
                  'COMMUNITY_STARTER'}
              </div>
              <div>
                <strong>Unit / Villa Count:</strong>{' '}
                {selectedQuote.communitySnapshot?.villaCount || selectedQuote.unitCount || 100}{' '}
                Units
              </div>
              <div>
                <strong>Free Trial Duration:</strong> {selectedQuote.trialDays || 14} Days
              </div>
              <div>
                <strong>Total Quote Amount:</strong> ₹
                {(selectedQuote.totalAmount || selectedQuote.grandTotal || 0).toLocaleString(
                  'en-IN',
                )}{' '}
                INR
              </div>
              <div>
                <strong>Quote Status:</strong>{' '}
                <span className="badge green">{selectedQuote.status || 'ACCEPTED'}</span>
              </div>
              <div>
                <strong>Acceptance Token:</strong> ACC-
                {selectedQuote._id?.substring(0, 8) || 'TOKEN'}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setSelectedQuote(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PlatformQuotesView
