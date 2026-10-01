import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormLabel,
  CFormInput,
  CFormTextarea,
  CFormCheck,
  CButton,
  CRow,
  CCol,
  CSpinner,
} from '@coreui/react'
import useRoles from '../hooks/useRoles'
import useRoleForm from '../hooks/useRoleForm'
import RoleIntegrationConfigurator from './RoleIntegrationConfigurator'
import PermissionMatrix from './PermissionMatrix'
import '../styles/_roleBuilder.scss'

/**
 * RoleFormModal Component
 *
 * Form modal for creating or editing roles.
 * Displays role details and a visual checkbox grid grouped by permissions category.
 */
const RoleFormModal = ({ visible, role, onClose, onSave }) => {
  const { permissionsList, isPermissionsLoading, loadPermissions } = useRoles()
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false)

  const {
    register,
    handleSubmit,
    errors,
    selectedPermissions,
    integrationMappings,
    activeMappingsCount,
    setValue,
    handleSelectAllGroup,
    handleTogglePermission,
  } = useRoleForm({ role, visible, onSave })

  // Load available permissions when modal opens
  useEffect(() => {
    if (visible) {
      loadPermissions()
    }
  }, [visible, loadPermissions])

  return (
    <CModal visible={visible} onClose={onClose} id="role-form-modal" alignment="center" size="lg">
      <CModalHeader>
        <CModalTitle className="modal-title-custom">
          {role ? `Edit Role - ${role.name}` : 'Create New Role'}
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <form id="role-form" onSubmit={handleSubmit}>
          <div className="mb-3">
            <CFormLabel htmlFor="role-name-input" className="form-label-custom">
              Role Name
            </CFormLabel>
            <CFormInput
              id="role-name-input"
              type="text"
              placeholder="e.g., Branch Manager"
              {...register('name')}
              invalid={!!errors.name}
            />
            {errors.name && (
              <div className="text-danger small mt-1" id="role-name-error">
                {errors.name.message}
              </div>
            )}
          </div>

          <div className="mb-3">
            <CFormLabel htmlFor="role-desc-input" className="form-label-custom">
              Description
            </CFormLabel>
            <CFormTextarea
              id="role-desc-input"
              placeholder="Enter role description..."
              rows={3}
              {...register('description')}
              invalid={!!errors.description}
            />
            {errors.description && (
              <div className="text-danger small mt-1" id="role-desc-error">
                {errors.description.message}
              </div>
            )}
          </div>

          <div className="mb-3">
            <CFormCheck
              id="role-is-tenant-input"
              label="Is Tenant/Unit Role (Belongs to Villa/Apartment Unit)"
              {...register('isTenantRole')}
            />
            <div className="text-body-secondary small mt-1">
              If checked, this role will belong to the unit and be selectable when onboarding
              residents to specific villas/apartments.
            </div>
          </div>

          {/* Role Integration Configuration Segment */}
          <div className="mb-3">
            <CFormLabel className="form-label-custom">Role Integrations</CFormLabel>
            <div className="d-flex align-items-center gap-3 p-2 border rounded bg-body-secondary-subtle">
              <CButton
                type="button"
                color="info"
                variant="outline"
                size="sm"
                className="fw-semibold"
                onClick={() => setIsConfiguratorOpen(!isConfiguratorOpen)}
              >
                {isConfiguratorOpen ? 'Hide Configurator' : '🔗 Configure Integrations'}
              </CButton>
              <span className="small text-body-secondary">
                {activeMappingsCount > 0
                  ? `Mapped: ${activeMappingsCount} active provider${activeMappingsCount > 1 ? 's' : ''}`
                  : 'No mapped integrations.'}
              </span>
            </div>

            <RoleIntegrationConfigurator
              isOpen={isConfiguratorOpen}
              onClose={() => setIsConfiguratorOpen(false)}
              mappings={integrationMappings}
              onApply={(newMappings) => {
                setValue('integrationMappings', newMappings, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }}
            />
          </div>

          <div className="form-label-custom mb-2">Granular Permissions Mapping</div>

          <div className="permissions-scroll-container pe-2">
            {isPermissionsLoading ? (
              <div className="d-flex justify-content-center align-items-center py-4 my-2">
                <CSpinner color="primary" size="sm" className="me-2" />
                <span className="text-body-secondary small">Loading available permissions...</span>
              </div>
            ) : (
              <PermissionMatrix
                groupedPermissions={permissionsList}
                selectedIds={selectedPermissions}
                onSelectAllGroup={handleSelectAllGroup}
                onTogglePermission={handleTogglePermission}
              />
            )}
          </div>

          {errors.permissions && (
            <div className="text-danger small mt-2" id="role-permissions-error">
              {errors.permissions.message}
            </div>
          )}
        </form>
      </CModalBody>
      <CModalFooter className="border-0 pt-0">
        <CButton id="close-role-form-btn" color="light" size="sm" onClick={onClose}>
          Cancel
        </CButton>
        <CButton
          id="save-role-btn"
          type="submit"
          form="role-form"
          color="primary"
          size="sm"
          className="fw-semibold"
        >
          {role ? 'Save Changes' : 'Create Role'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

RoleFormModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  role: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
}

export default RoleFormModal
