import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import useResidentWallet from '../hooks/useResidentWallet.js'
import QrPassCard from '../components/wallet/QrPassCard.jsx'
import WalletEmptyState from '../components/wallet/WalletEmptyState.jsx'
import { WalletLoading, WalletError } from '../components/wallet/WalletStates.jsx'
import TransactionHistory from '../components/wallet/TransactionHistory.jsx'
import CancelBookingModal from '../components/booking/CancelBookingModal.jsx'
import WalletRechargeModal from '../components/wallet/WalletRechargeModal.jsx'
import AmenitiesTopNav from '../components/AmenitiesTopNav.jsx'
import { CRow, CCol, CCard, CCardBody } from '@coreui/react'
import '../styles/_amenities.scss'

const ResidentWalletView = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    activePasses,
    transactionHistory,
    balance,
    isPaymentGatewayConfigured,
    loading,
    error,
    loadWallet,
    cancelPass,
  } = useResidentWallet()
  const [showAddMoney, setShowAddMoney] = useState(false)

  const user = useSelector((state) => state.auth?.user)

  const [bookingToCancel, setBookingToCancel] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    loadWallet()
  }, [loadWallet])

  const handleCancelClick = (booking) => {
    setBookingToCancel(booking)
  }

  const handleConfirmCancel = async (bookingId, reason) => {
    setIsCancelling(true)
    const success = await cancelPass(bookingId, reason)
    setIsCancelling(false)
    if (success) {
      setBookingToCancel(null)
    }
  }

  const handleRechargeSuccess = () => {
    setShowAddMoney(false)
    loadWallet()
  }

  return (
    <div className="amenities-module-wrapper amenity-os-theme">
      <AmenitiesTopNav />
      <div className="view-container" style={{ maxWidth: '95%', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }} className="fs-2">
              {t('wallet.title', 'My Wallet')}
            </h1>
            <p className="text-muted mt-1 mb-0">
              {t('wallet.balance', 'Balance')}:{' '}
              <span className="fw-bold">₹{balance?.toFixed(2) || '0.00'}</span>
            </p>
          </div>
          <div>
            <button className="btn btn-primary" onClick={() => setShowAddMoney(true)}>
              {t('wallet.addMoney', 'Add Money')}
            </button>
          </div>
        </div>

        <h4 style={{ marginBottom: '16px' }} className="fs-5">
          {t('wallet.activePasses', 'Active Access Passes')}
        </h4>

        {loading && activePasses.length === 0 ? (
          <CCard className="mb-4 border-0 shadow-sm">
            <CCardBody>
              <WalletLoading />
            </CCardBody>
          </CCard>
        ) : error ? (
          <CCard className="mb-4 border-0 shadow-sm">
            <CCardBody>
              <WalletError message={error} />
            </CCardBody>
          </CCard>
        ) : activePasses.length === 0 ? (
          <CCard className="mb-4 border-0 shadow-sm">
            <CCardBody>
              <WalletEmptyState />
            </CCardBody>
          </CCard>
        ) : (
          <CRow className="g-4 mb-4">
            {activePasses.map((pass) => (
              <CCol xs={12} md={6} lg={4} key={pass._id}>
                <div className="wallet-pass-container h-100">
                  <QrPassCard booking={pass} onCancel={handleCancelClick} />
                </div>
              </CCol>
            ))}
          </CRow>
        )}

        <h4 style={{ marginBottom: '16px', marginTop: '24px' }} className="fs-5">
          {t('wallet.transactionHistory', 'Transaction History')}
        </h4>
        <TransactionHistory transactions={transactionHistory} loading={loading} />
      </div>

      <WalletRechargeModal
        isOpen={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        walletBalance={balance}
        isPaymentGatewayConfigured={isPaymentGatewayConfigured}
        onSuccess={handleRechargeSuccess}
        user={user}
      />

      <CancelBookingModal
        visible={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        onConfirm={handleConfirmCancel}
        booking={bookingToCancel}
        isSubmitting={isCancelling}
      />
    </div>
  )
}

export default ResidentWalletView
