import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import apiClient from '../../../services/apiClient'
import { validateEmail, parseBackendError } from '../../../utils/validation'

/**
 * InviteUserModal Component
 *
 * Renders modal overlay containing form inputs for inviting new community users.
 */
const InviteUserModal = ({ visible, onClose, onSendInvite }) => {
  const [inviteEmail, setInviteEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [villas, setVillas] = useState([])
  const [selectedVillaId, setSelectedVillaId] = useState('')
  const [roles, setRoles] = useState([])
  const [selectedRoleName, setSelectedRoleName] = useState('')
  const [roleTouched, setRoleTouched] = useState(false)
  const [loadingVillas, setLoadingVillas] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (visible) {
      setSubmitError(null)
      setLoadingVillas(true)
      apiClient
        .get('/villas?limit=1000')
        .then((res) => {
          setVillas(res.data?.data || [])
        })
        .catch((err) => {
          console.error('Failed to load villas for invite dropdown:', err)
        })
        .finally(() => {
          setLoadingVillas(false)
        })

      setLoadingRoles(true)
      apiClient
        .get('/roles?limit=100')
        .then((res) => {
          setRoles(res.data?.data || [])
        })
        .catch((err) => {
          console.error('Failed to load roles for invite dropdown:', err)
        })
        .finally(() => {
          setLoadingRoles(false)
        })
    }
  }, [visible])

  const emailValidation = validateEmail(inviteEmail)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setEmailTouched(true)
    setRoleTouched(true)
    setSubmitError(null)

    if (
      emailValidation.state === 'empty' ||
      emailValidation.state === 'incomplete' ||
      emailValidation.state === 'invalid'
    ) {
      return
    }

    if (!selectedRoleName) return

    const selectedRole = roles.find((r) => r.name === selectedRoleName)
    const isTenant = selectedRole ? selectedRole.isTenantRole : false
    if (isTenant && !selectedVillaId) return

    // Determine residentType based on roleName
    let residentType = 'None'
    if (isTenant && selectedRoleName) {
      const lowerName = selectedRoleName.toLowerCase()
      if (lowerName.includes('owner')) residentType = 'Owner'
      else if (lowerName.includes('tenant')) residentType = 'Tenant'
      else if (lowerName.includes('family')) residentType = 'Family'
      else residentType = 'Guest' // Fallback for other tenant roles
    }

    setSubmitting(true)
    try {
      await onSendInvite({
        email: inviteEmail.trim(),
        villaId: isTenant ? selectedVillaId || null : null,
        residentType,
        roleName: selectedRoleName || null,
      })
      handleClose()
    } catch (err) {
      setSubmitError(
        parseBackendError(err, 'Failed to send invitation. Please verify the email and try again.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setInviteEmail('')
    setEmailTouched(false)
    setSelectedVillaId('')
    setSelectedRoleName('')
    setRoleTouched(false)
    setSubmitError(null)
    onClose()
  }

  const selectedRoleObj = roles.find((r) => r.name === selectedRoleName)
  const isTenantRole = selectedRoleObj ? selectedRoleObj.isTenantRole : false

  return (
    <CModal visible={visible} onClose={handleClose} id="invite-user-modal" alignment="center">
      <CModalHeader>
        <CModalTitle style={{ fontSize: '1rem', fontWeight: 700 }}>
          Invite Resident / Community Staff
        </CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {submitError && (
            <CAlert
              color="danger"
              className="mb-3"
              dismissible
              onDismiss={() => setSubmitError(null)}
            >
              {submitError}
            </CAlert>
          )}

          <div className="mb-3">
            <CFormLabel
              htmlFor="invite-email-input"
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Email Address <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              id="invite-email-input"
              type="email"
              placeholder="resident@example.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value)
                if (submitError) setSubmitError(null)
              }}
              onBlur={() => setEmailTouched(true)}
              valid={emailTouched && emailValidation.state === 'valid'}
              invalid={
                emailTouched &&
                (emailValidation.state === 'invalid' ||
                  (emailValidation.state === 'empty' && emailTouched))
              }
              feedbackValid="Valid email address format"
              feedbackInvalid={
                emailValidation.state === 'empty'
                  ? 'Email address is required'
                  : emailValidation.message
              }
              text={
                emailTouched && emailValidation.state === 'incomplete'
                  ? 'Keep typing... (e.g. resident@example.com)'
                  : undefined
              }
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="mb-3">
            <CFormLabel
              htmlFor="invite-role-select"
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Select Role <span className="text-danger">*</span>
            </CFormLabel>
            <CFormSelect
              id="invite-role-select"
              value={selectedRoleName}
              onChange={(e) => {
                setSelectedRoleName(e.target.value)
                setRoleTouched(true)
              }}
              onBlur={() => setRoleTouched(true)}
              invalid={roleTouched && !selectedRoleName}
              feedbackInvalid="Please choose a community role"
              className="form-select-sm"
              required
              disabled={loadingRoles || submitting}
            >
              <option value="">-- Choose a Role --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name} ({role.isTenantRole ? 'Tenant/Unit' : 'Global'})
                </option>
              ))}
            </CFormSelect>
          </div>

          {isTenantRole && (
            <div className="mb-3 position-relative">
              <CFormLabel
                htmlFor="invite-villa-select"
                style={{ fontSize: '0.85rem', fontWeight: 600 }}
              >
                Select Villa / Unit
              </CFormLabel>
              <div className="dropdown w-100">
                <button
                  className="btn btn-outline-secondary w-100 text-start d-flex justify-content-between align-items-center form-select-sm bg-white"
                  type="button"
                  data-coreui-toggle="dropdown"
                  aria-expanded="false"
                  disabled={loadingVillas}
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling
                    if (menu.classList.contains('show')) {
                      menu.classList.remove('show')
                    } else {
                      menu.classList.add('show')
                    }
                  }}
                >
                  {selectedVillaId
                    ? (() => {
                        const v = villas.find((v) => v._id === selectedVillaId)
                        return v
                          ? `${v.unitNumber} ${v.blockOrBuilding ? `(${v.blockOrBuilding})` : ''}`
                          : '-- Choose a Villa --'
                      })()
                    : '-- Choose a Villa --'}
                  <span className="caret"></span>
                </button>
                <ul
                  className="dropdown-menu w-100 shadow-sm"
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    position: 'absolute',
                    zIndex: 9999,
                  }}
                >
                  <li>
                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={(e) => {
                        setSelectedVillaId('')
                        e.currentTarget.closest('.dropdown-menu').classList.remove('show')
                      }}
                    >
                      -- Choose a Villa --
                    </button>
                  </li>
                  {villas.map((villa) => (
                    <li key={villa._id}>
                      <button
                        className="dropdown-item"
                        type="button"
                        onClick={(e) => {
                          setSelectedVillaId(villa._id)
                          e.currentTarget.closest('.dropdown-menu').classList.remove('show')
                        }}
                      >
                        {villa.unitNumber}{' '}
                        {villa.blockOrBuilding ? `(${villa.blockOrBuilding})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-2" style={{ fontSize: '0.78rem', color: 'var(--cui-text-muted)' }}>
            An invitation email will be sent with a link to setup credentials.
          </div>
        </CModalBody>
        <CModalFooter className="border-0 pt-0">
          <CButton color="light" size="sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </CButton>
          <CButton
            id="send-invitation-btn"
            type="submit"
            color="primary"
            size="sm"
            disabled={
              submitting ||
              !inviteEmail.trim() ||
              emailValidation.state === 'invalid' ||
              emailValidation.state === 'incomplete' ||
              !selectedRoleName ||
              (isTenantRole && !selectedVillaId)
            }
            style={{ fontWeight: 600 }}
          >
            {submitting ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}

InviteUserModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSendInvite: PropTypes.func.isRequired,
}

export default InviteUserModal
