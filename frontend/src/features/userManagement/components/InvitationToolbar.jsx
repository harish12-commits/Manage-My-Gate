import React from 'react'
import PropTypes from 'prop-types'
import { CFormInput, CFormSelect, CButton, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload, cilSearch } from '@coreui/icons'
import { useTranslation } from 'react-i18next'

/**
 * InvitationToolbar Component
 *
 * Search input, status dropdown, and refresh button for invitation management.
 */
const InvitationToolbar = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  onRefresh,
  loading,
}) => {
  const { t } = useTranslation()

  return (
    <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
      <div className="d-flex flex-wrap gap-2 align-items-center flex-grow-1">
        {/* Search Input */}
        <div
          className="flex-grow-1 flex-md-grow-0"
          style={{ minWidth: 'min(300px, 100%)', maxWidth: '450px' }}
        >
          <div className="input-group input-group-sm">
            <span className="input-group-text bg-transparent border-end-0">
              <CIcon icon={cilSearch} size="sm" className="text-muted" />
            </span>
            <CFormInput
              id="invitation-search-input"
              placeholder={t(
                'invitations.searchPlaceholder',
                'Search recipient name, email, or username...',
              )}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              size="sm"
              className="border-start-0 ps-0"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div style={{ minWidth: '160px' }}>
          <CFormSelect
            id="invitation-status-filter"
            size="sm"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label={t('invitations.filterByStatus', 'Filter by status')}
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ALL'
                  ? t('invitations.allStatuses', 'All Statuses')
                  : t(`invitations.status.${opt.toLowerCase()}`, opt)}
              </option>
            ))}
          </CFormSelect>
        </div>
      </div>

      {/* Refresh Button */}
      <div>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="d-flex align-items-center gap-1"
        >
          {loading ? <CSpinner size="sm" /> : <CIcon icon={cilReload} size="sm" />}
          <span>{t('common.refresh', 'Refresh')}</span>
        </CButton>
      </div>
    </div>
  )
}

InvitationToolbar.propTypes = {
  search: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  status: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  statusOptions: PropTypes.array.isRequired,
  onRefresh: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

InvitationToolbar.defaultProps = {
  loading: false,
}

export default InvitationToolbar
