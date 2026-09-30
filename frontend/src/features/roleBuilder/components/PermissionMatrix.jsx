import React from 'react'
import PropTypes from 'prop-types'
import { CFormCheck, CRow, CCol } from '@coreui/react'

const PERMISSION_LABEL_OVERRIDES = {
  'billing:action_center': 'Digital Wallet & Resident Ledger',
  'billing:dashboard': 'Billing Hub & Community Ledger',
  'billing:assessment_manager': 'Assessment Manager',
}

const PERMISSION_LABEL_MAP = {
  active_board: 'Resident Feed',
  resident_feed: 'Resident Feed',
  polls: 'Community Engagement',
  community_engagement: 'Community Engagement',
  manage_notices: 'Manage Engagement',
  manage_engagement: 'Manage Engagement',
  dashboard: 'Manage Engagement',
}

const formatPermissionLabel = (permissionString) => {
  if (!permissionString) return ''
  const normalized = String(permissionString).toLowerCase().trim()
  if (PERMISSION_LABEL_OVERRIDES[normalized]) {
    return PERMISSION_LABEL_OVERRIDES[normalized]
  }
  const str = normalized
  if (str === 'notices:active_board' || str === 'notices.active_board' || str === 'active_board') {
    return 'Resident Feed'
  }
  if (str === 'notices:polls' || str === 'notices.polls' || str === 'polls') {
    return 'Community Engagement'
  }
  if (str === 'notices:manage_notices' || str === 'notices.manage_notices' || str === 'manage_notices') {
    return 'Manage Engagement'
  }
  let label = permissionString
  if (label.includes(':')) {
    const parts = label.split(':')
    label = parts[parts.length - 1]
  }
  const key = label.toLowerCase()
  if (PERMISSION_LABEL_MAP[key]) {
    return PERMISSION_LABEL_MAP[key]
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

    const action = permValue.includes(':')
      ? permValue.split(':')[1]
      : permValue.includes('.')
      ? permValue.split('.')[1]
      : permValue
if (
      (action === 'active_board' || permValue === 'notices:active_board') &&
      (selectedIds.includes('notices:read') || selectedIds.includes('notices.read'))
    ) {
      return true
    }
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
    notices: 'Notices Board',
    integrations: 'Integrations Hub',
    complaints: 'Complaints/Maintenance',
  }
  const key = category.toLowerCase()
  return map[key] || category.charAt(0).toUpperCase() + category.slice(1)
}

const CATEGORY_ORDER = {
  visitor: 1,
  amenities: 2,
  complaints: 3,
  notices: 4,
  digital_wallet: 5,
  billing: 6,
  villas: 7,
  users: 8,
  integrations: 9,
}

const AMENITY_TIERS = [
  {
    id: 'resident',
    label: 'Resident',
    description: 'Discovery catalog, booking wizard, wallet & personal passes',
  },
  {
    id: 'security_guard',
    label: 'Security Guard',
    description: 'Gate QR scanner terminal & entry security logs',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Facility master, calendar, maintenance, ledgers, settings & dashboard',
  },
  {
    id: 'none',
    label: 'None',
    description: 'No access to amenity facilities or bookings',
  },
]

