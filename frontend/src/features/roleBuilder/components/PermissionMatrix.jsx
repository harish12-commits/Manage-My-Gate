import React from 'react'
import PropTypes from 'prop-types'
import { CFormCheck, CRow, CCol } from '@coreui/react'

const formatPermissionLabel = (permissionString) => {
  if (!permissionString) return ''
  const normalized = String(permissionString).toLowerCase().trim()

  let label = permissionString
  if (label.includes(':')) {
    const parts = label.split(':')
    label = parts[parts.length - 1]
  }
  label = label.replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const isPermissionSelected = (perm, selectedIds = []) => {
  if (!perm || !selectedIds || selectedIds.length === 0) return false
  const permValue = perm?.name || perm?.code || perm?._id || perm
  if (selectedIds.includes(permValue)) return true
  if (perm?._id && selectedIds.includes(String(perm._id))) return true

  if (typeof permValue === 'string') {
    const dot = permValue.replace(/:/g, '.')
    const colon = permValue.replace(/\./g, ':')
    if (selectedIds.includes(dot) || selectedIds.includes(colon)) return true
  }
  return false
}

const getCategoryDisplayName = (category) => {
  const map = {
    visitor: 'Visitor Management',
    amenities: 'Amenities & Bookings',
    digital_wallet: 'Digital Wallet & Ledger',
    billing: 'Billing & Invoices',
    villas: 'Unit Management',
    users: 'User Management',
    notices: 'Notice Board & Polls',
    integrations: 'Integrations Hub',
    complaints: 'Complaints & Maintenance',
    roles: 'Role Builder',
    workspaces: 'Workspaces',
  }
  const key = category.toLowerCase()
  return map[key] || category.charAt(0).toUpperCase() + category.slice(1)
}

const CATEGORY_ORDER = {
  visitor: 1,
  amenities: 2,
  complaints: 3,
  notices: 4,
  digital_wallet: 6,
  billing: 7,
  villas: 8,
  users: 9,
  roles: 10,
  workspaces: 11,
  integrations: 12,
}

const PermissionMatrix = ({
  groupedPermissions,
  selectedIds,
  onSelectAllGroup,
  onTogglePermission,
}) => {
  const normalizedGroupedPermissions = React.useMemo(() => {
    if (!groupedPermissions) return {}
    const result = {}

    Object.entries(groupedPermissions).forEach(([categoryKey, perms]) => {
      const lowerKey = categoryKey.toLowerCase()
      if (lowerKey === 'polls') return // Merged into notices
      result[lowerKey] = perms || []
    })

    return result
  }, [groupedPermissions])

  const categories = React.useMemo(() => {
    return Object.keys(normalizedGroupedPermissions).sort((a, b) => {
      const orderA = CATEGORY_ORDER[a.toLowerCase()] ?? 99
      const orderB = CATEGORY_ORDER[b.toLowerCase()] ?? 99
      return orderA - orderB
    })
  }, [normalizedGroupedPermissions])

  if (categories.length === 0) {
    return (
      <div className="text-center text-body-secondary py-3 small">
        No permissions found in the system.
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3">
      {categories.map((category) => {
        let perms = normalizedGroupedPermissions[category] || []

        if (category === 'complaints') {
          const allowed = [
            'dashboard',
            'raise_ticket',
            'complaint_management',
            'assignee',
            'track_requests',
            'staff',
          ]
          perms = perms.filter((p) => {
            const permName = p.name || p.code || p._id || ''
            const action = permName.includes(':')
              ? permName.split(':')[1]
              : permName.includes('.')
                ? permName.split('.')[1]
                : permName
            return allowed.includes(action.toLowerCase())
          })
        }

        if (category === 'notices') {
          const allowed = ['active_board', 'polls', 'manage_notices']
          perms = perms.filter((p) => {
            const permName = p.name || p.code || p._id || ''
            const action = permName.includes(':')
              ? permName.split(':')[1]
              : permName.includes('.')
                ? permName.split('.')[1]
                : permName
            return allowed.includes(action.toLowerCase())
          })
          const existingActions = perms.map((p) => {
            const name = p.name || p.code || p._id || ''
            return name.includes(':')
              ? name.split(':')[1]
              : name.includes('.')
                ? name.split('.')[1]
                : name
          })
          if (!existingActions.includes('active_board'))
            perms.push({ name: 'notices:active_board' })
          if (!existingActions.includes('polls')) perms.push({ name: 'notices:polls' })
          if (!existingActions.includes('manage_notices'))
            perms.push({ name: 'notices:manage_notices' })
        }

        const groupCodes = perms.map((p) => p.name || p.code || p._id)
        const isAllGroupSelected =
          groupCodes.length > 0 && perms.every((p) => isPermissionSelected(p, selectedIds))

        return (
          <div key={category} className="permission-category-card border rounded p-3 bg-white">
            <div className="permission-card-header d-flex justify-content-between align-items-center mb-3">
              <h6 className="permission-card-title m-0 fw-bold">
                {getCategoryDisplayName(category)}
              </h6>
              <CFormCheck
                id={`select-all-${category}`}
                label="Select All"
                checked={isAllGroupSelected}
                onChange={(e) => onSelectAllGroup(groupCodes, e.target.checked)}
                className="permission-select-all-check fw-semibold"
              />
            </div>

            <CRow className="g-2">
              {perms.map((perm) => {
                const permValue = perm.name || perm.code || perm._id
                const idSafe = String(permValue).replace(/[^a-zA-Z0-9-]/g, '-')
                const isChecked = isPermissionSelected(perm, selectedIds)

                return (
                  <CCol xs={12} md={6} key={permValue}>
                    <CFormCheck
                      type="checkbox"
                      id={`perm-check-${idSafe}`}
                      label={formatPermissionLabel(perm.name || String(permValue))}
                      checked={isChecked}
                      onChange={(e) => onTogglePermission(permValue, e.target.checked)}
                    />
                  </CCol>
                )
              })}
            </CRow>
          </div>
        )
      })}
    </div>
  )
}

PermissionMatrix.propTypes = {
  groupedPermissions: PropTypes.object.isRequired,
  selectedIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSelectAllGroup: PropTypes.func.isRequired,
  onTogglePermission: PropTypes.func.isRequired,
}

export default PermissionMatrix
