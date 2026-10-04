import React from 'react'
import { CContainer, CRow, CCol, CCard, CCardBody, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle, cilBuilding } from '@coreui/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuth from '../../auth/hooks/useAuth'

const EnquiryPendingView = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="bg-body-secondary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8} lg={6}>
            <CCard className="shadow-lg border-0 rounded-4 text-center">
              <CCardBody className="p-5">
                <div className="mb-4">
                  <CIcon
                    icon={cilCheckCircle}
                    size="3xl"
                    className="text-success mb-3"
                    style={{ width: '64px', height: '64px' }}
                  />
                </div>
                <h2 className="fw-bold text-body mb-3">Enquiry Submitted Successfully!</h2>
                <p className="text-muted mb-4" style={{ fontSize: '16px', lineHeight: '1.6' }}>
                  Your request has been received. Our team will review your community details and
                  requested features. Once approved and payment is verified, your account will be
                  fully activated.
                </p>
                <div className="d-flex align-items-center justify-content-center gap-2 mb-5">
                  <CIcon icon={cilBuilding} className="text-primary" />
                  <span className="fw-semibold text-primary">Status: Pending Verification</span>
                </div>
                <CButton color="primary" size="lg" className="w-100" onClick={handleLogout}>
                  Return to Home
                </CButton>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default EnquiryPendingView
