import React from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CSpinner,
} from '@coreui/react'

export const PollConfirmDialog = ({ visible, onClose, onConfirm, loading, actionType }) => {
  const getDialogContent = () => {
    switch (actionType) {
      case 'delete':
        return {
          title: 'Delete Poll',
          message: 'Are you sure you want to delete this poll? This action cannot be undone.',
          confirmText: 'Delete',
          confirmColor: 'danger',
          loadingText: 'Deleting...',
        }
      case 'publish':
        return {
          title: 'Publish Poll',
          message: 'Are you sure you want to publish this poll? Residents will be able to vote.',
          confirmText: 'Publish',
          confirmColor: 'success',
          loadingText: 'Publishing...',
        }
      case 'close':
        return {
          title: 'Close Poll',
          message: 'Are you sure you want to close this poll? No more votes can be cast.',
          confirmText: 'Close Poll',
          confirmColor: 'warning',
          loadingText: 'Closing...',
        }
      case 'reopen':
        return {
          title: 'Reopen Poll',
          message:
            'Are you sure you want to reopen this poll? Residents will be able to vote again.',
          confirmText: 'Reopen',
          confirmColor: 'info',
          loadingText: 'Reopening...',
        }
      default:
        return {
          title: 'Confirm Action',
          message: 'Are you sure you want to proceed?',
          confirmText: 'Confirm',
          confirmColor: 'primary',
          loadingText: 'Processing...',
        }
    }
  }

  const content = getDialogContent()

  return (
    <CModal visible={visible} onClose={onClose} alignment="center">
      <CModalHeader className="border-0 pb-0">
        <CModalTitle className="h5 fw-bold text-body">{content.title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="mb-0 text-secondary">{content.message}</p>
      </CModalBody>
      <CModalFooter className="border-0 pt-0">
        <CButton
          color="light"
          size="sm"
          onClick={onClose}
          disabled={loading}
          style={{ borderRadius: '8px' }}
        >
          Cancel
        </CButton>
        <CButton
          color={content.confirmColor}
          size="sm"
          onClick={onConfirm}
          disabled={loading}
          className="fw-semibold text-white"
          style={{ borderRadius: '8px' }}
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-1" /> {content.loadingText}
            </>
          ) : (
            content.confirmText
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

PollConfirmDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  actionType: PropTypes.oneOf(['delete', 'publish', 'close', 'reopen', '']),
}

export default PollConfirmDialog
