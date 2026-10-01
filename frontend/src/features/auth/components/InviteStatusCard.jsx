import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CCard, CCardBody, CAlert, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilShieldAlt, cilCheckCircle, cilWarning, cilXCircle } from '@coreui/icons'

/**
 * InviteStatusCard Component
 *
 * Renders terminal invitation lifecycle error states:
 * - Expired
 * - Revoked
 * - Already Accepted
 * - Rejected
 * - Invalid Token
 */
export const InviteStatusCard = ({ status, errorMessage, isAuthenticated }) => {
  const { t } = useTranslation()

  const normalizedStatus = String(status || '').toUpperCase()

  let icon = cilShieldAlt
  let iconBg = 'bg-danger-subtle text-danger'
  let title = t('auth.invite.invalidTitle', 'Invitation Invalid')
  let description =
    errorMessage || t('auth.invite.invalidDesc', 'This invitation link is invalid or malformed.')
  let actionCta = (
    <Link to="/login" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold">
      {t('auth.invite.backToLogin', 'Go to Login')}
    </Link>
  )

  if (
    normalizedStatus === 'EXPIRED' ||
    (errorMessage && errorMessage.toLowerCase().includes('expired'))
  ) {
    icon = cilWarning
    iconBg = 'bg-warning-subtle text-warning'
    title = t('auth.invite.expiredTitle', 'Invitation Expired')
    description = t(
      'auth.invite.expiredDesc',
      'This invitation has expired. Please ask your Community Administrator to resend the invitation.',
    )
    actionCta = (
      <Link to="/login" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold">
        {t('auth.invite.backToLogin', 'Go to Login')}
      </Link>
    )
  } else if (
    normalizedStatus === 'REVOKED' ||
    (errorMessage && errorMessage.toLowerCase().includes('revoked'))
  ) {
    icon = cilXCircle
    iconBg = 'bg-danger-subtle text-danger'
    title = t('auth.invite.revokedTitle', 'Invitation Revoked')
    description = t(
      'auth.invite.revokedDesc',
      'This invitation is no longer available as it has been revoked by the administrator.',
    )
    actionCta = (
      <Link to="/login" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold">
        {t('auth.invite.backToLogin', 'Go to Login')}
      </Link>
    )
  } else if (
    normalizedStatus === 'ACCEPTED' ||
    (errorMessage && errorMessage.toLowerCase().includes('already been accepted'))
  ) {
    icon = cilCheckCircle
    iconBg = 'bg-success-subtle text-success'
    title = t('auth.invite.alreadyAcceptedTitle', 'Invitation Already Accepted')
    description = t(
      'auth.invite.alreadyAcceptedDesc',
      'This invitation has already been accepted and cannot be used again.',
    )
    actionCta = isAuthenticated ? (
      <Link
        to="/dashboard"
        className="btn btn-success px-4 py-2 rounded-pill fw-semibold text-white"
      >
        {t('auth.invite.goToDashboard', 'Go to Dashboard')}
      </Link>
    ) : (
      <Link to="/login" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold">
        {t('auth.invite.signInNow', 'Sign In to Account')}
      </Link>
    )
  } else if (
    normalizedStatus === 'REJECTED' ||
    (errorMessage && errorMessage.toLowerCase().includes('rejected'))
  ) {
    icon = cilXCircle
    iconBg = 'bg-secondary-subtle text-secondary'
    title = t('auth.invite.rejectedTitle', 'Invitation Declined')
    description = t(
      'auth.invite.rejectedDesc',
      'This invitation has been declined. You will not be added to this community workspace.',
    )
    actionCta = (
      <div className="d-flex flex-column align-items-center gap-2">
        <Link to="/" className="btn btn-outline-secondary px-4 py-2 rounded-pill fw-semibold">
          {t('auth.invite.returnHome', 'Return to Home')}
        </Link>
        <Link to="/login" className="btn btn-link text-muted text-decoration-none small">
          {t('auth.invite.backToLogin', 'Sign in with an existing account')}
        </Link>
      </div>
    )
  }

  return (
    <CCard className="invite-card invite-status-card border-0 shadow-lg rounded-4 overflow-hidden">
      <CCardBody className="p-5 text-center">
        <div
          className={`d-inline-flex align-items-center justify-content-center rounded-circle mb-3 ${iconBg}`}
          style={{ width: '64px', height: '64px' }}
        >
          <CIcon icon={icon} size="xl" />
        </div>
        <h3 className="fw-bold mb-2">{title}</h3>
        <CAlert
          color={
            normalizedStatus === 'ACCEPTED'
              ? 'success'
              : normalizedStatus === 'REJECTED'
                ? 'secondary'
                : 'danger'
          }
          className="mb-4 text-start"
        >
          {description}
        </CAlert>
        <div className="mt-3">{actionCta}</div>
      </CCardBody>
    </CCard>
  )
}

InviteStatusCard.propTypes = {
  status: PropTypes.string,
  errorMessage: PropTypes.string,
  isAuthenticated: PropTypes.bool,
}

export default InviteStatusCard
