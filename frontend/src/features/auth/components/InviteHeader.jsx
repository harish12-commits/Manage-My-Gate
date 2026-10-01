import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { CBadge } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilHome, cilUser, cilShieldAlt } from '@coreui/icons'

/**
 * InviteHeader Component
 *
 * Displays verified workspace invitation attribution and safe details summary.
 * Conforms to the "One Component Per File" and RTL logical styling rules.
 */
export const InviteHeader = ({ inviteData }) => {
  const { t } = useTranslation()

  if (!inviteData) return null

  const orgName = inviteData.orgName || 'Workspace'
  const inviterName = inviteData.inviterName || ''
  const email = inviteData.email || ''
  const role = inviteData.role || ''
  const unit = (inviteData.unit || inviteData.villa || '').trim()

  const isInvalidUnit =
    !unit ||
    unit.toLowerCase() === 'none' ||
    (role && unit.toLowerCase() === role.trim().toLowerCase())

  return (
    <div className="invite-header">
      <div className="invite-hero-banner bg-primary text-white p-4 text-center">
        <CBadge
          color="light"
          text="primary"
          className="mb-2 px-3 py-1 text-uppercase fw-bold shadow-xs"
        >
          {t('auth.invite.badge', 'Workspace Invitation')}
        </CBadge>
        <h2 className="fw-bold mb-1 text-white">{t('auth.invite.headline', "You're Invited!")}</h2>
        <p className="text-white-50 small mb-0">
          {inviterName
            ? t('auth.invite.invitedByWithOrg', '{{inviter}} invited you to join {{org}}', {
                inviter: inviterName,
                org: orgName,
              })
            : t('auth.invite.invitedToOrg', 'You have been invited to join {{org}}', {
                org: orgName,
              })}
        </p>
      </div>

      <div className="invite-summary-strip bg-light px-4 py-3 border-bottom">
        <div className="d-flex align-items-center justify-content-between py-1 border-bottom border-light-subtle">
          <span className="text-muted small d-flex align-items-center gap-1.5">
            <CIcon icon={cilHome} size="sm" className="text-secondary" />{' '}
            {t('auth.invite.community', 'Community')}:
          </span>
          <span className="fw-bold text-dark small">{orgName}</span>
        </div>

        {!isInvalidUnit && (
          <div className="d-flex align-items-center justify-content-between py-1 border-bottom border-light-subtle">
            <span className="text-muted small d-flex align-items-center gap-1.5">
              <CIcon icon={cilHome} size="sm" className="text-secondary" />{' '}
              {t('auth.invite.unit', 'Villa / Unit')}:
            </span>
            <span className="fw-semibold text-dark small">{unit}</span>
          </div>
        )}

        {role && (
          <div className="d-flex align-items-center justify-content-between py-1 border-bottom border-light-subtle">
            <span className="text-muted small d-flex align-items-center gap-1.5">
              <CIcon icon={cilShieldAlt} size="sm" className="text-secondary" />{' '}
              {t('auth.invite.role', 'Role')}:
            </span>
            <CBadge color="primary" className="fw-semibold px-2 py-1">
              {role}
            </CBadge>
          </div>
        )}

        <div className="d-flex align-items-center justify-content-between py-1 flex-wrap gap-1">
          <span className="text-muted small d-flex align-items-center gap-1.5 flex-shrink-0">
            <CIcon icon={cilUser} size="sm" className="text-secondary" />{' '}
            {t('auth.invite.email', 'Email')}:
          </span>
          <span className="small text-muted font-monospace text-break text-end">{email}</span>
        </div>
      </div>
    </div>
  )
}

InviteHeader.propTypes = {
  inviteData: PropTypes.shape({
    orgName: PropTypes.string,
    inviterName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    unit: PropTypes.string,
    villa: PropTypes.string,
  }),
}

export default InviteHeader
