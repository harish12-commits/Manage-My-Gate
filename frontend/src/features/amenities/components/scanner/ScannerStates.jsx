import React, { memo } from 'react'
import { CCard, CCardBody } from '@coreui/react'
import AppLoader from '../../../../components/common/AppLoader'

export const ScannerLoading = memo(() => (
  <CCard className="border-0 shadow-sm text-center bg-body-secondary h-100 d-flex flex-column justify-content-center">
    <CCardBody className="p-5 d-flex flex-column align-items-center justify-content-center">
      <AppLoader variant="block" />
      <h5 className="fw-bold mb-1">Verifying Pass...</h5>
      <p className="text-muted mb-0 small">
        Please hold while we check this booking with the server.
      </p>
    </CCardBody>
  </CCard>
))

export const ScannerError = memo(({ message }) => (
  <CCard className="border-0 shadow-sm text-center border-danger border-opacity-50 bg-danger bg-opacity-10 h-100 d-flex flex-column justify-content-center">
    <CCardBody className="p-5">
      <div
        className="rounded-circle bg-body text-danger d-inline-flex align-items-center justify-content-center shadow-sm mb-4"
        style={{ width: '80px', height: '80px' }}
      >
        <i className="fa-solid fa-triangle-exclamation fs-1"></i>
      </div>
      <h5 className="text-danger fw-bold">Camera Initialization Failed</h5>
      <p className="text-danger opacity-75 mb-0">
        {message || 'Could not access the camera. Please check permissions.'}
      </p>
    </CCardBody>
  </CCard>
))