const PermissionMatrix = ({
  groupedPermissions,
  selectedIds,
  activeAmenityTier = 'none',
  onSelectAllGroup,
  onTogglePermission,
}) => {
  const [internalTier, setInternalTier] = React.useState('none')
  const currentAmenityTier = activeAmenityTier || internalTier

  const normalizedGroupedPermissions = React.useMemo(() => {
    if (!groupedPermissions) return {}

    const result = {}

    Object.entries(groupedPermissions).forEach(([categoryKey, perms]) => {
      const lowerKey = categoryKey.toLowerCase()

      if (lowerKey === 'billing') {
        const billingPerms = []
        const walletPerms = []

        ;(perms || []).forEach((p) => {
          const permName = (p.name || p.code || p._id || '').toLowerCase()
          const action = permName.includes(':') ? permName.split(':')[1] : permName

          if (action === 'action_center') {
            walletPerms.push({
              ...p,
              name: p.name || 'billing:action_center',
            })
          } else {
            billingPerms.push(p)
          }
        })

        if (billingPerms.length > 0) {
          result['billing'] = billingPerms
        }
        if (walletPerms.length > 0) {
          result['digital_wallet'] = [
            ...(result['digital_wallet'] || []),
            ...walletPerms,
          ]
        }
      } else if (lowerKey === 'digital_wallet' || lowerKey === 'wallet') {
        result['digital_wallet'] = [
          ...(result['digital_wallet'] || []),
          ...(perms || []),
        ]
      } else {
        result[lowerKey] = perms
      }
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
        const isAmenities = category.toLowerCase() === 'amenities'
        const isVisitor = category.toLowerCase() === 'visitor'

        // Filter complaints permissions as requested
        if (category.toLowerCase() === 'complaints') {
          const allowedComplaintsPerms = [
            'dashboard',
            'raise_ticket',
            'complaint_management',
            'staff_vendors',
            'assignee',
            'track_requests',
            'staff',
          ]
          perms = perms.filter((p) => {
            const permName = p.name || p.code || p._id || ''
            const action = permName.includes(':') ? permName.split(':')[1] : permName
            return allowedComplaintsPerms.includes(action.toLowerCase())
          })
        }

        // Filter notices permissions down to strictly 3 granular options:
        // Resident Feed, Community Engagement, Manage Engagement
        const catKey = category.toLowerCase()
        if (catKey === 'notices' || catKey === 'noticeboard' || catKey === 'notices board') {
          const allowedNoticeActions = ['active_board', 'polls', 'manage_notices']
          perms = perms.filter((p) => {
            const permName = p.name || p.code || p._id || ''
            const action = permName.includes(':')
              ? permName.split(':')[1]
              : permName.includes('.')
              ? permName.split('.')[1]
              : permName
            return allowedNoticeActions.includes(action.toLowerCase())
          })

          const existingActions = perms.map((p) => {
            const name = p.name || p.code || p._id || ''
            return name.includes(':') ? name.split(':')[1] : (name.includes('.') ? name.split('.')[1] : name)
          })
          if (!existingActions.includes('active_board')) {
            perms.push({ name: 'notices:active_board', code: 'notices:active_board', _id: 'notices:active_board' })
          }
          if (!existingActions.includes('polls')) {
            perms.push({ name: 'notices:polls', code: 'notices:polls', _id: 'notices:polls' })
          }
          if (!existingActions.includes('manage_notices')) {
            perms.push({ name: 'notices:manage_notices', code: 'notices:manage_notices', _id: 'notices:manage_notices' })
          }
        }

        const groupCodes = perms.map((p) => p.name || p.code || p._id)
        const isAllGroupSelected =
          groupCodes.length > 0 && perms.every((p) => isPermissionSelected(p, selectedIds))

        // Enforce single visual selection for visitor radios if backend synced multiple
        let firstSelectedVisitorPerm = null
        if (isVisitor) {
          const selected = perms.find((p) => isPermissionSelected(p, selectedIds))
          if (selected) {
            firstSelectedVisitorPerm = selected.name || selected.code || selected._id
          }
        }

        const activeAmenityTier = isAmenities ? currentAmenityTier : null

        return (
          <div key={category} className="permission-category-card">
            <div className="permission-card-header">
              <h6 className="permission-card-title">
                {getCategoryDisplayName(category)} Permissions
              </h6>
              {!isVisitor && !isAmenities && (
                <CFormCheck
                  id={`select-all-${category}`}
                  label="Select All"
                  checked={isAllGroupSelected}
                  onChange={(e) => onSelectAllGroup(groupCodes, e.target.checked)}
                  className="permission-select-all-check"
                />
              )}
            </div>

            <CRow className="g-2">
              {isAmenities ? (
                AMENITY_TIERS.map((tier) => {
                  const isChecked = activeAmenityTier === tier.id
                  return (
                    <CCol xs={12} md={6} key={tier.id}>
                      <div
                        className={`p-2 rounded-2 border ${
                          isChecked ? 'border-primary bg-primary-subtle' : 'border-light-subtle bg-body'
                        }`}
                        style={{ cursor: 'pointer', minHeight: '62px' }}
                        onClick={() => {
                          setInternalTier(tier.id)
                          onTogglePermission(`amenities_tier:${tier.id}`, true)
                        }}
                      >
                        <div className="form-check m-0">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="amenities-role-tier-group"
                            id={`amenities-tier-${tier.id}`}
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                          <label
                            className="form-check-label fw-semibold text-body"
                            htmlFor={`amenities-tier-${tier.id}`}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {tier.label}
                          </label>
                          <div
                            className="text-body-secondary small mt-1"
                            style={{ fontSize: '11px', lineHeight: '1.25', userSelect: 'none' }}
                          >
                            {tier.description}
                          </div>
                        </div>
                      </div>
                    </CCol>
                  )
                })
              ) : (
                perms.map((perm) => {
                  const permValue = perm.name || perm.code || perm._id
                  const idSafe = String(permValue).replace(/:/g, '-')

                  let isChecked = isPermissionSelected(perm, selectedIds)
                  if (isVisitor) {
                    isChecked = permValue === firstSelectedVisitorPerm
                  }

                  return (
                    <CCol xs={12} md={6} key={permValue}>
                      {isVisitor ? (
                        // Use native radio input for visitor permissions to bypass CoreUI CFormCheck
                        // aria-hidden focus blocking issues inside CModal
                        <div className="form-check" style={{ cursor: 'pointer' }}>
                          <input
                            className="form-check-input"
                            type="radio"
                            name="visitor-permission-group-native"
                            id={`perm-check-${idSafe}`}
                            checked={isChecked}
                            // Allow deselecting radio button by clicking it again
                            onClick={(e) => {
                              if (isChecked) {
                                e.preventDefault()
                                onTogglePermission(permValue, false)
                              } else {
                                onTogglePermission(permValue, true)
                              }
                            }}
                            onChange={() => {}} // controlled: suppress React warning, logic is in onClick
                            style={{ cursor: 'pointer' }}
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`perm-check-${idSafe}`}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {formatPermissionLabel(perm.name || String(permValue))}
                          </label>
                        </div>
                      ) : (
                        <CFormCheck
                          type="checkbox"
                          id={`perm-check-${idSafe}`}
                          label={formatPermissionLabel(perm.name || String(permValue))}
                          checked={isChecked}
                          onChange={(e) => onTogglePermission(permValue, e.target.checked)}
                        />
                      )}
                    </CCol>
                  )
                })
              )}
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
  activeAmenityTier: PropTypes.string,
  onSelectAllGroup: PropTypes.func.isRequired,
  onTogglePermission: PropTypes.func.isRequired,
}

export default PermissionMatrix

