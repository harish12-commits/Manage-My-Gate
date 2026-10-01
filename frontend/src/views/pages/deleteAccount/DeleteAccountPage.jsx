import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CForm,
  CFormInput,
  CFormTextarea,
  CAlert,
  CSpinner,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilUserX, cilArrowLeft, cilShieldAlt, cilCheckCircle, cilLockLocked } from '@coreui/icons'
import apiClient from '../../../services/apiClient.js'
import { logout } from '../../../features/auth/store/authSlice.js'

/**
 * Account Deletion Page Component for Nahom / ManageMyGate
 *
 * Provides self-service instant deletion for authenticated users
 * and a secure account deletion request submission process for unauthenticated users.
 */
const DeleteAccountPage = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user, token } = useSelector((state) => state.auth)

  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)

  useEffect(() => {
    document.title = 'Account Deletion Request - Nahom'

    // Set meta description
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      'Account Deletion Request for the Nahom application provided by Atominos Consulting Private Limited.'

    // Set canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://managemygate.e3esg.com/delete-account'
  }, [])

  // Handle Unauthenticated Public Request Submission
  const handleSubmitRequest = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!email && !mobile) {
      setErrorMsg('Please enter either your registered email address or mobile number.')
      return
    }

    try {
      setLoading(true)
      const res = await apiClient.post('/users/request-deletion', {
        email,
        mobile,
        reason,
      })

      setSubmitted(true)
      setFeedbackMessage(
        res?.data?.data?.message ||
          'Your request has been received. If the information matches an active account, we will contact you through your registered contact method to complete the identity verification process.',
      )
    } catch (err) {
      // Security protection: return generic confirmation even on error
      setSubmitted(true)
      setFeedbackMessage(
        'Your request has been received. If the information matches an active account, we will contact you through your registered contact method to complete the identity verification process.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Handle Authenticated Self-Service Account Deletion
  const handleDirectSelfDelete = async () => {
    try {
      setLoading(true)
      setErrorMsg('')
      await apiClient.delete('/users/me')
      dispatch(logout())
      setSubmitted(true)
      setFeedbackMessage(
        'Your account and associated personal data have been successfully deleted and anonymized.',
      )
    } catch (err) {
      setErrorMsg(err.message || 'Account deletion failed. Please contact support.')
    } finally {
      setLoading(false)
      setConfirmDeleteModal(false)
    }
  }

  const isAuthenticated = Boolean(token && user)

  return (
    <div className="min-vh-100 bg-body-tertiary d-flex flex-column">
      {/* Header Bar */}
      <header className="bg-body border-bottom py-3 shadow-sm sticky-top">
        <CContainer className="d-flex justify-content-between align-items-center">
          <Link to="/" className="text-decoration-none d-flex align-items-center gap-2">
            <CIcon icon={cilShieldAlt} size="xl" className="text-primary" />
            <span className="fw-bold fs-5 text-body">Nahom</span>
          </Link>
          {!isAuthenticated && (
            <Link to="/login">
              <CButton color="primary" variant="outline" size="sm">
                Sign In
              </CButton>
            </Link>
          )}
        </CContainer>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow-1 py-4 py-md-5">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol lg={9} xl={8}>
              <CCard className="border-0 shadow-sm mb-4">
                <CCardBody className="p-4 p-md-5">
                  {/* Hero Header */}
                  <div className="border-bottom pb-4 mb-4">
                    <div className="d-flex align-items-center gap-2 text-danger mb-2">
                      <CIcon icon={cilUserX} size="lg" />
                      <span className="fw-semibold text-uppercase small tracking-wide">
                        Account & Data Rights
                      </span>
                    </div>
                    <h1 className="fw-extrabold display-6 mb-2">Account Deletion</h1>
                    <p className="text-body-secondary mb-0">
                      Nahom Application &bull; Atominos Consulting Private Limited
                    </p>
                  </div>

                  {/* Submission Confirmation Screen */}
                  {submitted ? (
                    <div className="text-center py-4">
                      <CIcon icon={cilCheckCircle} size="3xl" className="text-success mb-3" />
                      <h2 className="h4 fw-bold text-body mb-3">Request Processed</h2>
                      <CAlert color="success" className="text-start mb-4">
                        {feedbackMessage}
                      </CAlert>
                      <p className="text-body-secondary small mb-4">
                        For any further inquiries regarding account deletion or data privacy, you
                        may email our team at{' '}
                        <a
                          href="mailto:info@atominosconsulting.com"
                          className="text-decoration-none"
                        >
                          info@atominosconsulting.com
                        </a>
                        .
                      </p>
                      <Link to="/">
                        <CButton color="primary">Return to Home</CButton>
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Authenticated User Deletion Section */}
                      {isAuthenticated ? (
                        <div className="bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 p-4 mb-5">
                          <div className="d-flex align-items-center gap-2 text-danger mb-2">
                            <CIcon icon={cilLockLocked} />
                            <strong className="h6 mb-0">
                              Authenticated Account Session Detected
                            </strong>
                          </div>
                          <p className="small mb-3">
                            You are logged in as <strong>{user?.name || user?.email}</strong>. You
                            can initiate immediate self-service account deletion below.
                          </p>

                          {errorMsg && <CAlert color="danger">{errorMsg}</CAlert>}

                          {!confirmDeleteModal ? (
                            <CButton
                              color="danger"
                              onClick={() => setConfirmDeleteModal(true)}
                              disabled={loading}
                            >
                              <CIcon icon={cilUserX} className="me-2" />
                              Delete My Account Now
                            </CButton>
                          ) : (
                            <div className="bg-body p-3 rounded border border-danger">
                              <p className="fw-bold text-danger mb-2">
                                Are you sure you want to permanently delete your account?
                              </p>
                              <p className="small text-body-secondary mb-3">
                                This action will revoke all active sessions, purge personal
                                identifying information, remove your villa bindings, and anonymize
                                your service records.
                              </p>
                              <div className="d-flex gap-2">
                                <CButton
                                  color="danger"
                                  onClick={handleDirectSelfDelete}
                                  disabled={loading}
                                >
                                  {loading ? <CSpinner size="sm" /> : 'Yes, Permanently Delete'}
                                </CButton>
                                <CButton
                                  color="secondary"
                                  variant="outline"
                                  onClick={() => setConfirmDeleteModal(false)}
                                  disabled={loading}
                                >
                                  Cancel
                                </CButton>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Unauthenticated Public Request Form */
                        <div className="mb-5">
                          <h2 className="h5 fw-bold text-body mb-3">
                            Public Account Deletion Request
                          </h2>
                          <p className="text-body-secondary small mb-4">
                            If you no longer have access to the Nahom mobile application or wish to
                            request deletion without logging in, please complete the form below. For
                            security purposes, our team will process the request through your
                            registered contact channel.
                          </p>

                          {errorMsg && <CAlert color="danger">{errorMsg}</CAlert>}

                          <CForm onSubmit={handleSubmitRequest}>
                            <CRow className="g-3 mb-3">
                              <CCol md={6}>
                                <label className="form-label fw-semibold small">
                                  Registered Email Address
                                </label>
                                <CFormInput
                                  type="email"
                                  placeholder="e.g. user@example.com"
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                />
                              </CCol>
                              <CCol md={6}>
                                <label className="form-label fw-semibold small">
                                  Registered Mobile Phone Number
                                </label>
                                <CFormInput
                                  type="tel"
                                  placeholder="e.g. +91 9876543210"
                                  value={mobile}
                                  onChange={(e) => setMobile(e.target.value)}
                                />
                              </CCol>
                              <CCol xs={12}>
                                <label className="form-label fw-semibold small">
                                  Reason for Deletion Request (Optional)
                                </label>
                                <CFormTextarea
                                  rows={3}
                                  placeholder="Please share any feedback or reason for requesting deletion..."
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                />
                              </CCol>
                            </CRow>

                            <div className="d-flex gap-3 align-items-center">
                              <CButton color="danger" type="submit" disabled={loading}>
                                {loading ? (
                                  <CSpinner size="sm" />
                                ) : (
                                  'Submit Account Deletion Request'
                                )}
                              </CButton>
                              <span className="text-body-secondary small">
                                Or <Link to="/login">Sign In</Link> to delete immediately.
                              </span>
                            </div>
                          </CForm>
                        </div>
                      )}

                      {/* Section: Data Retention & Anonymization Audit */}
                      <section className="border-top pt-4">
                        <h2 className="h5 fw-bold text-body mb-3">
                          Data Retention &amp; Processing Policy
                        </h2>
                        <p className="text-body-secondary small mb-3">
                          To maintain statutory compliance and community security audit integrity,
                          user data is processed according to the following audited retention
                          guidelines upon deletion:
                        </p>

                        <CRow className="g-3">
                          <CCol md={4}>
                            <div className="p-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 rounded-3 h-100">
                              <CBadge color="danger" className="mb-2">
                                PURGED / DELETED
                              </CBadge>
                              <ul className="small mb-0 ps-3 text-body-secondary">
                                <li>Direct messages &amp; conversations</li>
                                <li>Push notification logs</li>
                                <li>Linked SSO tokens (Google / MS)</li>
                                <li>Active user sessions &amp; refresh tokens</li>
                                <li>Uploaded profile avatars &amp; images</li>
                              </ul>
                            </div>
                          </CCol>
                          <CCol md={4}>
                            <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-25 rounded-3 h-100">
                              <CBadge color="warning" className="mb-2">
                                ANONYMIZED
                              </CBadge>
                              <ul className="small mb-0 ps-3 text-body-secondary">
                                <li>User profile (Name set to &apos;Deleted User&apos;)</li>
                                <li>Email set to anonymized dummy string</li>
                                <li>Mobile number cleared</li>
                                <li>Complaint resident snapshots anonymized</li>
                              </ul>
                            </div>
                          </CCol>
                          <CCol md={4}>
                            <div className="p-3 bg-info bg-opacity-10 border border-info border-opacity-25 rounded-3 h-100">
                              <CBadge color="info" className="mb-2">
                                STATUTORY RETAINED
                              </CBadge>
                              <ul className="small mb-0 ps-3 text-body-secondary">
                                <li>
                                  Maintenance fee invoices &amp; ledgers (Tax &amp; accounting
                                  compliance)
                                </li>
                                <li>
                                  Gate entry security audit logs (Anonymized resident linkage)
                                </li>
                              </ul>
                            </div>
                          </CCol>
                        </CRow>
                      </section>
                    </>
                  )}
                </CCardBody>
              </CCard>

              {/* Navigation Action */}
              <div className="text-center mb-5">
                <Link to="/">
                  <CButton color="secondary" variant="ghost">
                    <CIcon icon={cilArrowLeft} className="me-2" />
                    Back to ManageMyGate Portal
                  </CButton>
                </Link>
              </div>
            </CCol>
          </CRow>
        </CContainer>
      </main>

      {/* Public Page Footer */}
      <footer className="bg-body border-top py-3 mt-auto">
        <CContainer className="d-flex flex-wrap justify-content-between align-items-center small text-body-secondary gap-2">
          <div>
            <strong>Nahom</strong> &copy; {new Date().getFullYear()} Atominos Consulting Private
            Limited.
          </div>
          <div className="d-flex align-items-center gap-3">
            <Link to="/privacy-policy" className="text-decoration-none text-body-secondary">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-decoration-none text-body-secondary">
              Terms &amp; Conditions
            </Link>
            <Link to="/delete-account" className="text-decoration-none text-body-secondary">
              Account Deletion
            </Link>
          </div>
        </CContainer>
      </footer>
    </div>
  )
}

export default DeleteAccountPage
