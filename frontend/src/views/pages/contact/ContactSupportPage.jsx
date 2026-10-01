import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilShieldAlt,
  cilArrowLeft,
  cilEnvelopeClosed,
  cilPhone,
  cilLocationPin,
  cilClock,
  cilCheckCircle,
} from '@coreui/icons'
import apiClient from '../../../services/apiClient.js'

/**
 * Public Contact & Support Page Component for Nahom / ManageMyGate
 *
 * Provides publicly accessible contact information for Atominos Consulting Private Limited
 * and a support / inquiry submission form without requiring login.
 */
const ContactSupportPage = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    document.title = 'Contact & Support - Nahom'

    // Set meta description
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      'Contact and support page for the Nahom application and ManageMyGate platform provided by Atominos Consulting Private Limited.'

    // Set canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://managemygate.e3esg.com/support'
  }, [])

  const handleSubmitInquiry = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name || !email || !message) {
      setErrorMsg('Please fill in your name, email address, and message.')
      return
    }

    try {
      setLoading(true)
      await apiClient.post('/public/register-lead', {
        name,
        email,
        phone,
        organizationName: organizationName || 'General Support Inquiry',
        notes: message,
      })

      setSubmitted(true)
    } catch (err) {
      setErrorMsg(
        err?.message ||
          'Failed to send your inquiry. Please contact support directly via email at mohanraj@atominosconsulting.com.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-vh-100 bg-body-tertiary d-flex flex-column">
      {/* Header Bar */}
      <header className="bg-body border-bottom py-3 shadow-sm sticky-top">
        <CContainer className="d-flex justify-content-between align-items-center">
          <Link to="/" className="text-decoration-none d-flex align-items-center gap-2">
            <CIcon icon={cilShieldAlt} size="xl" className="text-primary" />
            <span className="fw-bold fs-5 text-body">Nahom</span>
          </Link>
          <Link to="/login">
            <CButton color="primary" variant="outline" size="sm">
              Sign In
            </CButton>
          </Link>
        </CContainer>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow-1 py-4 py-md-5">
        <CContainer>
          <CRow className="justify-content-center">
            <CCol lg={10} xl={9}>
              <CCard className="border-0 shadow-sm mb-4">
                <CCardBody className="p-4 p-md-5">
                  {/* Hero Header */}
                  <div className="border-bottom pb-4 mb-4">
                    <div className="d-flex align-items-center gap-2 text-primary mb-2">
                      <CIcon icon={cilEnvelopeClosed} size="lg" />
                      <span className="fw-semibold text-uppercase small tracking-wide">
                        Customer &amp; Developer Support
                      </span>
                    </div>
                    <h1 className="fw-extrabold display-6 mb-2">Contact &amp; Support</h1>
                    <p className="text-body-secondary mb-0">
                      Nahom Platform &bull; Atominos Consulting Private Limited
                    </p>
                  </div>

                  {/* Contact Info Grid */}
                  <CRow className="g-4 mb-5">
                    <CCol md={6}>
                      <div className="p-4 bg-body-secondary rounded-3 border h-100">
                        <div className="d-flex align-items-center gap-2 text-primary mb-3">
                          <CIcon icon={cilEnvelopeClosed} size="xl" />
                          <h2 className="h5 fw-bold text-body mb-0">Email Support</h2>
                        </div>
                        <p className="small text-body-secondary mb-2">
                          <strong>General Support &amp; Technical Inquiries:</strong>
                          <br />
                          <a
                            href="mailto:mohanraj@atominosconsulting.com"
                            className="text-decoration-none fw-semibold"
                          >
                            mohanraj@atominosconsulting.com
                          </a>
                        </p>
                        <p className="small text-body-secondary mb-2">
                          <strong>Privacy &amp; Data Compliance:</strong>
                          <br />
                          <a
                            href="mailto:info@atominosconsulting.com"
                            className="text-decoration-none fw-semibold"
                          >
                            info@atominosconsulting.com
                          </a>
                        </p>
                        <p className="small text-body-secondary mb-0">
                          <strong>Platform Support Alias:</strong>
                          <br />
                          <a
                            href="mailto:support@managemygate.com"
                            className="text-decoration-none fw-semibold"
                          >
                            support@managemygate.com
                          </a>
                        </p>
                      </div>
                    </CCol>

                    <CCol md={6}>
                      <div className="p-4 bg-body-secondary rounded-3 border h-100">
                        <div className="d-flex align-items-center gap-2 text-primary mb-3">
                          <CIcon icon={cilPhone} size="xl" />
                          <h2 className="h5 fw-bold text-body mb-0">Phone &amp; Hours</h2>
                        </div>
                        <p className="small text-body-secondary mb-2">
                          <strong>Support Helpline:</strong>
                          <br />
                          <a href="tel:+919786608686" className="text-decoration-none fw-semibold">
                            +91 97866 08686
                          </a>
                        </p>
                        <p className="small text-body-secondary mb-2">
                          <CIcon icon={cilClock} className="me-1 text-primary" />
                          <strong>Operating Hours:</strong>
                          <br />
                          Monday &ndash; Friday, 9:00 AM &ndash; 6:00 PM IST
                        </p>
                        <p className="small text-body-secondary mb-0">
                          <CIcon icon={cilLocationPin} className="me-1 text-primary" />
                          <strong>Operating Company:</strong>
                          <br />
                          Atominos Consulting Private Limited
                        </p>
                      </div>
                    </CCol>
                  </CRow>

                  {/* Submission Confirmation Screen or Inquiry Form */}
                  {submitted ? (
                    <div className="text-center py-4">
                      <CIcon icon={cilCheckCircle} size="3xl" className="text-success mb-3" />
                      <h2 className="h4 fw-bold text-body mb-3">Inquiry Submitted Successfully</h2>
                      <CAlert color="success" className="text-start mb-4">
                        Thank you for reaching out to us. Your message has been received by our
                        support team. We will get back to you shortly via your registered email
                        address.
                      </CAlert>
                      <Link to="/">
                        <CButton color="primary">Return to Home</CButton>
                      </Link>
                    </div>
                  ) : (
                    <div className="border-top pt-4">
                      <h2 className="h5 fw-bold text-body mb-3">Send Us a Message</h2>
                      <p className="text-body-secondary small mb-4">
                        If you have questions regarding application features, community onboarding,
                        or technical support, please complete the form below.
                      </p>

                      {errorMsg && <CAlert color="danger">{errorMsg}</CAlert>}

                      <CForm onSubmit={handleSubmitInquiry}>
                        <CRow className="g-3 mb-3">
                          <CCol md={6}>
                            <label className="form-label fw-semibold small">Full Name *</label>
                            <CFormInput
                              type="text"
                              placeholder="Your full name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                            />
                          </CCol>
                          <CCol md={6}>
                            <label className="form-label fw-semibold small">Email Address *</label>
                            <CFormInput
                              type="email"
                              placeholder="user@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </CCol>
                          <CCol md={6}>
                            <label className="form-label fw-semibold small">Phone Number</label>
                            <CFormInput
                              type="tel"
                              placeholder="+91 9876543210"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                          </CCol>
                          <CCol md={6}>
                            <label className="form-label fw-semibold small">
                              Community / Organization Name
                            </label>
                            <CFormInput
                              type="text"
                              placeholder="e.g. Green Valley Society"
                              value={organizationName}
                              onChange={(e) => setOrganizationName(e.target.value)}
                            />
                          </CCol>
                          <CCol xs={12}>
                            <label className="form-label fw-semibold small">Message *</label>
                            <CFormTextarea
                              rows={4}
                              placeholder="How can our support team assist you?"
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              required
                            />
                          </CCol>
                        </CRow>

                        <div className="d-flex gap-3 align-items-center">
                          <CButton color="primary" type="submit" disabled={loading}>
                            {loading ? <CSpinner size="sm" /> : 'Send Support Request'}
                          </CButton>
                        </div>
                      </CForm>
                    </div>
                  )}
                </CCardBody>
              </CCard>

              {/* Navigation Action */}
              <div className="text-center mb-5">
                <Link to="/">
                  <CButton color="secondary" variant="ghost">
                    <CIcon icon={cilArrowLeft} className="me-2" />
                    Back to Nahom Portal
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
            <Link to="/terms-and-conditions" className="text-decoration-none text-body-secondary">
              Terms &amp; Conditions
            </Link>
            <Link to="/support" className="text-decoration-none text-body-secondary">
              Contact &amp; Support
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

export default ContactSupportPage
