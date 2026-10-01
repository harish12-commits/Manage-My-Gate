import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import {
  CRow,
  CCol,
  CFormInput,
  CFormSelect,
  CButton,
  CInputGroup,
  CInputGroupText,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilFilterX } from '@coreui/icons'
import { REPORT_TYPE_OPTIONS, FEATURE_MODULE_OPTIONS } from '../constants/issueReport.constants.js'
import { loadOrganizations } from '../../organization/store/organizationSlice.js'

export const IssueReportFilters = ({
  filters,
  onFilterChange,
  onReset,
  loading,
  hideOrganizationFilter = false,
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const organizations = useSelector((state) => state.organization?.list || [])
  const [searchInput, setSearchInput] = useState(filters.search || '')

  useEffect(() => {
    setSearchInput(filters.search || '')
  }, [filters.search])

  useEffect(() => {
    if (!hideOrganizationFilter && organizations.length === 0) {
      dispatch(loadOrganizations({ page: 1, limit: 100 }))
    }
  }, [dispatch, organizations.length, hideOrganizationFilter])

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault()
    onFilterChange({ search: searchInput })
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearchSubmit(e)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    onFilterChange({ search: '' })
  }

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.reportType ||
    filters.feature ||
    filters.organisationId ||
    filters.startDate ||
    filters.endDate,
  )

  return (
    <div className="issue-report-filters mb-4">
      {/* Primary Row: Search & Category Dropdowns */}
      <CRow className="g-2 mb-2">
        {/* Search Bar */}
        <CCol xs={12} md={6} lg={4}>
          <CInputGroup size="sm">
            <CInputGroupText>
              <CIcon icon={cilSearch} size="sm" />
            </CInputGroupText>
            <CFormInput
              size="sm"
              placeholder={t('issueReport.searchPlaceholder', {
                defaultValue: 'Search by title, number, user, or org...',
              })}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              disabled={loading}
            />
            {searchInput && (
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                size="sm"
                onClick={handleClearSearch}
                disabled={loading}
              >
                ✕
              </CButton>
            )}
            <CButton
              type="button"
              color="primary"
              size="sm"
              onClick={handleSearchSubmit}
              disabled={loading}
            >
              {t('common.search', { defaultValue: 'Search' })}
            </CButton>
          </CInputGroup>
        </CCol>

        {/* Report Type Filter */}
        <CCol xs={6} sm={4} md={3} lg={2}>
          <CFormSelect
            size="sm"
            value={filters.reportType || ''}
            onChange={(e) => onFilterChange({ reportType: e.target.value })}
            disabled={loading}
          >
            {REPORT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </CFormSelect>
        </CCol>

        {/* Feature / Module Filter */}
        <CCol xs={6} sm={4} md={3} lg={3}>
          <CFormSelect
            size="sm"
            value={filters.feature || ''}
            onChange={(e) => onFilterChange({ feature: e.target.value })}
            disabled={loading}
          >
            {FEATURE_MODULE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </CFormSelect>
        </CCol>

        {/* Organisation Filter */}
        {!hideOrganizationFilter && (
          <CCol xs={12} sm={4} md={12} lg={3}>
            <CFormSelect
              size="sm"
              value={filters.organisationId || ''}
              onChange={(e) => onFilterChange({ organisationId: e.target.value })}
              disabled={loading}
            >
              <option value="">
                {t('issueReport.allOrgs', { defaultValue: 'All Communities' })}
              </option>
              {organizations.map((org) => (
                <option key={org._id || org.id} value={org._id || org.id}>
                  {org.name}
                </option>
              ))}
            </CFormSelect>
          </CCol>
        )}
      </CRow>

      {/* Secondary Row: Date Pickers & Actions */}
      <CRow className="g-2 align-items-center">
        {/* Start Date */}
        <CCol xs={6} sm={4} md={3} lg={2}>
          <CInputGroup size="sm">
            <CInputGroupText className="small px-2 text-muted">
              {t('issueReport.from', { defaultValue: 'From' })}
            </CInputGroupText>
            <CFormInput
              type="date"
              size="sm"
              value={filters.startDate ? filters.startDate.slice(0, 10) : ''}
              onChange={(e) => onFilterChange({ startDate: e.target.value })}
              disabled={loading}
              title={t('issueReport.startDate', { defaultValue: 'Start Date' })}
            />
          </CInputGroup>
        </CCol>

        {/* End Date */}
        <CCol xs={6} sm={4} md={3} lg={2}>
          <CInputGroup size="sm">
            <CInputGroupText className="small px-2 text-muted">
              {t('issueReport.to', { defaultValue: 'To' })}
            </CInputGroupText>
            <CFormInput
              type="date"
              size="sm"
              value={filters.endDate ? filters.endDate.slice(0, 10) : ''}
              onChange={(e) => onFilterChange({ endDate: e.target.value })}
              disabled={loading}
              title={t('issueReport.endDate', { defaultValue: 'End Date' })}
            />
          </CInputGroup>
        </CCol>

        {/* Reset CTA */}
        <CCol
          xs={12}
          sm={4}
          md={6}
          lg={8}
          className="d-flex justify-content-sm-end align-items-center"
        >
          {hasActiveFilters && (
            <CButton
              color="secondary"
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={loading}
              className="text-muted"
            >
              <CIcon icon={cilFilterX} className="me-1" size="sm" />
              {t('issueReport.resetFilters', { defaultValue: 'Reset Filters' })}
            </CButton>
          )}
        </CCol>
      </CRow>
    </div>
  )
}

IssueReportFilters.propTypes = {
  filters: PropTypes.object.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  hideOrganizationFilter: PropTypes.bool,
}

export default IssueReportFilters
