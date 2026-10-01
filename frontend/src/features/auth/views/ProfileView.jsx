import React, { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm, Controller } from 'react-hook-form'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CFormLabel,
  CFormInput,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import config from '../../../config/config.js'
import useAuth from '../hooks/useAuth'
import { switchWorkspaceContext } from '../store/authSlice'
import useWorkspace from '../../workspace/hooks/useWorkspace'
import '../styles/_auth.scss'

const ProfileView = () => {
  const dispatch = useDispatch()
  const { currentUser, updateProfile, loading, error, successMsg, clearStatus } = useAuth()
  const { organizationName, activeOrganizationId, activeRole } = useWorkspace()
  const availableWorkspaces = useSelector((state) => state.workspace.availableWorkspaces) || []

  const [previewUrl, setPreviewUrl] = useState(null)
  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12)
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [showOrgPicker, setShowOrgPicker] = useState(false)
  const [showUnitPicker, setShowUnitPicker] = useState(false)
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

  const isResidentRole = /resident|tenant|owner|family/i.test(currentActiveRole || '')
  const isSecurityRole = /security|guard/i.test(currentActiveRole || '')
  const isFacilityRole = /facility|amenity|staff|maintenance/i.test(currentActiveRole || '')

  const accessibleUnits = useMemo(() => {
    return isResidentRole && Array.isArray(currentUser?.accessibleUnits)
      ? currentUser.accessibleUnits
      : []
  }, [isResidentRole, currentUser])

  const hasMultipleUnits = isResidentRole && accessibleUnits.length > 1
  const hasMultipleOrgs = availableWorkspaces && availableWorkspaces.length > 1
  const hasMultipleRoles = rolesInOrg && rolesInOrg.length > 1
  const hasMultipleAssignments =
    (isSecurityRole || isFacilityRole) &&
    Array.isArray(availableAssignments) &&
    availableAssignments.length > 1
  const hasAnyContextSwitcher =
    hasMultipleOrgs || hasMultipleRoles || hasMultipleUnits || hasMultipleAssignments

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
      window.location.href = '/dashboard'
    } catch (err) {
      setContextError(err?.message || 'Failed to switch workspace context')
    } finally {
      setSwitchingContext(false)
    }
  }

  const handleSwitchUnit = async (targetVillaId) => {
    if (targetVillaId === currentUser?.villaId) {
      setShowUnitPicker(false)
      return
    }
    setSwitchingContext(true)
    setContextError(null)
    try {
      await dispatch(
        switchWorkspaceContext({
          targetOrgId: activeOrgId,
          targetRole: currentActiveRole,
          targetVillaId,
        }),
      ).unwrap()
      setShowUnitPicker(false)
      window.location.reload()
    } catch (err) {
      setContextError(err?.message || 'Failed to switch property unit context')
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

  const avatarFile = watch('avatar')

  useEffect(() => {
    if (avatarFile && avatarFile.length > 0) {
      const file = avatarFile[0]
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    } else {
      setPreviewUrl(null)
    }
  }, [avatarFile])

  useEffect(() => {
    if (currentUser) {
      reset({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        avatar: null,
      })
      clearStatus()
      setPreviewUrl(null)
    }
  }, [currentUser, reset])

  const onSubmit = async (data) => {
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.phone !== undefined) {
      formData.append('phone', data.phone)
    }
    if (data.avatar && data.avatar.length > 0) {
      formData.append('avatar', data.avatar[0])
    }
    await updateProfile(formData)
  }

  const apiBase = config.apiUrl
  const backendHost = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase
  const existingAvatarUrl = currentUser?.avatar
    ? `${backendHost}/${currentUser.avatar.startsWith('/') ? currentUser.avatar.substring(1) : currentUser.avatar}`
    : null

  const fallbackLetter = currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : 'U'

  return (
    <div className="container-fluid py-3">
      <CRow className="justify-content-center">
        <CCol xs={12} lg={8} xl={7}>
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
          <CCard className="mb-4 shadow-sm border-0">
            <CCardHeader className="bg-white py-3 border-bottom">
              <h5 className="mb-0 fw-bold text-dark">Profile Context</h5>
            </CCardHeader>
            <CCardBody className="p-4">
              <div className="mb-3">
                <div
                  className="text-uppercase text-secondary fw-semibold small"
                  style={{ letterSpacing: '0.5px' }}
                >
                  Current Organisation
                </div>
                <div className="fw-bold fs-5 text-dark mt-1 d-flex align-items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
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

              <div className="mb-3">
                <div
                  className="text-uppercase text-secondary fw-semibold small"
                  style={{ letterSpacing: '0.5px' }}
                >
                  Current Role
                </div>
                <div className="fw-bold fs-5 text-dark mt-1 d-flex align-items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
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

              {isResidentRole ? (
                <div className="mb-4">
                  <div
                    className="text-uppercase text-secondary fw-semibold small"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    Current Villa / Unit
                  </div>
                  <div className="fw-bold fs-5 text-dark mt-1 d-flex align-items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      stroke="#10b981"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>
                      {currentUser?.villaNumber
                        ? `Unit ${currentUser.villaNumber}${currentUser.villaBlock ? ` (${currentUser.villaBlock})` : ''}`
                        : 'No Unit Assigned'}
                    </span>
                  </div>
                </div>
              ) : (isSecurityRole || isFacilityRole) && activeAssignment ? (
                <div className="mb-4">
                  <div
                    className="text-uppercase text-secondary fw-semibold small"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    Current Assignment
                  </div>
                  <div className="fw-bold fs-5 text-dark mt-1 d-flex align-items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      stroke="#0ea5e9"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{activeAssignment.name}</span>
                  </div>
                </div>
              ) : null}

              {hasAnyContextSwitcher && (
                <div className="d-flex flex-wrap gap-2 pt-3 border-top">
                  {hasMultipleOrgs && (
                    <CButton
                      type="button"
                      id="page-btn-switch-org"
                      color="secondary"
                      variant={showOrgPicker ? undefined : 'outline'}
                      size="sm"
                      className="flex-fill fw-semibold py-2 d-flex align-items-center justify-content-center gap-1.5"
                      disabled={switchingContext}
                      onClick={() => {
                        setShowOrgPicker(!showOrgPicker)
                        setShowRolePicker(false)
                        setShowUnitPicker(false)
                        setShowAssignmentPicker(false)
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
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
                  )}

                  {hasMultipleRoles && (
                    <CButton
                      type="button"
                      id="page-btn-switch-role"
                      color="primary"
                      variant={showRolePicker ? undefined : 'outline'}
                      size="sm"
                      className="flex-fill fw-semibold py-2 d-flex align-items-center justify-content-center gap-1.5"
                      disabled={switchingContext}
                      onClick={() => {
                        setShowRolePicker(!showRolePicker)
                        setShowOrgPicker(false)
                        setShowUnitPicker(false)
                        setShowAssignmentPicker(false)
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
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
                  )}

                  {hasMultipleUnits && (
                    <CButton
                      type="button"
                      id="page-btn-switch-unit"
                      color="success"
                      variant={showUnitPicker ? undefined : 'outline'}
                      size="sm"
                      className="flex-fill fw-semibold py-2 d-flex align-items-center justify-content-center gap-1.5"
                      disabled={switchingContext}
                      onClick={() => {
                        setShowUnitPicker(!showUnitPicker)
                        setShowOrgPicker(false)
                        setShowRolePicker(false)
                        setShowAssignmentPicker(false)
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      Switch Villa Unit
                    </CButton>
                  )}

                  {hasMultipleAssignments && (
                    <CButton
                      type="button"
                      id="page-btn-switch-assignment"
                      color="info"
                      variant={showAssignmentPicker ? undefined : 'outline'}
                      size="sm"
                      className="w-100 fw-semibold py-2 d-flex align-items-center justify-content-center gap-1.5 mt-1"
                      disabled={switchingContext}
                      onClick={() => {
                        setShowAssignmentPicker(!showAssignmentPicker)
                        setShowRolePicker(false)
                        setShowOrgPicker(false)
                        setShowUnitPicker(false)
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
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
              )}

              {/* Inline Role Picker */}
              {showRolePicker && (
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select a role in {activeOrgName}:
                  </div>
                  {rolesInOrg.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No other roles assigned to this account in this organisation.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1.5">
                      {rolesInOrg.map((r) => {
                        const isCurrent = r === currentActiveRole
                        return (
                          <button
                            key={r}
                            type="button"
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-3 rounded-2 ${
                              isCurrent
                                ? 'btn-primary text-white shadow-xs'
                                : 'btn-white bg-white border'
                            }`}
                            onClick={() => handleSwitchRole(r)}
                            disabled={switchingContext}
                          >
                            <span className="fw-semibold">{r}</span>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
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
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select an organisation:
                  </div>
                  {availableWorkspaces.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No other organisations found for this account.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1.5">
                      {availableWorkspaces.map((ws) => {
                        const wsOrgId = ws.orgId || ws._id
                        const isCurrent = wsOrgId === activeOrgId
                        return (
                          <button
                            key={wsOrgId}
                            type="button"
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-3 rounded-2 ${
                              isCurrent
                                ? 'btn-secondary text-white shadow-xs'
                                : 'btn-white bg-white border'
                            }`}
                            onClick={() => handleSwitchOrg(wsOrgId, ws.villaId)}
                            disabled={switchingContext}
                          >
                            <div>
                              <div className="fw-semibold">{ws.name}</div>
                              {ws.roles && ws.roles.length > 0 && (
                                <div
                                  className={`small ${isCurrent ? 'text-white-50' : 'text-muted'}`}
                                >
                                  Roles: {ws.roles.join(', ')}
                                </div>
                              )}
                            </div>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
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

              {/* Inline Unit Picker */}
              {showUnitPicker && hasMultipleUnits && (
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select a property unit in {activeOrgName}:
                  </div>
                  <div className="d-flex flex-column gap-1.5">
                    {accessibleUnits.map((u) => {
                      const isCurrent = u.villaId === currentUser?.villaId
                      return (
                        <button
                          key={u.villaId}
                          type="button"
                          className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-3 rounded-2 ${
                            isCurrent
                              ? 'btn-success text-white shadow-xs'
                              : 'btn-white bg-white border'
                          }`}
                          onClick={() => handleSwitchUnit(u.villaId)}
                          disabled={switchingContext}
                        >
                          <div>
                            <div className="fw-semibold">Unit {u.villaNumber}</div>
                            <div className={`small ${isCurrent ? 'text-white-50' : 'text-muted'}`}>
                              {u.block ? `${u.block} • ` : ''}
                              {u.residentType || 'Resident'}
                            </div>
                          </div>
                          {isCurrent && (
                            <svg
                              viewBox="0 0 24 24"
                              width="15"
                              height="15"
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
                </div>
              )}

              {/* Inline Assignment Picker */}
              {showAssignmentPicker && (
                <div className="mt-3 p-3 bg-light rounded-3 border">
                  <div className="small fw-semibold text-secondary mb-2 px-1">
                    Select your active duty station, facility, or unit:
                  </div>
                  {availableAssignments.length === 0 ? (
                    <div className="small text-muted py-2 px-1">
                      No assignments configured for this role.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-1.5">
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
                            className={`btn btn-sm text-start d-flex justify-content-between align-items-center py-2 px-3 rounded-2 ${
                              isCurrent
                                ? 'btn-info text-white shadow-xs'
                                : 'btn-white bg-white border'
                            }`}
                            onClick={() => handleSwitchAssignment(asgObj)}
                            disabled={switchingContext}
                          >
                            <div>
                              <div className="fw-semibold">{asgObj.name}</div>
                              <div
                                className={`small ${isCurrent ? 'text-white-50' : 'text-muted'}`}
                                style={{ fontSize: '0.75rem' }}
                              >
                                Type: {asgObj.type || 'General'}
                              </div>
                            </div>
                            {isCurrent && (
                              <svg
                                viewBox="0 0 24 24"
                                width="15"
                                height="15"
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
            </CCardBody>
          </CCard>

          {/* Personal Details Form */}
          <CCard className="shadow-sm border-0">
            <CCardHeader className="bg-white py-3 border-bottom">
              <h5 className="mb-0 fw-bold text-dark">Personal Information</h5>
            </CCardHeader>
            <CCardBody className="p-4">
              <form onSubmit={handleSubmit(onSubmit)}>
                {/* Avatar Preview */}
                <div className="profile-avatar-container">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="profile-avatar-preview" />
                  ) : existingAvatarUrl ? (
                    <img src={existingAvatarUrl} alt="Avatar" className="profile-avatar-preview" />
                  ) : (
                    <div className="profile-avatar-fallback">{fallbackLetter}</div>
                  )}

                  <div className="w-100 mt-2">
                    <CFormLabel htmlFor="page-profile-avatar-input" className="fw-semibold small">
                      Upload New Avatar
                    </CFormLabel>
                    <CFormInput
                      id="page-profile-avatar-input"
                      type="file"
                      accept="image/*"
                      {...register('avatar')}
                    />
                    <div className="text-muted small mt-1">
                      Accepted formats: JPG, PNG, WebP (Max size: 2MB)
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="mb-3">
                  <CFormLabel htmlFor="page-profile-email-input" className="fw-semibold small">
                    Email Address
                  </CFormLabel>
                  <CFormInput
                    id="page-profile-email-input"
                    type="email"
                    disabled
                    {...register('email')}
                  />
                  <div className="text-muted small mt-1">
                    Email address is managed by administrator and cannot be changed.
                  </div>
                </div>

                {/* Full Name */}
                <div className="mb-3">
                  <CFormLabel htmlFor="page-profile-name-input" className="fw-semibold small">
                    Full Name
                  </CFormLabel>
                  <CFormInput
                    id="page-profile-name-input"
                    type="text"
                    placeholder="e.g. John Doe"
                    {...register('name', { required: 'Name is required' })}
                    invalid={!!errors.name}
                  />
                  {errors.name && (
                    <div className="text-danger small mt-1">{errors.name.message}</div>
                  )}
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <CFormLabel htmlFor="page-profile-phone-input" className="fw-semibold small">
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
                        containerStyle={{ width: '100%' }}
                        inputStyle={{
                          width: '100%',
                          height: '38px',
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
                  {errors.phone && (
                    <div className="text-danger small mt-1">{errors.phone.message}</div>
                  )}
                </div>

                <div className="d-flex justify-content-end">
                  <CButton
                    id="page-save-profile-btn"
                    type="submit"
                    color="primary"
                    disabled={loading}
                    className="px-4 fw-semibold"
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
                </div>
              </form>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default ProfileView
