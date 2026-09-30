import React, { memo } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import AppLoader from '../../../../components/common/AppLoader'

export const WalletLoading = memo(() => (
  <CCard className="border-0 shadow-sm text-center bg-body-secondary">
    <CCardBody className="p-5">
      <AppLoader variant="block" />
      <p className="text-muted mb-0">Loading your digital wallet...</p>
    </CCardBody>
  </CCard>
))

export const WalletError = memo(({ message }) => (
  <CCard className="border-0 shadow-sm text-center border-danger border-opacity-50 bg-danger bg-opacity-10">
    <CCardBody className="p-5">
      <i className="fa-solid fa-triangle-exclamation fs-1 text-danger mb-3"></i>
      <h5 className="text-danger">Failed to Load Wallet</h5>
      <p className="text-danger opacity-75 mb-0">{message || 'An unexpected error occurred.'}</p>
    </CCardBody>
  </CCard>
))
