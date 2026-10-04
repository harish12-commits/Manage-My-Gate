import React, { useEffect, useState } from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling.js'

const OrderDetailsView = () => {
  const { orders = [], fetchAllData } = usePlatformBilling()
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    fetchAllData()
  }, [])

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Platform Orders</h1>
          <div className="sub">Immutable financial snapshots supporting Free Trial orders.</div>
        </div>
      </div>

      <div className="panel panel-body table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Community</th>
              <th>Order Type / Plan</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item) => {
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
                    <strong>{item.orderNumber || item._id}</strong>
                  </td>
                  <td>{orgName}</td>
                  <td>
                    {item.pricingSnapshot?.planName ||
                      item.pricingSnapshot?.tier ||
                      item.orderType ||
                      'COMMUNITY_STARTER'}
                  </td>
                  <td>
                    <strong>₹{total.toLocaleString('en-IN')}</strong>
                  </td>
                  <td>
                    <span className="badge green">
                      {item.orderStatus || item.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <button className="btn small primary" onClick={() => setSelectedOrder(item)}>
                      View Order
                    </button>
                  </td>
                </tr>
              )
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Order Snapshot Modal */}
      {selectedOrder && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <h2>Order Details — {selectedOrder.orderNumber || selectedOrder._id}</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div>
                <strong>Community Name:</strong>{' '}
                {selectedOrder.organizationId?.name ||
                  selectedOrder.organizationName ||
                  selectedOrder.communitySnapshot?.organizationName ||
                  selectedOrder.customerSnapshot?.organizationName ||
                  selectedOrder.inquiryId?.organizationName ||
                  'Your Community'}
              </div>
              <div>
                <strong>Plan / Package:</strong>{' '}
                {selectedOrder.pricingSnapshot?.planName ||
                  selectedOrder.pricingSnapshot?.tier ||
                  selectedOrder.planName ||
                  'COMMUNITY_STARTER'}
              </div>
              <div>
                <strong>Billing Frequency:</strong> {selectedOrder.billingFrequency || 'YEARLY'}
              </div>
              <div>
                <strong>Order Status:</strong>{' '}
                <span className="badge green">
                  {selectedOrder.orderStatus || selectedOrder.status || 'ACTIVE'}
                </span>
              </div>
              <div>
                <strong>Payment Status:</strong>{' '}
                <span className="badge blue">
                  {selectedOrder.paymentStatus || (selectedOrder.isTrial ? 'TRIAL_ACTIVE' : 'PAID')}
                </span>
              </div>
              <div>
                <strong>Total Order Amount:</strong> ₹
                {(selectedOrder.totalAmount || selectedOrder.grandTotal || 0).toLocaleString(
                  'en-IN',
                )}{' '}
                INR
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn primary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default OrderDetailsView
