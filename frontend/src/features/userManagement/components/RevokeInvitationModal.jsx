import React, { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CSpinner,
  CAlert,
} from '@coreui/react'
import { useTranslation } from 'react-i18next'

/**
 * RevokeInvitationModal Component
 *
 * Confirmation dialog for explicitly revoking an unconsumed invitation.
 */
const RevokeInvitationModal = ({ visible, onClose, onConfirm, invitation }) => {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleConfirm = async () => {
    if (!invitation) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(invitation._id)
      onClose()
    } catch (err) {
      setError(err?.message || 'Failed to revoke invitation')
    } finally {
      setSubmitting(false)
    }
  }

  const recipientName = invitation?.recipient?.name || invitation?.recipient?.email || 'this user'
  const recipientEmail = invitation?.recipient?.email || ''

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader closeButton>
        <CModalTitle>{t('invitations.revokeTitle', 'Revoke Invitation')}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error && (
          <CAlert color="danger" dismissible onClose={() => setError(null)}>
            {error}
          </CAlert>
        )}
        <p>
          {t(
            'invitations.revokeConfirmation',
            'Are you sure you want to revoke the invitation for {{name}} ({{email}})?',
            { name: recipientName, email: recipientEmail },
          )}
        </p>
        <div className="alert alert-warning mb-0 py-2">
          <small>
            {t(
              'invitations.revokeWarning',
              'Once revoked, the invitation link will become immediately invalid and cannot be accepted.',
            )}
          </small>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </CButton>
        <CButton color="danger" onClick={handleConfirm} disabled={submitting}>
          {submitting ? (
            <>
              <CSpinner size="sm" className="me-2" />
              {t('invitations.revoking', 'Revoking...')}
            </>
          ) : (
            t('invitations.confirmRevoke', 'Revoke Invitation')
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

RevokeInvitationModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  invitation: PropTypes.object,
}

export default RevokeInvitationModal
