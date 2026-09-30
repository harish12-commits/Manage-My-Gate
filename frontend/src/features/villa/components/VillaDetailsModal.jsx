import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useDispatch, useSelector } from 'react-redux'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CRow,
  CCol,
  CBadge,
  CSpinner,
  CForm,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CAlert,
  CNav,
  CNavItem,
  CNavLink,
  CFormCheck,
} from '@coreui/react'
import { fetchVillaByIdAsync } from '../store/villaSlice'
import { inviteUserAsync } from '../../userManagement/store/userSlice'
import { fetchRolesAsync } from '../../roleBuilder/store/roleSlice'
import { useAuth } from '../../auth/hooks/useAuth'
import useVilla from '../hooks/useVilla'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import apiClient from '../../../services/apiClient'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'

export const VillaDetailsModal = ({ visible, onClose, villaId, onEdit }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { checkPermission } = useAuth()
  const canUpdate = checkPermission('villas:update')
  const { selectedVilla, selectedVillaLoading } = useSelector((state) => state.villa)
  const { roles } = useSelector((state) => state.roleBuilder || { roles: [] })
  const tenantRoles = roles ? roles.filter((r) => r.isTenantRole).map((r) => r.name) : []

  // Custom hook containing state selectors and dispatch controller wrappers
  const {
    workspaceUsers,
    fetchWorkspaceUsers,
    assignExistingUser,
    updateResidencyType,
    removeResident,
    assignResident,
  } = useVilla()

  // Tab states: 1 = Assign Existing, 2 = Invite via Email
  const [activeTab, setActiveTab] = useState(1)

  // Form states for Tab 1 (Assign Existing)
  const [assignUserId, setAssignUserId] = useState('')
  const [residencyType, setResidencyType] = useState('')
  const [isPrimaryResident, setIsPrimaryResident] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)

  // Form states for Tab 2 (Invite via Email)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteResidencyType, setInviteResidencyType] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12)

  // Inline residency type editor states
  const [editingUserId, setEditingUserId] = useState(null)
  const [editResidencyType, setEditResidencyType] = useState('')

  useEffect(() => {
    if (visible) {
      if (villaId) {
        dispatch(fetchVillaByIdAsync(villaId))
      }
      fetchWorkspaceUsers()
      dispatch(fetchRolesAsync({ page: 1, limit: 100 }))
    }
  }, [dispatch, visible, villaId, fetchWorkspaceUsers])

  const handleAssignExistingSubmit = async (e) => {
    e.preventDefault()
    if (!assignUserId) return

    setAssigning(true)
    setAssignError(null)

    try {
      await assignExistingUser(villaId, assignUserId, residencyType)
      if (isPrimaryResident) {
        await assignResident(villaId, assignUserId)
      }
      toast.success(t('villas.details.assignSuccess', 'Resident assigned successfully'))
      setAssignUserId('')
      setIsPrimaryResident(false)
      // Reload details
      dispatch(fetchVillaByIdAsync(villaId))
    } catch (err) {
      setAssignError(err || t('villas.details.assignFailed', 'Failed to assign resident'))
    } finally {
      setAssigning(false)
    }
  }

  const handleSetPrimaryResident = async (userId) => {
    try {
      await assignResident(villaId, userId)
      toast.success(
        userId
          ? t('villas.details.setPrimarySuccess', 'Primary resident set successfully')
          : t('villas.details.unsetPrimarySuccess', 'Primary resident cleared successfully'),
      )
      dispatch(fetchVillaByIdAsync(villaId))
    } catch (err) {
      toast.error(err || t('villas.details.setPrimaryFailed', 'Failed to update primary resident'))
    }
  }

  const handleInviteSubmit = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    setInviting(true)
    setInviteError(null)

    if (invitePhone && invitePhone.length < expectedPhoneLength) {
      setInviteError(
        t('villas.details.phoneInvalid', 'Invalid phone number length for this country.'),
      )
      setInviting(false)
      return
    }

    try {
      const getResidentType = (type) => {
        if (type.includes('Owner')) return 'Owner'
        if (type === 'Family Member') return 'Family'
        if (type === 'Staff') return 'Guest'
        return 'Tenant'
      }

      const actionResult = await dispatch(
        inviteUserAsync({
          email: inviteEmail.trim(),
          phone: invitePhone.trim(),
          villaId,
          residentType: getResidentType(inviteResidencyType),
          roleName: inviteResidencyType,
        }),
      )

      if (inviteUserAsync.fulfilled.match(actionResult)) {
        toast.success(
          t('villas.details.inviteSuccess', `Invitation sent successfully to ${inviteEmail}`),
        )
        setInviteEmail('')
        setInvitePhone('')
        dispatch(fetchVillaByIdAsync(villaId))
      } else {
        setInviteError(
          actionResult.payload || t('villas.details.inviteFailed', 'Failed to send invitation'),
        )
      }
    } catch (err) {
      setInviteError(err.message || t('villas.details.inviteFailed', 'Invitation failed'))
    } finally {
      setInviting(false)
    }
  }

  const startEditResidencyType = (resident) => {
    setEditingUserId(resident._id || resident.id)
    setEditResidencyType(resident.residentType || 'Tenant')
  }

  const handleSaveResidencyType = async (userId) => {
    try {
      await updateResidencyType(villaId, userId, editResidencyType)
      toast.success(t('villas.details.updateTypeSuccess', 'Residency type updated successfully'))
      setEditingUserId(null)
      dispatch(fetchVillaByIdAsync(villaId))
    } catch (err) {
      toast.error(err || t('villas.details.updateTypeFailed', 'Failed to update residency type'))
    }
  }

  const handleRemoveResident = async (userId) => {
    if (
      !window.confirm(
        t(
          'villas.details.confirmRemove',
          'Are you sure you want to remove this resident from the unit?',
        ),
      )
    ) {
      return
    }
    try {
      await removeResident(villaId, userId)
      toast.success(t('villas.details.removeSuccess', 'Resident removed successfully'))
      dispatch(fetchVillaByIdAsync(villaId))
    } catch (err) {
      toast.error(err || t('villas.details.removeFailed', 'Failed to remove resident'))
    }
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Active':
        return 'success'
      case 'Pending':
        return 'warning'
      default:
        return 'danger'
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      size="lg"
      alignment="center"
      className="villa-details-modal"
    >
      {selectedVillaLoading || !selectedVilla ? (
        <CModalBody className="text-center py-5">
          <CSpinner color="primary" className="mb-2" />
          <div>{t('villas.details.loading', 'Loading unit details...')}</div>
        </CModalBody>
      ) : (
        <>
          <CModalHeader>
            <div className="d-flex align-items-center justify-content-between w-100 pe-3">
              <CModalTitle className="modal-title-custom mb-0">
                {t('villas.details.titlePattern', {
                  number: selectedVilla.villa.unitNumber,
                  defaultValue: `${selectedVilla.villa.unitNumber} Details`,
                })}
              </CModalTitle>
              {canUpdate && onEdit && (
                <CButton
                  color="primary"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(selectedVilla.villa)}
                >
                  {t('villas.details.editUnit', 'Edit Details')}
                </CButton>
              )}
            </div>
          </CModalHeader>
          <CModalBody>
            <CRow className="mb-4">
              <CCol sm={3}>
                <div className="text-muted small">
                  {t('villas.details.blockOrBuilding', 'BLOCK/BUILDING')}
                </div>
                <div className="fw-bold">{selectedVilla.villa.blockOrBuilding || '—'}</div>
              </CCol>
              <CCol sm={3}>
                <div className="text-muted small">{t('villas.details.type', 'TYPE')}</div>
                <div className="fw-bold">
                  {t(`villas.types.${selectedVilla.villa.type}`, selectedVilla.villa.type)}
                </div>
              </CCol>
              <CCol sm={3}>
                <div className="text-muted small">
                  {t('villas.details.status', 'OCCUPANCY STATUS')}
                </div>
                <div>
                  <CBadge
                    color={
                      selectedVilla.villa.status === 'Vacant'
                        ? 'secondary'
                        : selectedVilla.villa.status === 'Occupied'
                          ? 'success'
                          : 'info'
                    }
                  >
                    {t(
                      `villas.statusTypes.${selectedVilla.villa.status}`,
                      selectedVilla.villa.status,
                    )}
                  </CBadge>
                </div>
              </CCol>
              <CCol sm={3}>
                <div className="text-muted small">
                  {t('villas.details.floorArea', 'FLOOR AREA')}
                </div>
                <div className="fw-bold">
                  {selectedVilla.villa.floorAreaSqFt
                    ? `${selectedVilla.villa.floorAreaSqFt} Sq Ft`
                    : '—'}
                </div>
              </CCol>
            </CRow>

            <CRow>
              {/* Left Column: Residents Directory */}
              <CCol md={canUpdate ? 6 : 12} className={canUpdate ? 'border-end pe-md-4' : ''}>
                <h5 className="mb-3 text-primary directory-header">
                  {t('villas.details.directory', 'Residents Directory')}
                </h5>

                {selectedVilla.residents.length === 0 ? (
                  <div className="text-center py-4 text-muted small bg-body-secondary rounded">
                    {t('villas.details.noResidents', 'No residents registered to this unit yet.')}
                  </div>
                ) : (
                  <div className="directory-scroller">
                    {selectedVilla.residents.map((res) => {
                      const residentId = res._id || res.id
                      const isEditing = editingUserId === residentId

                      const isPrimary =
                        selectedVilla.villa.primaryResidentId &&
                        (String(selectedVilla.villa.primaryResidentId) === String(residentId) ||
                          String(selectedVilla.villa.primaryResidentId._id) === String(residentId))

                      return (
                        <div
                          key={residentId}
                          className="resident-list-item d-flex flex-column p-2 mb-2 border rounded bg-body"
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                              <div className="resident-avatar">
                                {res.name
                                  ? res.name.charAt(0).toUpperCase()
                                  : res.email
                                    ? res.email.charAt(0).toUpperCase()
                                    : 'U'}
                              </div>
                              <div>
                                <div className="resident-name fw-semibold small">
                                  {res.name || res.email?.split('@')[0]}
                                  {isPrimary && (
                                    <CBadge color="primary" size="sm" className="ms-2">
                                      {t('villas.details.primaryBadge', 'Primary')}
                                    </CBadge>
                                  )}
                                </div>
                                <div className="resident-email text-muted">{res.email}</div>
                              </div>
                            </div>
                            <div className="d-flex flex-column align-items-end gap-1">
                              <CBadge color={getStatusBadgeColor(res.status)} size="sm">
                                {res.status}
                              </CBadge>
                              <CBadge color="info" size="sm">
                                {t(`villas.details.roles.${res.residentType}`, res.residentType)}
                              </CBadge>
                            </div>
                          </div>

                          {/* Residency Type Editor / Actions Panel */}
                          {canUpdate && (
                            <div className="mt-2 border-top pt-2">
                              {isEditing ? (
                                <div className="d-flex align-items-center gap-1">
                                  <CFormSelect
                                    size="sm"
                                    value={editResidencyType}
                                    onChange={(e) => setEditResidencyType(e.target.value)}
                                    className="inline-select"
                                  >
                                    <option value="" disabled>
                                      Choose...
                                    </option>
                                    {tenantRoles.map((type) => (
                                      <option key={type} value={type}>
                                        {type}
                                      </option>
                                    ))}
                                  </CFormSelect>
                                  <CButton
                                    size="sm"
                                    color="success"
                                    onClick={() => handleSaveResidencyType(residentId)}
                                    className="text-white py-1 px-2 inline-btn"
                                  >
                                    {t('villas.details.save', 'Save')}
                                  </CButton>
                                  <CButton
                                    size="sm"
                                    color="light"
                                    onClick={() => setEditingUserId(null)}
                                    className="py-1 px-2 inline-btn"
                                  >
                                    {t('villas.details.cancel', 'Cancel')}
                                  </CButton>
                                </div>
                              ) : (
                                <div className="d-flex gap-2">
                                  <CButton
                                    color="link"
                                    className="p-0 text-decoration-none inline-btn"
                                    onClick={() => startEditResidencyType(res)}
                                  >
                                    {t('villas.details.editType', 'Edit Type')}
                                  </CButton>
                                  <span className="text-muted separator">|</span>
                                  {!isPrimary ? (
                                    <>
                                      <CButton
                                        color="link"
                                        className="p-0 text-decoration-none inline-btn text-primary"
                                        onClick={() => handleSetPrimaryResident(residentId)}
                                      >
                                        {t('villas.details.setPrimary', 'Set Primary')}
                                      </CButton>
                                      <span className="text-muted separator">|</span>
                                    </>
                                  ) : (
                                    <>
                                      <CButton
                                        color="link"
                                        className="p-0 text-decoration-none inline-btn text-warning"
                                        onClick={() => handleSetPrimaryResident(null)}
                                      >
                                        {t('villas.details.unsetPrimary', 'Unset Primary')}
                                      </CButton>
                                      <span className="text-muted separator">|</span>
                                    </>
                                  )}
                                  <CButton
                                    color="link"
                                    className="p-0 text-decoration-none inline-btn text-danger"
                                    onClick={() => handleRemoveResident(residentId)}
                                  >
                                    {t('villas.details.remove', 'Remove')}
                                  </CButton>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CCol>

              {/* Right Column: Tabbed Assignment Controls */}
              {canUpdate && (
                <CCol md={6} className="ps-md-4 mt-4 mt-md-0">
                  <CNav variant="tabs" className="mb-3">
                    <CNavItem>
                      <CNavLink
                        active={activeTab === 1}
                        onClick={() => setActiveTab(1)}
                        className="nav-link-custom"
                      >
                        {t('villas.details.tabs.assignExisting', 'Assign Existing')}
                      </CNavLink>
                    </CNavItem>
                    <CNavItem>
                      <CNavLink
                        active={activeTab === 2}
                        onClick={() => setActiveTab(2)}
                        className="nav-link-custom"
                      >
                        {t('villas.details.tabs.inviteEmail', 'Invite Resident')}
                      </CNavLink>
                    </CNavItem>
                  </CNav>

                  {/* Tab Content 1: Assign Existing Workspace User */}
                  {activeTab === 1 && (
                    <div>
                      {assignError && (
                        <CAlert color="danger" className="py-2 small">
                          {assignError}
                        </CAlert>
                      )}
                      <CForm onSubmit={handleAssignExistingSubmit}>
                        <div className="mb-3">
                          <CFormLabel htmlFor="assign-user-select" className="small fw-semibold">
                            {t('villas.details.selectUser', 'Select User')}
                          </CFormLabel>
                          <CFormSelect
                            id="assign-user-select"
                            value={assignUserId}
                            onChange={(e) => setAssignUserId(e.target.value)}
                            size="sm"
                            required
                          >
                            <option value="">
                              {t('villas.details.chooseUser', 'Choose a user...')}
                            </option>
                            {workspaceUsers
                              .filter(
                                (u) =>
                                  !selectedVilla.residents.some(
                                    (r) => (r._id || r.id) === (u._id || u.id),
                                  ),
                              )
                              .map((u) => (
                                <option key={u._id || u.id} value={u._id || u.id}>
                                  {u.name || u.email} ({u.email})
                                </option>
                              ))}
                          </CFormSelect>
                        </div>
                        <div className="mb-3">
                          <CFormLabel htmlFor="assign-residency-type" className="small fw-semibold">
                            {t('villas.details.residencyType', 'Residency Type')}
                          </CFormLabel>
                          <CFormSelect
                            id="assign-residency-type"
                            value={residencyType}
                            onChange={(e) => setResidencyType(e.target.value)}
                            size="sm"
                            required
                          >
                            <option value="" disabled>
                              {t('villas.details.chooseType', 'Choose...')}
                            </option>
                            {tenantRoles.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </CFormSelect>
                        </div>
                        <div className="mb-3">
                          <CFormCheck
                            id="assign-primary-check"
                            label={t('villas.details.markPrimary', 'Designate as Primary Resident')}
                            checked={isPrimaryResident}
                            onChange={(e) => setIsPrimaryResident(e.target.checked)}
                            className="form-check-custom"
                          />
                        </div>
                        <CButton
                          type="submit"
                          color="primary"
                          size="sm"
                          className="w-100 fw-semibold"
                          disabled={assigning || !assignUserId}
                        >
                          {assigning
                            ? t('villas.details.assigning', 'Assigning...')
                            : t('villas.details.assignUserBtn', 'Assign User')}
                        </CButton>
                      </CForm>
                    </div>
                  )}

                  {/* Tab Content 2: Invite Resident via Email */}
                  {activeTab === 2 && (
                    <div>
                      {inviteError && (
                        <CAlert color="danger" className="py-2 small">
                          {inviteError}
                        </CAlert>
                      )}
                      <CForm onSubmit={handleInviteSubmit}>
                        <div className="mb-3">
                          <CFormLabel htmlFor="invite-email" className="small fw-semibold">
                            {t('villas.details.emailLabel', 'Email Address')}
                          </CFormLabel>
                          <CFormInput
                            id="invite-email"
                            type="email"
                            placeholder="resident@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            size="sm"
                          />
                        </div>
                        <div className="mb-3">
                          <CFormLabel htmlFor="invite-phone" className="small fw-semibold">
                            {t('villas.details.phoneLabel', 'Phone Number (Optional)')}
                          </CFormLabel>
                          <PhoneInput
                            country={'in'}
                            value={invitePhone}
                            onChange={(phone, country) => {
                              if (country && country.format) {
                                setExpectedPhoneLength(country.format.replace(/[^.]/g, '').length)
                              }
                              setInvitePhone(phone)
                            }}
                            containerStyle={{
                              width: '100%',
                            }}
                            inputStyle={{
                              width: '100%',
                              height: '31px', // matches size="sm" height
                              border: '1px solid #d8dbe0', // coreui default border
                              borderRadius: '0.375rem',
                              fontSize: '14px',
                            }}
                            buttonStyle={{
                              border: '1px solid #d8dbe0',
                              borderRadius: '0.375rem 0 0 0.375rem',
                              backgroundColor: '#ebedef',
                            }}
                          />
                        </div>
                        <div className="mb-3">
                          <CFormLabel htmlFor="invite-resident-type" className="small fw-semibold">
                            {t('villas.details.typeLabel', 'Residency Type')}
                          </CFormLabel>
                          <CFormSelect
                            id="invite-resident-type"
                            value={inviteResidencyType}
                            onChange={(e) => setInviteResidencyType(e.target.value)}
                            size="sm"
                            required
                          >
                            <option value="" disabled>
                              {t('villas.details.chooseType', 'Choose...')}
                            </option>
                            {tenantRoles.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </CFormSelect>
                        </div>
                        <CButton
                          type="submit"
                          color="primary"
                          size="sm"
                          className="w-100 fw-semibold"
                          disabled={inviting || !inviteEmail.trim()}
                        >
                          {inviting
                            ? t('villas.details.sending', 'Sending Invite...')
                            : t('villas.details.sendInvite', 'Send Onboarding Invite')}
                        </CButton>
                      </CForm>
                    </div>
                  )}
                </CCol>
              )}
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" size="sm" onClick={onClose}>
              {t('villas.details.close', 'Close')}
            </CButton>
          </CModalFooter>
        </>
      )}
    </CModal>
  )
}

VillaDetailsModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  villaId: PropTypes.string,
  onEdit: PropTypes.func,
}

export default VillaDetailsModal
