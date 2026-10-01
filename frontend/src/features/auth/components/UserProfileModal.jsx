import React, { useEffect, useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import config from '../../../config/config.js'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormInput,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import useAuth from '../hooks/useAuth'
import { switchWorkspaceContext } from '../store/authSlice'
import useWorkspace from '../../workspace/hooks/useWorkspace'
import '../styles/_auth.scss'

const UserProfileModal = ({ visible, onClose }) => {
  const dispatch = useDispatch()
  const { currentUser, updateProfile, loading, error, successMsg, clearStatus } = useAuth()
  const { organizationName, activeOrganizationId, activeRole } = useWorkspace()
  const availableWorkspaces = useSelector((state) => state.workspace.availableWorkspaces) || []

  const [previewUrl, setPreviewUrl] = useState(null)
  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [showOrgPicker, setShowOrgPicker] = useState(false)
  const [showAssignmentPicker, setShowAssignmentPicker] = useState(false)
  const [switchingContext, setSwitchingContext] = useState(false)
  const [contextError, setContextError] = useState(null)

  const activeOrgId = activeOrganizationId || currentUser?.orgId
  const activeOrgName =
    organizationName ||
    currentUser?.organizationName ||
    currentUser?.orgName ||
    'Active Organisation'
  const currentActiveRole = activeRole || currentUser?.role || 'User'
  const activeAssignment =
    useSelector((state) => state.workspace.activeAssignment) ||
    currentUser?.activeAssignment ||
    null
  const availableAssignments =
    useSelector((state) => state.workspace.availableAssignments) ||
    currentUser?.availableAssignments ||
    currentUser?.accessibleAssignments ||
    []

  // Extract only roles assigned to the user within the currently selected organisation
  const currentWs = availableWorkspaces.find((w) => (w.orgId || w._id) === activeOrgId)
  const rolesInOrg = useMemo(() => {
    if (currentWs?.roles && Array.isArray(currentWs.roles) && currentWs.roles.length > 0) {
      return Array.from(new Set(currentWs.roles.filter(Boolean)))
    }
    if (
      currentUser?.roles &&
      Array.isArray(currentUser.roles) &&
      (currentUser.orgId === activeOrgId || !currentUser.orgId)
    ) {
      return Array.from(new Set(currentUser.roles.filter(Boolean)))
    }
    return currentActiveRole ? [currentActiveRole] : []
  }, [currentWs, currentUser, currentActiveRole, activeOrgId])

  const handleSwitchRole = async (targetRole) => {
    if (targetRole === currentActiveRole) {
      setShowRolePicker(false)
      return
    }
    setSwitchingContext(true)
    setContextError(null)
    try {
      await dispatch(switchWorkspaceContext({ targetOrgId: activeOrgId, targetRole })).unwrap()
      setShowRolePicker(false)
      onClose()
      window.location.reload()
    } catch (err) {
      setContextError(err?.message || 'Failed to switch role context')
    } finally {
      setSwitchingContext(false)
    }
  }

  const handleSwitchOrg = async (targetOrgId, targetVillaId) => {
    if (targetOrgId === activeOrgId) {
      setShowOrgPicker(false)
      return
    }
    setSwitchingContext(true)
    setContextError(null)
    try {
      await dispatch(switchWorkspaceContext({ targetOrgId, targetVillaId })).unwrap()
      setShowOrgPicker(false)
      onClose()
      window.location.href = '/dashboard'
    } catch (err) {
      setContextError(err?.message || 'Failed to switch workspace context')
    } finally {
      setSwitchingContext(false)
    }
  }

  const handleSwitchAssignment = async (asg) => {
    if (
      activeAssignment &&
      (activeAssignment.id === asg.id || activeAssignment.name === asg.name)
    ) {
      setShowAssignmentPicker(false)
      return
    }
    setSwitchingContext(true)
    setContextError(null)
    try {
      await dispatch(
        switchWorkspaceContext({
          targetOrgId: activeOrgId,
          targetRole: currentActiveRole,
          targetAssignmentId: asg.id,
          targetAssignmentName: asg.name,
          targetAssignmentType: asg.type,
        }),
      ).unwrap()
      setShowAssignmentPicker(false)
      onClose()
      window.location.reload()
    } catch (err) {
      setContextError(err?.message || 'Failed to switch assignment context')
    } finally {
      setSwitchingContext(false)
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      avatar: null,
    },
  })

  // Watch avatar file selection to update preview
  const avatarFile = watch('avatar')

  useEffect(() => {
    if (avatarFile && avatarFile.length > 0) {
      const file = avatarFile[0]
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)

      // Clean up memory
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [avatarFile])

  // Populate or reset form fields when modal visibility changes
  useEffect(() => {
    if (visible && currentUser) {
      reset({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        avatar: null,
      })
      clearStatus()
      setPreviewUrl(null)
      setShowRolePicker(false)
      setShowOrgPicker(false)
      setContextError(null)
    }
  }, [visible, currentUser, reset])

  const onSubmit = async (data) => {
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.phone !== undefined) {
      formData.append('phone', data.phone)
    }
    if (data.avatar && data.avatar.length > 0) {
      formData.append('avatar', data.avatar[0])
    }

    const result = await updateProfile(formData)
    if (result.meta.requestStatus === 'fulfilled') {
      setTimeout(() => {
        onClose()
      }, 1000)
    }
  }

  // Derive static asset base URL
  const apiBase = config.apiUrl
  const backendHost = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
  const existingAvatarUrl = currentUser?.avatar
    ? `${backendHost}/${currentUser.avatar.startsWith('/') ? currentUser.avatar.substring(1) : currentUser.avatar}`
    : null

  // Capitalized letter fallback
  const fallbackLetter = currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'U'

  return (
    <CModal visible={visible} onClose={onClose} id="user-profile-modal" alignment="center">
      <CModalHeader>
        <CModalTitle style={{ fontSize: '1rem', fontWeight: 700 }}>My Profile Settings</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CModalBody>
          {error && (
            <CAlert color="danger" className="py-2 small">
              {error}
            </CAlert>
          )}
          {successMsg && (
            <CAlert color="success" className="py-2 small">
              {successMsg}
            </CAlert>
          )}
          {contextError && (
            <CAlert color="danger" className="py-2 small">
              {contextError}
            </CAlert>
          )}

          {/* Organisation & Role Context */}
          <div className="card mb-3 border bg-light rounded-3 shadow-xs">
            <div className="card-body p-3">
              <div className="mb-2">
                <div
                  className="text-uppercase text-secondary fw-semibold"
                  style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}
                >
                  Current Organisation
                </div>
                <div className="fw-bold fs-6 text-dark mt-1 d-flex align-items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    stroke="var(--cui-primary, #4f46e5)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                    <path d="M10 6h4" />
                    <path d="M10 10h4" />
                    <path d="M10 14h4" />
                    <path d="M10 18h4" />
                  </svg>
                  <span>{activeOrgName}</span>
                </div>
              </div>

              <div className="mb-2">
                <div
                  className="text-uppercase text-secondary fw-semibold"
                  style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}
                >
                  Current Role
                </div>
                <div className="fw-bold fs-6 text-dark mt-1 d-flex align-items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    stroke="#059669"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>{currentActiveRole}</span>
                </div>
              </div>

              <div className="mb-3">
                <div
                  className="text-uppercase text-secondary fw-semibold"
                  style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}
                >
                  Current Assignment
                </div>
                <div className="fw-bold fs-6 text-dark mt-1 d-flex align-items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    stroke="#0ea5e9"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{activeAssignment?.name || 'General Community Scope'}</span>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                <CButton
                  type="button"
                  id="btn-switch-org"
                  color="secondary"
                  variant={showOrgPicker ? undefined : 'outline'}
                  size="sm"
                  className="flex-fill fw-semibold d-flex align-items-center justify-content-center gap-1"
                  disabled={switchingContext}
                  onClick={() => {
                    setShowOrgPicker(!showOrgPicker)
                    setShowRolePicker(false)
                    setShowAssignmentPicker(false)
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="13"
                    height="13"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                  </svg>
                  Switch Organisation
                </CButton>

                <CButton
                  type="button"
                  id="btn-switch-role"
                  color="primary"
                  variant={showRolePicker ? undefined : 'outline'}
                  size="sm"
                  className="flex-fill fw-semibold d-flex align-items-center justify-content-center gap-1"
                  disabled={switchingContext}
                  onClick={() => {
                    setShowRolePicker(!showRolePicker)
                    setShowOrgPicker(false)
                    setShowAssignmentPicker(false)
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="13"
                    height="13"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Switch Role
                </CButton>

                {availableAssignments.length > 1 && (
                  <CButton
                    type="button"
                    id="btn-switch-assignment"
                    color="info"
                    variant={showAssignmentPicker ? undefined : 'outline'}
                    size="sm"
                    className="w-100 fw-semibold d-flex align-items-center justify-content-center gap-1 mt-1"
                    disabled={switchingContext}
                    onClick={() => {
                      setShowAssignmentPicker(!showAssignmentPicker)
                      setShowRolePicker(false)
                      setShowOrgPicker(false)
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="13"
                      height="13"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Switch Assignment / Scope
                  </CButton>
                )}
              </div>

              {/* Inline Role Picker */}
              {showRolePicker && (
                <div className="mt-3 p-2 bg-white rounded border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select a role in {activeOrgName}:
                  </div>
                  {rolesInOrg.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No other roles assigned to this account in this organisation.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {rolesInOrg.map((r) => {
                        const isCurrent = r === currentActiveRole
                        return (
                          <button
                            key={r}
                            type="button"
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-2.5 rounded ${
                              isCurrent ? 'btn-primary text-white' : 'btn-light border'
                            }`}
                            onClick={() => handleSwitchRole(r)}
                            disabled={switchingContext}
                          >
                            <span className="fw-semibold">{r}</span>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Organisation Picker */}
              {showOrgPicker && (
                <div className="mt-3 p-2 bg-white rounded border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select an organisation:
                  </div>
                  {availableWorkspaces.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No other organisations found for this account.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {availableWorkspaces.map((ws) => {
                        const wsOrgId = ws.orgId || ws._id
                        const isCurrent = wsOrgId === activeOrgId
                        return (
                          <button
                            key={wsOrgId}
                            type="button"
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-2.5 rounded ${
                              isCurrent ? 'btn-secondary text-white' : 'btn-light border'
                            }`}
                            onClick={() => handleSwitchOrg(wsOrgId, ws.villaId)}
                            disabled={switchingContext}
                          >
                            <div>
                              <div className="fw-semibold">{ws.name}</div>
                              {ws.roles && ws.roles.length > 0 && (
                                <div
                                  className={`small ${isCurrent ? 'text-white-50' : 'text-muted'}`}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Roles: {ws.roles.join(', ')}
                                </div>
                              )}
                            </div>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Assignment Picker */}
              {showAssignmentPicker && (
                <div className="mt-3 p-2 bg-white rounded border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select your active duty station, facility, or unit:
                  </div>
                  {availableAssignments.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No assignments configured for this role.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {availableAssignments.map((asg, idx) => {
                        const asgObj =
                          typeof asg === 'string' ? { id: asg, name: asg, type: 'general' } : asg
                        const isCurrent =
                          activeAssignment &&
                          (activeAssignment.id === asgObj.id ||
                            activeAssignment.name === asgObj.name)
                        return (
                          <button
                            key={asgObj.id || asgObj.name || idx}
                            type="button"
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-2.5 rounded ${
                              isCurrent ? 'btn-info text-white' : 'btn-light border'
                            }`}
                            onClick={() => handleSwitchAssignment(asgObj)}
                            disabled={switchingContext}
                          >
                            <div>
                              <div className="fw-semibold">{asgObj.name}</div>
                              <div
                                className={`small ${isCurrent ? 'text-white-50' : 'text-muted'}`}
                                style={{ fontSize: '0.72rem' }}
                              >
                                Type: {asgObj.type || 'General'}
                              </div>
                            </div>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Avatar Preview & File Upload */}
          <div className="profile-avatar-container">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="profile-avatar-preview" />
            ) : existingAvatarUrl ? (
              <img src={existingAvatarUrl} alt="Avatar" className="profile-avatar-preview" />
            ) : (
              <div className="profile-avatar-fallback">{fallbackLetter}</div>
            )}

            <div className="w-100 mt-2">
              <CFormLabel
                htmlFor="profile-avatar-input"
                style={{ fontSize: '0.85rem', fontWeight: 600 }}
              >
                Upload New Avatar
              </CFormLabel>
              <CFormInput
                id="profile-avatar-input"
                type="file"
                accept="image/*"
                {...register('avatar')}
              />
              <div className="text-muted small mt-1">
                Accepted formats: JPG, PNG, WebP (Max size: 2MB)
              </div>
            </div>
          </div>

          {/* Email (Read Only) */}
          <div className="mb-3">
            <CFormLabel
              htmlFor="profile-email-input"
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Email Address
            </CFormLabel>
            <CFormInput id="profile-email-input" type="email" disabled {...register('email')} />
            <div className="text-muted small mt-1">
              Email address is managed by administrator and cannot be changed.
            </div>
          </div>

          {/* Name */}
          <div className="mb-3">
            <CFormLabel
              htmlFor="profile-name-input"
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Full Name
            </CFormLabel>
            <CFormInput
              id="profile-name-input"
              type="text"
              placeholder="e.g. John Doe"
              {...register('name', { required: 'Name is required' })}
              invalid={!!errors.name}
            />
            {errors.name && <div className="text-danger small mt-1">{errors.name.message}</div>}
          </div>

          {/* Phone */}
          <div className="mb-3">
            <CFormLabel
              htmlFor="profile-phone-input"
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Phone Number
            </CFormLabel>
            <Controller
              name="phone"
              control={control}
              rules={{
                validate: (value) => {
                  if (!value) return true
                  if (value.length < expectedPhoneLength) {
                    return 'Invalid phone number length for this country.'
                  }
                  return true
                },
              }}
              render={({ field: { onChange, value } }) => (
                <PhoneInput
                  country={'in'}
                  value={value}
                  onChange={(phone, country) => {
                    if (country && country.format) {
                      setExpectedPhoneLength(country.format.replace(/[^.]/g, '').length)
                    }
                    onChange(phone)
                  }}
                  containerStyle={{
                    width: '100%',
                  }}
                  inputStyle={{
                    width: '100%',
                    height: '38px', // Match CFormInput height
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '14px',
                  }}
                  buttonStyle={{
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem 0 0 0.375rem',
                    backgroundColor: '#f3f4f6',
                  }}
                  disabled={loading}
                />
              )}
            />
            {errors.phone && <div className="text-danger small mt-1">{errors.phone.message}</div>}
          </div>
        </CModalBody>
        <CModalFooter className="border-0 pt-0">
          <CButton
            id="close-profile-btn"
            color="light"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </CButton>
          <CButton
            id="save-profile-btn"
            type="submit"
            color="primary"
            size="sm"
            style={{ fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}

UserProfileModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default UserProfileModal
