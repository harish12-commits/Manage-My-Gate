import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import CIcon from '@coreui/icons-react'
import { cilSearch } from '@coreui/icons'

/**
 * User Filters Bar — Notice Board `.org-filter-bar` aligned horizontal filter bar.
 * Uses CIcon for search icon instead of Font Awesome.
 */
export const UserFiltersBar = ({
  search,
  roleFilter,
  statusFilter,
  onSearchChange,
  onRoleChange,
  onStatusChange,
}) => {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState(search || '')

  useEffect(() => {
    setSearchTerm(search || '')
  }, [search])

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== search) {
        onSearchChange(searchTerm)
      }
    }, 400)
    return () => clearTimeout(handler)
  }, [searchTerm])

  return (
    <div className="org-filter-bar">
      {/* Search Input */}
      <div className="org-search-group">
        <span className="input-group-text">
          <CIcon icon={cilSearch} size="sm" style={{ color: 'var(--text-muted)' }} />
        </span>
        <input
          type="text"
          className="form-control"
          placeholder={t('superAdmin.orgDetails.searchPlaceholder', {
            defaultValue: 'Search name, email, phone, or villa/unit...',
          })}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Role Filter */}
      <select
        className="form-select"
        value={roleFilter || ''}
        onChange={(e) => onRoleChange(e.target.value)}
        aria-label="Filter by role"
        style={{ maxWidth: '180px' }}
      >
        <option value="">
          {t('superAdmin.orgDetails.allRoles', { defaultValue: 'All Roles' })}
        </option>
        <option value="Admin">
          {t('superAdmin.orgDetails.roleAdmin', { defaultValue: 'Admin' })}
        </option>
        <option value="Resident">
          {t('superAdmin.orgDetails.roleResident', { defaultValue: 'Resident' })}
        </option>
        <option value="Owner">
          {t('superAdmin.orgDetails.roleOwner', { defaultValue: 'Owner' })}
        </option>
        <option value="Security">
          {t('superAdmin.orgDetails.roleSecurity', { defaultValue: 'Security Guard' })}
        </option>
        <option value="Staff">
          {t('superAdmin.orgDetails.roleStaff', { defaultValue: 'Staff' })}
        </option>
      </select>

      {/* Status Filter */}
      <select
        className="form-select"
        value={statusFilter || ''}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Filter by status"
        style={{ maxWidth: '180px' }}
      >
        <option value="">
          {t('superAdmin.orgDetails.allStatuses', { defaultValue: 'All Statuses' })}
        </option>
        <option value="Active">
          {t('superAdmin.orgDetails.statusActive', { defaultValue: 'Active' })}
        </option>
        <option value="Pending">
          {t('superAdmin.orgDetails.statusPending', { defaultValue: 'Pending' })}
        </option>
        <option value="Inactive">
          {t('superAdmin.orgDetails.statusInactive', { defaultValue: 'Inactive' })}
        </option>
        <option value="Blocked">
          {t('superAdmin.orgDetails.statusBlocked', { defaultValue: 'Blocked' })}
        </option>
      </select>
    </div>
  )
}

export default UserFiltersBar
