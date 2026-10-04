import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilShieldAlt, cilArrowLeft, cilEnvelopeClosed, cilLockLocked } from '@coreui/icons'

/**
 * Privacy Policy Page Component for Nahom / ManageMyGate
 *
 * Publicly accessible page providing Google Play Store compliant privacy policy
 * details for Atominos Consulting Private Limited.
 */
const PrivacyPolicyPage = () => {
  useEffect(() => {
    document.title = 'Privacy Policy - Nahom'

    // Set meta description
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      'Privacy Policy for the Nahom application provided by Atominos Consulting Private Limited.'

    // Set canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://managemygate.e3esg.com/privacy-policy'
  }, [])

  return (
    <div className="min-vh-100 bg-body-tertiary d-flex flex-column">
      {/* Public Header Bar */}
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
                      <CIcon icon={cilShieldAlt} size="lg" />
                      <span className="fw-semibold text-uppercase small tracking-wide">
                        Legal & Compliance Documentation
                      </span>
                    </div>
                    <h1 className="fw-extrabold display-6 mb-2">Privacy Policy</h1>
                    <p className="text-body-secondary mb-3">
                      Nahom Application &bull; Platform: ManageMyGate
                    </p>
                    <div className="d-flex flex-wrap gap-3 align-items-center text-body-secondary small">
                      <CBadge color="primary" className="px-2 py-1">
                        Version 1.0.0
                      </CBadge>
                      <span>
                        <strong>Effective Date:</strong> September 3, 2026
                      </span>
                      <span>&bull;</span>
                      <span>
                        <strong>Last Updated:</strong> September 3, 2026
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Introduction */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">1. Introduction</h2>
                    <p>
                      Welcome to <strong>Nahom</strong> (accessible via the{' '}
                      <strong>ManageMyGate</strong> platform at{' '}
                      <a
                        href="https://managemygate.e3esg.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-decoration-none"
                      >
                        https://managemygate.e3esg.com
                      </a>
                      ). This Privacy Policy explains how{' '}
                      <strong>Atominos Consulting Private Limited</strong> (&quot;Company&quot;,
                      &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, processes,
                      stores, and protects personal information when you use our mobile application
                      and web portal.
                    </p>
                    <p>
                      We are committed to maintaining data privacy, security, and transparency. By
                      accessing or using the Nahom application or ManageMyGate web services, you
                      acknowledge that you have read and understood the data practices described in
                      this policy.
                    </p>
                  </section>

                  {/* Section 2: Developer & Company Identity */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">2. Developer & Company Identity</h2>
                    <div className="bg-body-secondary p-3 p-md-4 rounded-3 border">
                      <CRow className="g-3">
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">Entity Name</span>
                          <strong>Atominos Consulting Private Limited</strong>
                        </CCol>
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">
                            Application Name
                          </span>
                          <strong>Nahom</strong>
                        </CCol>
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">
                            Platform / System
                          </span>
                          <strong>ManageMyGate</strong>
                        </CCol>
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">
                            Official Website
                          </span>
                          <a
                            href="https://managemygate.e3esg.com"
                            target="_blank"
                            rel="noreferrer"
                            className="text-decoration-none"
                          >
                            https://managemygate.e3esg.com
                          </a>
                        </CCol>
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">
                            Privacy Inquiries
                          </span>
                          <a
                            href="mailto:info@atominosconsulting.com"
                            className="text-decoration-none"
                          >
                            info@atominosconsulting.com
                          </a>
                        </CCol>
                        <CCol md={6}>
                          <span className="text-body-secondary small d-block">General Support</span>
                          <a
                            href="mailto:mohanraj@atominosconsulting.com"
                            className="text-decoration-none"
                          >
                            mohanraj@atominosconsulting.com
                          </a>
                        </CCol>
                      </CRow>
                    </div>
                  </section>

                  {/* Section 3: Information We Collect */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">3. Information We Collect</h2>
                    <p>
                      We collect only the information necessary to fulfill core gated community
                      operations, gate security management, amenity scheduling, and administrative
                      communications.
                    </p>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.1 Account & Identity Information</h3>
                    <ul>
                      <li>
                        <strong>Personal Details:</strong> Full name, email address, mobile phone
                        number, profile avatar.
                      </li>
                      <li>
                        <strong>Authentication Credentials:</strong> Passwords stored strictly as
                        one-way salted cryptographic hashes (bcrypt).
                      </li>
                      <li>
                        <strong>Social & Enterprise Single Sign-On (SSO):</strong> Third-party
                        authentication identifiers from Google OAuth 2.0 or Microsoft Azure AD when
                        selected by the user.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.2 Community & Property Information</h3>
                    <ul>
                      <li>
                        <strong>Unit Binding:</strong> Villa or apartment unit number, associated
                        community name, occupancy status (Owner / Resident / Tenant /
                        Staff).
                      </li>
                      <li>
                        <strong>Emergency Contacts:</strong> Resident-designated emergency contact
                        name and phone number.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.3 Visitor & Security Information</h3>
                    <ul>
                      <li>
                        <strong>Visitor Passes:</strong> Visitor name, vehicle number, host villa
                        number, pass type, validity period, and entry/exit security logs verified by
                        gate personnel.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">
                      3.4 Maintenance & Complaint Information
                    </h3>
                    <ul>
                      <li>
                        <strong>Service Tickets:</strong> Complaint category, title, detailed
                        description, status updates, technician assignments, and optional photo
                        attachments uploaded by the resident.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.5 Amenity Booking & Usage Data</h3>
                    <ul>
                      <li>
                        <strong>Facility Reservations:</strong> Facility requested, booking
                        date/time slots, participant counts, and booking receipts.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.6 Billing & Invoice Data</h3>
                    <ul>
                      <li>
                        <strong>Maintenance Invoices:</strong> Invoice numbers, due amounts, payment
                        reference IDs, payment timestamps, wallet balances, and uploaded payment
                        proof images.
                      </li>
                    </ul>

                    <h3 className="h6 fw-bold mt-4 mb-2">3.7 Device & Technical Audit Data</h3>
                    <ul>
                      <li>
                        <strong>Log Data:</strong> IP address, device model, operating system
                        version, access timestamps, system error traces, and active session tokens.
                      </li>
                    </ul>
                  </section>

                  {/* Section 4: Payment Information Disclaimer */}
                  <section className="mb-5">
                    <div className="p-4 rounded-3 border border-primary border-opacity-25 bg-primary bg-opacity-10">
                      <h2 className="h5 fw-bold text-primary mb-2">
                        4. Payment & Financial Information Disclaimer
                      </h2>
                      <p className="mb-2">
                        Atominos Consulting Private Limited and the ManageMyGate platform{' '}
                        <strong>DO NOT</strong> store complete payment card numbers, CVV codes, card
                        expiration dates, bank account passwords, or UPI PINs.
                      </p>
                      <p className="mb-0 text-body-secondary small">
                        All online payments are securely routed directly through authorized
                        third-party payment gateway service providers. ManageMyGate stores only
                        payment status records, invoice numbers, payment reference IDs, transaction
                        timestamps, and user-uploaded receipt images for accounting and verification
                        purposes.
                      </p>
                    </div>
                  </section>

                  {/* Section 5: Device Permissions & Hardware Usage */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      5. Device Permissions & Hardware Access
                    </h2>
                    <p>
                      The Nahom mobile application requests only specific device permissions
                      required to execute operational features:
                    </p>
                    <ul>
                      <li>
                        <strong>
                          Camera Permission (<code>expo-camera</code>):
                        </strong>{' '}
                        Used exclusively to scan visitor QR passes at community gates, verify
                        amenity entry tickets, and capture photo attachments for maintenance
                        complaints.
                      </li>
                      <li>
                        <strong>
                          Photo Library & Storage Permission (<code>expo-image-picker</code>,{' '}
                          <code>expo-document-picker</code>):
                        </strong>{' '}
                        Used to upload user profile avatars, complaint photo attachments, and
                        amenity booking payment receipts.
                      </li>
                      <li>
                        <strong>
                          Secure Local Storage (<code>expo-secure-store</code>):
                        </strong>{' '}
                        Used to securely cache encrypted session tokens locally on the device.
                      </li>
                      <li>
                        <strong>
                          Real-Time WebSockets (<code>socket.io-client</code>):
                        </strong>{' '}
                        Used for instant gate walk-in approval alerts and real-time security
                        notifications.
                      </li>
                    </ul>
                  </section>

                  {/* Section 6: Explicit Data Exclusions */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">6. Explicit Data Exclusions</h2>
                    <div className="bg-body-secondary p-3 p-md-4 rounded-3 border">
                      <p className="fw-semibold mb-2 text-body">
                        Based on our verified source code implementation, the Nahom application:
                      </p>
                      <ul className="mb-0">
                        <li>
                          <strong>NO Continuous GPS Location Tracking:</strong> We do not track or
                          store your continuous device GPS coordinates.
                        </li>
                        <li>
                          <strong>NO Contact Book Access:</strong> We do not read, access, or sync
                          your mobile phone contact book.
                        </li>
                        <li>
                          <strong>NO Audio or Microphone Recording:</strong> We do not record or
                          access device microphones.
                        </li>
                        <li>
                          <strong>NO Third-Party Advertising SDKs:</strong> We do not include Google
                          AdMob, Meta Ads, or third-party ad tracking frameworks.
                        </li>
                        <li>
                          <strong>NO Sale of Personal Data:</strong> We never sell, rent, or trade
                          personal data to third-party brokers or marketers.
                        </li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 7: Third-Party Service Providers */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">7. Third-Party Service Providers</h2>
                    <p>
                      We partner with select third-party service providers to facilitate
                      authentication, infrastructure, and payment processing:
                    </p>
                    <div className="table-responsive">
                      <CTable bordered align="middle" className="small">
                        <CTableHead color="light">
                          <CTableRow>
                            <CTableHeaderCell>Service Provider</CTableHeaderCell>
                            <CTableHeaderCell>Purpose</CTableHeaderCell>
                            <CTableHeaderCell>Data Handled</CTableHeaderCell>
                            <CTableHeaderCell>Processing Mechanism</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              Google Cloud OAuth 2.0
                            </CTableDataCell>
                            <CTableDataCell>Social Single Sign-On (SSO)</CTableDataCell>
                            <CTableDataCell>Email, name, profile image URL</CTableDataCell>
                            <CTableDataCell>
                              Google OAuth consent flow on user action
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">Microsoft Azure AD</CTableDataCell>
                            <CTableDataCell>Enterprise SSO</CTableDataCell>
                            <CTableDataCell>Email, display name, tenant ID</CTableDataCell>
                            <CTableDataCell>
                              Microsoft MSAL authentication on user action
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              Payment Gateway Providers
                            </CTableDataCell>
                            <CTableDataCell>Payment processing</CTableDataCell>
                            <CTableDataCell>Amount, transaction reference ID</CTableDataCell>
                            <CTableDataCell>Encrypted HTTPS redirect / SDK checkout</CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              Self-Hosted Infrastructure
                            </CTableDataCell>
                            <CTableDataCell>Database & File Storage</CTableDataCell>
                            <CTableDataCell>Encrypted application data & assets</CTableDataCell>
                            <CTableDataCell>Private Cloud Server (MongoDB / Nginx)</CTableDataCell>
                          </CTableRow>
                        </CTableBody>
                      </CTable>
                    </div>
                  </section>

                  {/* Section 8: How We Use Information */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">8. How We Use Information</h2>
                    <p>We process collected information strictly for operational purposes:</p>
                    <ul>
                      <li>Authenticated access control and user session management.</li>
                      <li>Verifying visitor gate passes and updating community security logs.</li>
                      <li>Processing maintenance complaint tickets and dispatching technicians.</li>
                      <li>
                        Managing amenity reservations and generating maintenance dues invoices.
                      </li>
                      <li>Sending real-time gate entry alerts and administrative notifications.</li>
                      <li>
                        Maintaining platform security, audit logging, and resolving technical
                        issues.
                      </li>
                    </ul>
                  </section>

                  {/* Section 9: Data Security */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">9. Data Security</h2>
                    <p>
                      We enforce robust technical and organizational security measures to safeguard
                      user data:
                    </p>
                    <ul>
                      <li>
                        <strong>Transport Security:</strong> All data transmitted between mobile
                        clients, web browsers, and server APIs is encrypted using TLS 1.2/1.3
                        (HTTPS).
                      </li>
                      <li>
                        <strong>Credential Hashing:</strong> Passwords are hashed with bcrypt before
                        database storage.
                      </li>
                      <li>
                        <strong>Access Control:</strong> Strict Role-Based Access Control (RBAC) and
                        multi-tenant scoping prevent unauthorized cross-community data exposure.
                      </li>
                      <li>
                        <strong>Token Revocation:</strong> Active user sessions can be revoked
                        instantly upon account sign-out or deletion.
                      </li>
                    </ul>
                  </section>

                  {/* Section 10: Data Retention & Account Deletion */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      10. Data Retention & Account Deletion
                    </h2>
                    <p>
                      You have the right to request deletion of your account and personal data at
                      any time.
                    </p>
                    <ul>
                      <li>
                        <strong>In-App Deletion:</strong> Logged-in users can navigate to{' '}
                        <strong>Settings &rarr; Account &rarr; Delete Account</strong> to trigger
                        instant account deletion.
                      </li>
                      <li>
                        <strong>Web Deletion Request:</strong> Users may submit an Account Deletion
                        request online at{' '}
                        <Link to="/delete-account" className="text-decoration-none fw-semibold">
                          https://managemygate.e3esg.com/delete-account
                        </Link>
                        .
                      </li>
                    </ul>
                    <p className="mb-0">
                      Upon account deletion, personal identifying data (email, phone, name, avatars,
                      SSO links, session tokens) is permanently purged or anonymized. Historical
                      financial ledgers and gate security logs are retained in anonymized format
                      strictly as required for statutory tax compliance and community safety audit
                      requirements.
                    </p>
                  </section>

                  {/* Section 11: Children's Privacy */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">11. Children&apos;s Privacy</h2>
                    <p>
                      Nahom and ManageMyGate are designed for property owners, residents, and
                      authorized gate personnel. Our services are not directed to children under the
                      age of 13. We do not knowingly collect personal information from children
                      under 13. If we learn that personal information of a child under 13 has been
                      collected, we will take steps to purge such information promptly.
                    </p>
                  </section>

                  {/* Section 12: Changes to This Privacy Policy */}
                  <section className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      12. Changes to This Privacy Policy
                    </h2>
                    <p>
                      We may update this Privacy Policy from time to time to reflect changes in
                      legal requirements or application functionality. Updated policy versions will
                      be published on this page with an updated &quot;Last Updated&quot; date. We
                      encourage you to review this page periodically.
                    </p>
                  </section>

                  {/* Section 13: Contact Us */}
                  <section className="mb-4">
                    <h2 className="h4 fw-bold text-body mb-3">13. Contact Us</h2>
                    <p>
                      If you have any questions, concerns, or requests regarding this Privacy Policy
                      or your personal data, please contact our Privacy Team:
                    </p>
                    <div className="p-3 bg-body-secondary rounded-3 border">
                      <p className="mb-1">
                        <strong>Atominos Consulting Private Limited</strong>
                      </p>
                      <p className="mb-1">
                        Privacy Inquiries:{' '}
                        <a
                          href="mailto:info@atominosconsulting.com"
                          className="text-decoration-none"
                        >
                          info@atominosconsulting.com
                        </a>
                      </p>
                      <p className="mb-0">
                        General Support:{' '}
                        <a
                          href="mailto:mohanraj@atominosconsulting.com"
                          className="text-decoration-none"
                        >
                          mohanraj@atominosconsulting.com
                        </a>
                      </p>
                    </div>
                  </section>
                </CCardBody>
              </CCard>

              {/* Navigation Footer Action */}
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

export default PrivacyPolicyPage
