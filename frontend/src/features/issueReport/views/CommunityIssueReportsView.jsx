import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CAlert,
  CButton,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilReload } from '@coreui/icons'

import ComplaintTopNav from '../../complaints/components/ComplaintTopNav.jsx'
import useIssueReports from '../hooks/useIssueReports.js'
import IssueReportFilters from '../components/IssueReportFilters.jsx'
import IssueReportTable from '../components/IssueReportTable.jsx'
import IssueReportPagination from '../components/IssueReportPagination.jsx'
import IssueReportDetailModal from '../components/IssueReportDetailModal.jsx'
import '../styles/_issueReport.scss'

/**
 * Community Admin View Container for inspecting resident-submitted issue reports.
 * Accessible under Complaints & Maintenance (/admin/complaints/issue-reports).
 */
export const CommunityIssueReportsView = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const deepLinkedReportId = queryParams.get('reportId')

  const {
    reports,
    pagination,
    filters,
    selectedReport,
    loading,
    detailsLoading,
    error,
    detailsError,
    fetchCommunityReports,
    updateCommunityFilters,
    changeCommunityPage,
    changeCommunityLimit,
    resetCommunityFilters,
    openCommunityReportDetails,
    closeReportDetails,
    clearErrors,
  } = useIssueReports()

  const [modalOpen, setModalOpen] = useState(false)

  // Fetch initial community-scoped issue reports
  useEffect(() => {
    fetchCommunityReports({ page: 1 })
  }, [fetchCommunityReports])

  // Handle notification deep-link (?reportId=<id>)
  useEffect(() => {
    if (deepLinkedReportId) {
      setModalOpen(true)
      openCommunityReportDetails(deepLinkedReportId)
    }
  }, [deepLinkedReportId, openCommunityReportDetails])

  const handleViewDetails = (id, reportItem = null) => {
    setModalOpen(true)
    const initialData =
      reportItem || (reports && reports.find((r) => (r._id || r.id) === id)) || null
    openCommunityReportDetails(id, initialData)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    closeReportDetails()
  }

  const handleRefresh = () => {
    fetchCommunityReports()
  }

  return (
    <div className="issue-report-container">
      {/* Top Navigation inside Complaints & Maintenance */}
      <ComplaintTopNav />

      <CContainer fluid>
        <CRow>
          <CCol xs={12}>
            <CCard className="shadow-sm border-0 mb-4">
              <CCardHeader className="card-header d-flex flex-wrap align-items-center justify-content-between py-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <h3 className="mb-0">
                      {t('issueReport.communityPageTitle', { defaultValue: 'Issue Reports' })}
                    </h3>
                    <CBadge color="info" shape="rounded-pill" className="px-2 py-1">
                      {t('issueReport.sourceBadge', { defaultValue: 'Source: Contact Support' })}
                    </CBadge>
                  </div>
                  <p className="mb-0 text-muted small">
                    {t('issueReport.communityPageSubtitle', {
                      defaultValue: 'Reports submitted by residents through Contact Support.',
                    })}
                  </p>
                </div>

                <div className="mt-2 mt-sm-0">
                  <CButton
                    color="primary"
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={loading}
                    title={t('common.refresh', { defaultValue: 'Refresh' })}
                  >
                    <CIcon icon={cilReload} className="me-1" />
                    {t('common.refresh', { defaultValue: 'Refresh' })}
                  </CButton>
                </div>
              </CCardHeader>

              <CCardBody className="p-4">
                {/* Global Error Banner */}
                {error && (
                  <CAlert color="danger" dismissible onClose={clearErrors} className="mb-4">
                    <div className="fw-semibold">
                      {t('issueReport.errorTitle', { defaultValue: 'Error Loading Reports' })}
                    </div>
                    <div>{error}</div>
                  </CAlert>
                )}

                {/* Filters Row (Hide Organisation dropdown as reports are already tenant-scoped) */}
                <IssueReportFilters
                  filters={filters}
                  onFilterChange={updateCommunityFilters}
                  onReset={resetCommunityFilters}
                  loading={loading}
                  hideOrganizationFilter={true}
                />

                {/* Reports Table */}
                <IssueReportTable
                  reports={reports}
                  loading={loading}
                  onViewDetails={handleViewDetails}
                />

                {/* Pagination */}
                <IssueReportPagination
                  pagination={pagination}
                  onPageChange={changeCommunityPage}
                  onLimitChange={changeCommunityLimit}
                  loading={loading}
                />
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>

      {/* Read-Only Report Detail Modal */}
      <IssueReportDetailModal
        visible={modalOpen}
        onClose={handleCloseModal}
        report={selectedReport}
        loading={detailsLoading}
        error={detailsError}
      />
    </div>
  )
}

export default CommunityIssueReportsView
