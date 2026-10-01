import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CButton,
  CBadge,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFile, cilArrowLeft, cilShieldAlt, cilList } from '@coreui/icons'

/**
 * Terms & Conditions Page Component for Nahom / ManageMyGate
 *
 * Dedicated public legal terms of service for Atominos Consulting Private Limited.
 * Applicable to Android (Google Play Store), iOS (Apple App Store), and ManageMyGate Web App.
 */
const TermsPage = () => {
  useEffect(() => {
    document.title = 'Terms & Conditions - Nahom'

    // Set meta description
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.name = 'description'
      document.head.appendChild(metaDesc)
    }
    metaDesc.content =
      'Terms & Conditions for the Nahom application and ManageMyGate platform provided by Atominos Consulting Private Limited.'

    // Set canonical link
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://managemygate.e3esg.com/terms'
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
          <div className="d-flex align-items-center gap-2">
            <Link to="/login">
              <CButton color="primary" variant="outline" size="sm">
                Sign In
              </CButton>
            </Link>
          </div>
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
                      <CIcon icon={cilFile} size="lg" />
                      <span className="fw-semibold text-uppercase small tracking-wide">
                        Legal Agreement &amp; Terms of Service
                      </span>
                    </div>
                    <h1 className="fw-extrabold display-6 mb-2">Terms &amp; Conditions</h1>
                    <p className="text-body-secondary mb-3">
                      Application: <strong>Nahom</strong> &bull; Platform:{' '}
                      <strong>ManageMyGate</strong>
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

                  {/* Legal Summary Box */}
                  <CAlert color="info" className="mb-4 rounded-3 border border-info-subtle">
                    <h5 className="alert-heading fw-bold mb-2 d-flex align-items-center gap-2">
                      <CIcon icon={cilShieldAlt} /> Legal Notice &amp; Platform Overview
                    </h5>
                    <p className="mb-0 small">
                      These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use
                      of the <strong>Nahom</strong> mobile application (available on Android via the
                      Google Play Store and iOS via the Apple App Store) and the{' '}
                      <strong>ManageMyGate</strong> web application located at{' '}
                      <a
                        href="https://managemygate.e3esg.com"
                        target="_blank"
                        rel="noreferrer"
                        className="fw-semibold text-decoration-underline"
                      >
                        https://managemygate.e3esg.com
                      </a>
                      , operated by <strong>Atominos Consulting Private Limited</strong>{' '}
                      (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By
                      creating an account, downloading, accessing, or using the platform, you agree
                      to be bound by these Terms and our separate{' '}
                      <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </CAlert>

                  {/* Table of Contents */}
                  <div className="bg-body-secondary p-4 rounded-3 border mb-5">
                    <h6 className="fw-bold mb-3 d-flex align-items-center gap-2 text-primary">
                      <CIcon icon={cilList} /> Table of Contents
                    </h6>
                    <CRow className="g-2 small">
                      <CCol md={6}>
                        <ol className="mb-0 ps-3">
                          <li>
                            <a href="#section-1" className="text-decoration-none">
                              Acceptance of Terms
                            </a>
                          </li>
                          <li>
                            <a href="#section-2" className="text-decoration-none">
                              Definitions
                            </a>
                          </li>
                          <li>
                            <a href="#section-3" className="text-decoration-none">
                              Eligibility
                            </a>
                          </li>
                          <li>
                            <a href="#section-4" className="text-decoration-none">
                              Account Registration &amp; Security
                            </a>
                          </li>
                          <li>
                            <a href="#section-5" className="text-decoration-none">
                              User Roles &amp; Permissions
                            </a>
                          </li>
                          <li>
                            <a href="#section-6" className="text-decoration-none">
                              Services Provided by Nahom
                            </a>
                          </li>
                          <li>
                            <a href="#section-7" className="text-decoration-none">
                              Community Administration
                            </a>
                          </li>
                          <li>
                            <a href="#section-8" className="text-decoration-none">
                              Visitor Management
                            </a>
                          </li>
                          <li>
                            <a href="#section-9" className="text-decoration-none">
                              Maintenance, Billing &amp; Invoices
                            </a>
                          </li>
                          <li>
                            <a href="#section-10" className="text-decoration-none">
                              Online Payments
                            </a>
                          </li>
                          <li>
                            <a href="#section-11" className="text-decoration-none">
                              Offline Payments
                            </a>
                          </li>
                          <li>
                            <a href="#section-12" className="text-decoration-none">
                              Community Directory
                            </a>
                          </li>
                          <li>
                            <a href="#section-13" className="text-decoration-none">
                              User Content &amp; Communications
                            </a>
                          </li>
                          <li>
                            <a href="#section-14" className="text-decoration-none">
                              Messaging &amp; Notifications
                            </a>
                          </li>
                        </ol>
                      </CCol>
                      <CCol md={6}>
                        <ol start={15} className="mb-0 ps-3">
                          <li>
                            <a href="#section-15" className="text-decoration-none">
                              Third-Party Services
                            </a>
                          </li>
                          <li>
                            <a href="#section-16" className="text-decoration-none">
                              User Responsibilities
                            </a>
                          </li>
                          <li>
                            <a href="#section-17" className="text-decoration-none">
                              Prohibited Activities
                            </a>
                          </li>
                          <li>
                            <a href="#section-18" className="text-decoration-none">
                              Intellectual Property
                            </a>
                          </li>
                          <li>
                            <a href="#section-19" className="text-decoration-none">
                              Privacy &amp; Data Protection
                            </a>
                          </li>
                          <li>
                            <a href="#section-20" className="text-decoration-none">
                              Account Suspension &amp; Termination
                            </a>
                          </li>
                          <li>
                            <a href="#section-21" className="text-decoration-none">
                              Self-Service Account Deletion
                            </a>
                          </li>
                          <li>
                            <a href="#section-22" className="text-decoration-none">
                              Service Availability &amp; Downtime
                            </a>
                          </li>
                          <li>
                            <a href="#section-23" className="text-decoration-none">
                              Security Disclaimer
                            </a>
                          </li>
                          <li>
                            <a href="#section-24" className="text-decoration-none">
                              Disclaimer of Warranties
                            </a>
                          </li>
                          <li>
                            <a href="#section-25" className="text-decoration-none">
                              Limitation of Liability
                            </a>
                          </li>
                          <li>
                            <a href="#section-26" className="text-decoration-none">
                              Indemnification
                            </a>
                          </li>
                          <li>
                            <a href="#section-27" className="text-decoration-none">
                              Changes to Terms
                            </a>
                          </li>
                          <li>
                            <a href="#section-28" className="text-decoration-none">
                              Governing Law &amp; Contact Information
                            </a>
                          </li>
                        </ol>
                      </CCol>
                    </CRow>
                  </div>

                  {/* Section 1: Acceptance of Terms */}
                  <section id="section-1" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">1. Acceptance of Terms</h2>
                    <p>
                      By creating an account, installing or accessing the <strong>Nahom</strong>{' '}
                      mobile application, accessing the <strong>ManageMyGate</strong> web
                      application (
                      <a href="https://managemygate.e3esg.com" target="_blank" rel="noreferrer">
                        https://managemygate.e3esg.com
                      </a>
                      ), or utilizing any community management services enabled through Nahom, you
                      expressly acknowledge that you have read, understood, and agreed to be legally
                      bound by these Terms &amp; Conditions and our{' '}
                      <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
                        Privacy Policy
                      </Link>{' '}
                      (
                      <a
                        href="https://managemygate.e3esg.com/privacy-policy"
                        target="_blank"
                        rel="noreferrer"
                      >
                        https://managemygate.e3esg.com/privacy-policy
                      </a>
                      ), as may be updated from time to time subject to applicable law.
                    </p>
                    <p>
                      If you do not agree to these Terms or the Privacy Policy, you must immediately
                      cease accessing or using the Nahom mobile application, ManageMyGate web
                      portal, and associated platform services.
                    </p>
                  </section>

                  {/* Section 2: Definitions */}
                  <section id="section-2" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">2. Definitions</h2>
                    <p>
                      For the purposes of these Terms &amp; Conditions, the following terms shall
                      have the exact meanings set forth below:
                    </p>
                    <div className="table-responsive">
                      <CTable striped hover bordered className="align-middle small">
                        <CTableHead color="light">
                          <CTableRow>
                            <CTableHeaderCell style={{ width: '28%' }}>Term</CTableHeaderCell>
                            <CTableHeaderCell>Definition</CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Company&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to <strong>Atominos Consulting Private Limited</strong>, the
                              legal owner, developer, and operator of Nahom and ManageMyGate.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Application&quot; / &quot;Nahom&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to the mobile software application titled Nahom operating on
                              Android and iOS mobile platforms.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Platform&quot; / &quot;Services&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers collectively to the Nahom mobile application, ManageMyGate web
                              application, APIs, background worker services, security features, and
                              digital workflows provided by the Company.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;User&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to any individual authenticated or interacting with Nahom or
                              ManageMyGate services.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Resident&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to registered individuals residing within a community
                              workspace, including property Owners and Tenants.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Owner&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to a resident who holds legal ownership of a unit or villa
                              within a registered community organization.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Tenant&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to an authorized occupant renting or leasing a unit or villa
                              within a registered community organization.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Community&quot; / &quot;Organization&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to the residential gated community, housing society, apartment
                              complex, villa compound, or management body utilizing the platform
                              workspace.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Community Administrator&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to designated board members, facility managers, or
                              administrative users authorized to manage community memberships,
                              roles, and settings.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Security Personnel&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to gate guards or security officers authorized to verify
                              visitor passes, log gate entries, and manage access checkpoints.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Facility Staff&quot; / &quot;Technician&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to maintenance staff, in-charge personnel, technicians, or
                              service providers assigned to handle complaints, facility maintenance,
                              or amenity bookings.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Visitor&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to any guest, delivery worker, cab driver, or service
                              contractor requesting or receiving digital entry clearance into a
                              community.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Account&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to the registered user profile authenticated via phone number,
                              email address, OTP, or SSO credentials.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Content&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to text, messages, notices, status pulses, complaints, photos,
                              documents, and records generated by or uploaded to the platform.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">&quot;Payment&quot;</CTableDataCell>
                            <CTableDataCell>
                              Refers to digital monetary transactions or offline recorded payment
                              transactions for maintenance dues, assessments, invoices, or amenity
                              fees.
                            </CTableDataCell>
                          </CTableRow>
                          <CTableRow>
                            <CTableDataCell className="fw-bold">
                              &quot;Subscription&quot;
                            </CTableDataCell>
                            <CTableDataCell>
                              Refers to the platform licensing tier or community subscription plan
                              enabling Nahom features for an organization.
                            </CTableDataCell>
                          </CTableRow>
                        </CTableBody>
                      </CTable>
                    </div>
                  </section>

                  {/* Section 3: Eligibility */}
                  <section id="section-3" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">3. Eligibility</h2>
                    <p>
                      To use Nahom and the ManageMyGate platform, you must satisfy the following
                      eligibility criteria:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Minimum Age &amp; Capacity:</strong> You must meet the legal age of
                        digital consent in your jurisdiction to register an account, or use the
                        platform under the direct supervision and authorization of a parent or legal
                        guardian.
                      </li>
                      <li className="mb-2">
                        <strong>Authority to Contract:</strong> You represent and warrant that you
                        possess full legal authority to enter into these Terms and perform all
                        obligations hereunder.
                      </li>
                      <li className="mb-2">
                        <strong>Accurate Identity:</strong> You agree to provide true, accurate,
                        current, and complete personal details during registration and keep your
                        profile information updated.
                      </li>
                      <li className="mb-2">
                        <strong>Community Authorization:</strong> Access to specific community
                        workspaces, villa units, or administrative features requires approval and
                        verification by authorized Community Administrators. We reserve the right to
                        restrict unverified access.
                      </li>
                    </ul>
                  </section>

                  {/* Section 4: Account Registration & Security */}
                  <section id="section-4" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      4. Account Registration &amp; Security
                    </h2>
                    <p>
                      Nahom provides multi-factor authentication through phone numbers, email
                      addresses, One-Time Password (OTP) verification, and Single Sign-On (SSO)
                      integrations including Google OAuth and Microsoft Entra SSO.
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Verification Codes:</strong> You consent to receive transactional
                        SMS, email, or push verification codes (OTPs) necessary to authenticate your
                        identity during login or critical security operations.
                      </li>
                      <li className="mb-2">
                        <strong>Credential Safeguarding:</strong> You are strictly responsible for
                        maintaining the confidentiality of your device, OTP credentials, and
                        passwords. You must not share your account access with unauthorized third
                        parties.
                      </li>
                      <li className="mb-2">
                        <strong>Account Activity Responsibility:</strong> You are fully responsible
                        for all actions, pass generations, messages, payments, and approvals
                        performed using your authenticated account credentials.
                      </li>
                      <li className="mb-2">
                        <strong>Reporting Unauthorized Access:</strong> You agree to notify us
                        immediately at{' '}
                        <a href="mailto:mohanraj@atominosconsulting.com">
                          mohanraj@atominosconsulting.com
                        </a>{' '}
                        if you suspect any unauthorized account access, credential compromise, or
                        security breach.
                      </li>
                    </ul>
                  </section>

                  {/* Section 5: User Roles & Permissions */}
                  <section id="section-5" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">5. User Roles and Permissions</h2>
                    <p>
                      Nahom enforces a multi-tenant Role-Based Access Control (RBAC) architecture.
                      Features and data visibility available to you are strictly limited according
                      to your assigned role:
                    </p>
                    <CRow className="g-3 my-2">
                      <CCol md={6}>
                        <div className="p-3 bg-body-secondary rounded-3 border h-100">
                          <h6 className="fw-bold text-primary mb-1">
                            Residents (Owners &amp; Tenants)
                          </h6>
                          <p className="small mb-0">
                            Can generate visitor passes, view community notices, submit maintenance
                            complaints, reserve amenities, view invoices, pay maintenance dues, and
                            manage household members.
                          </p>
                        </div>
                      </CCol>
                      <CCol md={6}>
                        <div className="p-3 bg-body-secondary rounded-3 border h-100">
                          <h6 className="fw-bold text-primary mb-1">Community Administrators</h6>
                          <p className="small mb-0">
                            Configure community settings, assign user roles, verify unit/villa
                            occupants, issue community notices, set up billing items, and review
                            visitor and audit logs.
                          </p>
                        </div>
                      </CCol>
                      <CCol md={6}>
                        <div className="p-3 bg-body-secondary rounded-3 border h-100">
                          <h6 className="fw-bold text-primary mb-1">
                            Security Personnel / Gate Guards
                          </h6>
                          <p className="small mb-0">
                            Scan digital QR passes, record walk-in visitors, verify expected guest
                            details, log vehicle details, and process gate entry/exit verification
                            workflows.
                          </p>
                        </div>
                      </CCol>
                      <CCol md={6}>
                        <div className="p-3 bg-body-secondary rounded-3 border h-100">
                          <h6 className="fw-bold text-primary mb-1">
                            Facility Staff &amp; Technicians
                          </h6>
                          <p className="small mb-0">
                            Manage service requests, update maintenance ticket status, process
                            offline payment verifications, and manage amenity availability.
                          </p>
                        </div>
                      </CCol>
                    </CRow>
                    <p className="small text-body-secondary mt-2">
                      Users may only access information authorized for their role. Community
                      Administrators retain the authority to configure community-level permissions
                      or revoke user access within their organization workspace.
                    </p>
                  </section>

                  {/* Section 6: Services Provided by Nahom */}
                  <section id="section-6" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">6. Services Provided by Nahom</h2>
                    <p>
                      Nahom is a technology workflow platform designed to assist residential
                      communities in managing administrative and operational tasks, including:
                    </p>
                    <ul>
                      <li className="mb-2">
                        Community &amp; Resident Management (Unit/villa assignments, occupant
                        directories, role management).
                      </li>
                      <li className="mb-2">
                        Visitor Access Control (Pre-approved visitor passes, walk-in logging,
                        entry/exit security logs, QR verification).
                      </li>
                      <li className="mb-2">
                        Maintenance &amp; Billing (Assessment creation, digital invoice generation,
                        ledger tracking).
                      </li>
                      <li className="mb-2">
                        Online &amp; Offline Payment Facilitation (Payment gateway routing and
                        manual bank transfer/cash/cheque payment verification).
                      </li>
                      <li className="mb-2">
                        Complaints &amp; Maintenance Requests (Ticket logging, technician
                        assignment, status tracking).
                      </li>
                      <li className="mb-2">
                        Facility &amp; Amenity Reservations (Slot booking, schedule management).
                      </li>
                      <li className="mb-2">
                        Community Communications (Digital noticeboard, community status notes,
                        polls, direct directory messaging).
                      </li>
                      <li className="mb-2">
                        Real-Time Alerts (Push notifications via FCM, SMS, in-app notifications).
                      </li>
                    </ul>
                    <p className="small text-body-secondary">
                      Available features vary based on your community&apos;s subscription plan, role
                      permissions, and active modules configured by your Community Administrator.
                    </p>
                  </section>

                  {/* Section 7: Community Administration */}
                  <section id="section-7" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      7. Community Administrator Responsibilities
                    </h2>
                    <p>
                      Authorized Community Administrators act on behalf of their respective
                      residential organization or property management entity and are responsible
                      for:
                    </p>
                    <ul>
                      <li className="mb-2">
                        Managing user memberships, verifying resident claims, and assigning
                        appropriate user roles.
                      </li>
                      <li className="mb-2">
                        Configuring community settings, villa directories, maintenance charge rules,
                        and visitor policies.
                      </li>
                      <li className="mb-2">
                        Verifying offline payment submissions recorded by residents or facility
                        staff.
                      </li>
                      <li className="mb-2">
                        Ensuring all administrative actions comply with applicable community bylaws
                        and privacy regulations.
                      </li>
                    </ul>
                  </section>

                  {/* Section 8: Visitor Management */}
                  <section id="section-8" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      8. Visitor Management &amp; Access Rules
                    </h2>
                    <p>
                      Nahom enables residents and security personnel to manage visitor entry
                      clearances:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Pass Creation:</strong> Residents creating visitor passes must
                        ensure accurate visitor details (name, vehicle number, expected arrival
                        time, visitor type) are provided.
                      </li>
                      <li className="mb-2">
                        <strong>Gate Verification:</strong> Security personnel verify digital passes
                        via QR scanning or entry codes at community checkpoints. Gate officers
                        retain full discretion to request physical identification or contact
                        residents prior to granting access.
                      </li>
                      <li className="mb-2">
                        <strong>Resident Responsibility for Visitors:</strong> Residents are fully
                        responsible for the conduct and compliance of guests and service personnel
                        invited under their passes while inside the community premises.
                      </li>
                      <li className="mb-2 border-start border-4 border-warning ps-3 py-2 bg-body-secondary rounded-end">
                        <strong>Physical Access Disclaimer:</strong> Nahom provides digitized access
                        control software but{' '}
                        <strong>
                          does NOT provide physical security services, bodyguards, or guarantees of
                          physical admission or safety
                        </strong>
                        . Physical entry decisions remain subject to community association rules,
                        local laws, and real-world security guards on duty.
                      </li>
                    </ul>
                  </section>

                  {/* Section 9: Maintenance, Billing & Invoices */}
                  <section id="section-9" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      9. Maintenance, Billing and Invoices
                    </h2>
                    <p>
                      Nahom provides automated recordkeeping for community maintenance charges,
                      utility dues, invoices, and payment histories:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Charge Determination:</strong> Maintenance fees, assessments, and
                        penalties displayed in the application are established solely by your
                        Community Administrator or organization management, not by the Company.
                      </li>
                      <li className="mb-2">
                        <strong>Recordkeeping Accuracy:</strong> Nahom acts as a digital ledger
                        system displaying invoice balances, payment records, and receipts provided
                        by your community management.
                      </li>
                      <li className="mb-2">
                        <strong>Billing Disputes:</strong> Any disputes regarding maintenance
                        calculations, fee amounts, or late charges must be resolved directly with
                        your Community Administrator.
                      </li>
                    </ul>
                  </section>

                  {/* Section 10: Online Payments */}
                  <section id="section-10" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">10. Online Payments</h2>
                    <p>Where online payment processing is enabled for a community:</p>
                    <ul>
                      <li className="mb-2">
                        <strong>Third-Party Payment Processors:</strong> Online transactions are
                        routed through independent, licensed third-party payment gateway providers.{' '}
                        <strong>
                          Atominos Consulting Private Limited is NOT a bank, payment gateway, wallet
                          provider, or financial institution
                        </strong>{' '}
                        and does not hold user funds.
                      </li>
                      <li className="mb-2">
                        <strong>Payment Provider Terms:</strong> Your use of online payment features
                        is subject to the terms, conditions, and privacy policies of the applicable
                        payment gateway provider.
                      </li>
                      <li className="mb-2">
                        <strong>Transaction Errors &amp; Delays:</strong> The Company is not
                        responsible for failed, delayed, reversed, or pending transactions caused by
                        banking network disruptions or payment provider errors.
                      </li>
                      <li className="mb-2">
                        <strong>Refunds &amp; Cancellations:</strong> Refunds or payment reversals
                        are governed strictly by your community association&apos;s refund policy and
                        the relevant payment gateway rules.
                      </li>
                    </ul>
                  </section>

                  {/* Section 11: Offline Payments */}
                  <section id="section-11" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">11. Offline Payments</h2>
                    <p>
                      Nahom supports tracking for offline payment methods such as direct bank
                      transfers, cash, cheques, or demand drafts:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Submission vs. Verification:</strong> Entering offline payment
                        details (such as a bank transaction reference or cheque number) into Nahom
                        records a pending submission.{' '}
                        <strong>
                          It does not automatically constitute proof of payment or receipt clearance
                        </strong>
                        .
                      </li>
                      <li className="mb-2">
                        <strong>Verification Process:</strong> Offline payment submissions require
                        manual review, receipt verification, and status updates by authorized
                        Community Administrators or accounting personnel before the payment status
                        is marked as verified.
                      </li>
                      <li className="mb-2">
                        <strong>Verification Records:</strong> The platform logs payment reference
                        numbers, submission dates, payment methods, and the authorized role
                        responsible for verifying the transaction.
                      </li>
                    </ul>
                  </section>

                  {/* Section 12: Community Directory */}
                  <section id="section-12" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">12. Community Directory</h2>
                    <p>
                      The Nahom Community Directory allows residents and administrators to connect
                      within a verified community:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Visibility Settings:</strong> Directory contact information is
                        displayed based on user role, community configuration, and individual
                        privacy preferences set in profile settings.
                      </li>
                      <li className="mb-2">
                        <strong>Prohibited Scraping &amp; Harvesting:</strong> Users are strictly
                        prohibited from scraping, harvesting, downloading, or collecting directory
                        information for commercial marketing, solicitation, or unauthorized
                        distribution.
                      </li>
                      <li className="mb-2">
                        <strong>Unlawful Contact:</strong> Contacting community members for abusive,
                        fraudulent, harassing, or political purposes is strictly prohibited.
                      </li>
                    </ul>
                  </section>

                  {/* Section 13: User Content & Communications */}
                  <section id="section-13" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      13. User Content &amp; Communications
                    </h2>
                    <p>
                      Users may create or upload community notices, status pulses, complaints,
                      messages, photos, or documents (&quot;User Content&quot;):
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>User Responsibility:</strong> You retain ownership of your User
                        Content but are solely responsible for its legality, accuracy, and
                        appropriateness.
                      </li>
                      <li className="mb-2">
                        <strong>Content Standards:</strong> User Content must not contain material
                        that is illegal, defamatory, abusive, obscene, threatening, infringing on
                        intellectual property, misleading, or containing malicious software.
                      </li>
                      <li className="mb-2">
                        <strong>Moderation &amp; Removal:</strong> Authorized Community
                        Administrators and the Company reserve the right to flag, hide, or remove
                        any User Content that violates these Terms or community guidelines.
                      </li>
                    </ul>
                  </section>

                  {/* Section 14: Messaging & Notifications */}
                  <section id="section-14" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">14. Messaging and Notifications</h2>
                    <p>
                      Nahom delivers operational alerts and in-app communications to facilitate
                      community workflows:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>Notification Channels:</strong> Alerts may be delivered via Push
                        Notifications, SMS, Email, or In-App banners for visitor arrivals, payment
                        reminders, complaint status changes, and administrative notices.
                      </li>
                      <li className="mb-2">
                        <strong>Prohibited Messaging:</strong> Messaging tools must not be used to
                        send spam, unsolicited commercial offers, threats, or deceptive requests.
                      </li>
                    </ul>
                  </section>

                  {/* Section 15: Third-Party Services */}
                  <section id="section-15" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">15. Third-Party Services</h2>
                    <p>
                      Nahom relies on licensed third-party service providers for infrastructure
                      support, including payment gateways, SMS delivery, email services, cloud
                      storage, map APIs, and authentication services (Google OAuth, Microsoft Entra
                      SSO).
                    </p>
                    <p>
                      Your interaction with third-party services is subject to their respective
                      terms and privacy policies. The Company does not control or warrant the
                      performance, uptime, or security of external third-party networks.
                    </p>
                  </section>

                  {/* Section 16: User Responsibilities */}
                  <section id="section-16" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">16. User Responsibilities</h2>
                    <p>By accessing or using Nahom, you agree to:</p>
                    <ul>
                      <li className="mb-2">
                        Comply with all applicable local, national, and international laws and
                        community bylaws.
                      </li>
                      <li className="mb-2">Maintain current and accurate profile information.</li>
                      <li className="mb-2">
                        Protect your account credentials and device security.
                      </li>
                      <li className="mb-2">
                        Use payment features honestly and provide accurate visitor pass information.
                      </li>
                      <li className="mb-2">
                        Respect the privacy and rights of other community residents.
                      </li>
                    </ul>
                  </section>

                  {/* Section 17: Prohibited Activities */}
                  <section id="section-17" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">17. Prohibited Activities</h2>
                    <p>
                      You strictly agree NOT to perform any of the following prohibited actions:
                    </p>
                    <div className="bg-body-secondary p-4 rounded-3 border">
                      <ul className="mb-0 text-body small">
                        <li className="mb-2">
                          Attempt unauthorized access to other accounts, community workspaces,
                          servers, or databases.
                        </li>
                        <li className="mb-2">
                          Bypass, disable, or circumvent authentication, multi-tenant boundaries, or
                          security protocols.
                        </li>
                        <li className="mb-2">
                          Reverse engineer, decompile, disassemble, or extract source code from
                          Nahom or ManageMyGate except where explicitly allowed by law.
                        </li>
                        <li className="mb-2">
                          Upload viruses, trojans, ransomware, or malicious code to the platform.
                        </li>
                        <li className="mb-2">
                          Use automated bots, crawlers, or scrapers to extract platform data without
                          prior written authorization.
                        </li>
                        <li className="mb-2">
                          Impersonate any resident, security guard, community manager, or Company
                          representative.
                        </li>
                        <li className="mb-2">
                          Forge visitor passes, generate fraudulent payment records, or manipulate
                          billing data.
                        </li>
                        <li className="mb-2">
                          Harass, abuse, stalk, or send spam to community members.
                        </li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 18: Intellectual Property */}
                  <section id="section-18" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">18. Intellectual Property Rights</h2>
                    <p>
                      The Nahom application name, logos, software code, user interface designs,
                      database structures, documentation, and ManageMyGate web portal are the
                      exclusive intellectual property of{' '}
                      <strong>Atominos Consulting Private Limited</strong>.
                    </p>
                    <p>
                      We grant you a limited, non-exclusive, non-transferable, revocable license to
                      download and use the application for authorized community management purposes.
                      You acquire no ownership rights to the underlying software or trademarks.
                    </p>
                  </section>

                  {/* Section 19: Privacy & Data Protection */}
                  <section id="section-19" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">19. Privacy &amp; Data Protection</h2>
                    <p>
                      The collection, use, storage, sharing, and protection of personal information
                      are governed by the{' '}
                      <Link to="/privacy-policy" className="fw-semibold text-decoration-none">
                        Nahom Privacy Policy
                      </Link>{' '}
                      accessible at{' '}
                      <a
                        href="https://managemygate.e3esg.com/privacy-policy"
                        target="_blank"
                        rel="noreferrer"
                        className="fw-semibold"
                      >
                        https://managemygate.e3esg.com/privacy-policy
                      </a>
                      .
                    </p>
                  </section>

                  {/* Section 20: Account Suspension & Termination */}
                  <section id="section-20" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      20. Account Suspension and Termination
                    </h2>
                    <p>
                      We reserve the right to suspend or terminate your account access without prior
                      notice if:
                    </p>
                    <ul>
                      <li className="mb-2">
                        You violate these Terms &amp; Conditions or community operational rules.
                      </li>
                      <li className="mb-2">
                        Your account exhibits fraudulent, illegal, or malicious activity.
                      </li>
                      <li className="mb-2">
                        Your Community Administrator revokes your residency or workspace
                        verification.
                      </li>
                      <li className="mb-2">Required by law enforcement or judicial order.</li>
                    </ul>
                  </section>

                  {/* Section 21: Account Deletion */}
                  <section id="section-21" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">21. Self-Service Account Deletion</h2>
                    <p>
                      In compliance with mobile app store policies, users may request or perform
                      account deletion:
                    </p>
                    <ul>
                      <li className="mb-2">
                        <strong>In-App Deletion:</strong> Authenticated mobile users can navigate to{' '}
                        <em>Settings &rarr; Account &rarr; Delete Account</em> inside Nahom (or via
                        authenticated account deletion requests) to execute account deletion.
                      </li>
                      <li className="mb-2">
                        <strong>Public Web Deletion Portal:</strong> Unauthenticated users or
                        individuals requesting deletion may submit a verified request via our public
                        deletion portal at{' '}
                        <Link to="/delete-account" className="fw-semibold text-decoration-none">
                          https://managemygate.e3esg.com/delete-account
                        </Link>
                        .
                      </li>
                    </ul>
                    <p className="small text-body-secondary">
                      Account deletion removes personal credentials and profile details. Anonymized
                      operational logs (such as past visitor entry logs, accounting receipts, or
                      security audit logs) are retained in accordance with applicable legal,
                      financial, and security audit requirements as described in the Privacy Policy.
                    </p>
                  </section>

                  {/* Section 22: Service Availability */}
                  <section id="section-22" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">
                      22. Service Availability &amp; Downtime
                    </h2>
                    <p>
                      Nahom is provided on an &quot;as available&quot; basis.{' '}
                      <strong>
                        We do not guarantee uninterrupted, continuous, or error-free platform
                        operation
                      </strong>
                      .
                    </p>
                    <p>
                      Temporary service interruptions may occur due to scheduled maintenance,
                      emergency security patches, network failures, or third-party cloud outages. We
                      reserve the right to update or modify features at any time.
                    </p>
                  </section>

                  {/* Section 23: Security Disclaimer */}
                  <section id="section-23" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">23. Security Disclaimer</h2>
                    <div className="p-4 bg-body-secondary rounded-3 border">
                      <p className="mb-2 text-uppercase fw-bold small text-primary tracking-wide">
                        Workflow &amp; Safety Notice
                      </p>
                      <p className="mb-0 small text-body">
                        Nahom provides technology software that facilitates community administrative
                        workflows and gate logging.{' '}
                        <strong>
                          Nahom does NOT guarantee the physical safety of residents or property
                        </strong>
                        . Physical security depends on community policies, security personnel on
                        duty, physical gates, and real-world factors outside the Company&apos;s
                        control.
                      </p>
                    </div>
                  </section>

                  {/* Section 24: Disclaimer of Warranties */}
                  <section id="section-24" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">24. Disclaimer of Warranties</h2>
                    <div className="p-4 bg-body-secondary rounded-3 border">
                      <p className="mb-0 small text-body">
                        TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, NAHOM AND THE
                        MANAGEMYGATE PLATFORM ARE PROVIDED &quot;AS IS&quot; AND &quot;AS
                        AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                        ATOMINOS CONSULTING PRIVATE LIMITED DISCLAIMS ALL WARRANTIES, INCLUDING
                        IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
                        TITLE, AND NON-INFRINGEMENT.
                      </p>
                    </div>
                  </section>

                  {/* Section 25: Limitation of Liability */}
                  <section id="section-25" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">25. Limitation of Liability</h2>
                    <p>
                      TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ATOMINOS CONSULTING PRIVATE
                      LIMITED, ITS DIRECTORS, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE
                      FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES
                      ARISING FROM YOUR USE OR INABILITY TO USE THE PLATFORM.
                    </p>
                  </section>

                  {/* Section 26: Indemnification */}
                  <section id="section-26" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">26. Indemnification</h2>
                    <p>
                      You agree to defend, indemnify, and hold harmless Atominos Consulting Private
                      Limited, its officers, directors, employees, and agents from any claims,
                      liabilities, damages, or costs (including legal fees) arising from your
                      violation of these Terms, illegal activity, or misuse of the application.
                    </p>
                  </section>

                  {/* Section 27: Changes to Terms */}
                  <section id="section-27" className="mb-5">
                    <h2 className="h4 fw-bold text-body mb-3">27. Changes to Terms</h2>
                    <p>
                      We reserve the right to modify these Terms &amp; Conditions at any time.
                      Updated Terms will be posted on this page with an updated &quot;Last
                      Updated&quot; date. Material changes will be communicated via reasonable
                      in-app or web notifications. Continued use of the platform after updates
                      constitutes acceptance of the modified Terms.
                    </p>
                  </section>

                  {/* Section 28: Governing Law & Contact Information */}
                  <section id="section-28" className="mb-4">
                    <h2 className="h4 fw-bold text-body mb-3">
                      28. Governing Law, Jurisdiction &amp; Contact Information
                    </h2>
                    <p>
                      These Terms &amp; Conditions shall be governed by and interpreted in
                      accordance with applicable laws as designated by Atominos Consulting Private
                      Limited. Any legal dispute or proceeding arising out of or related to these
                      Terms shall be instituted exclusively in competent courts having jurisdiction
                      over the Company.
                    </p>
                    <div className="p-4 bg-body-secondary rounded-3 border mt-3">
                      <h6 className="fw-bold mb-2">Atominos Consulting Private Limited</h6>
                      <p className="mb-1 text-body-secondary small">
                        <strong>Official Website:</strong>{' '}
                        <a href="https://managemygate.e3esg.com" target="_blank" rel="noreferrer">
                          https://managemygate.e3esg.com
                        </a>
                      </p>
                      <p className="mb-1 text-body-secondary small">
                        <strong>General Support Email:</strong>{' '}
                        <a href="mailto:mohanraj@atominosconsulting.com">
                          mohanraj@atominosconsulting.com
                        </a>
                      </p>
                      <p className="mb-1 text-body-secondary small">
                        <strong>Legal &amp; Privacy Policy URL:</strong>{' '}
                        <a
                          href="https://managemygate.e3esg.com/privacy-policy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          https://managemygate.e3esg.com/privacy-policy
                        </a>
                      </p>
                      <p className="mb-1 text-body-secondary small">
                        <strong>Account Deletion URL:</strong>{' '}
                        <a
                          href="https://managemygate.e3esg.com/delete-account"
                          target="_blank"
                          rel="noreferrer"
                        >
                          https://managemygate.e3esg.com/delete-account
                        </a>
                      </p>
                    </div>
                  </section>
                </CCardBody>
              </CCard>

              {/* Back Action Button */}
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

export default TermsPage
