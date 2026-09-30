import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CBadge,
  CButton,
  } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilPaperclip } from '@coreui/icons'
import {
  REPORT_TYPES,
  FEATURE_MODULES,
} from '../constants/issueReport.constants.js'
import AppLoader from '../../../components/common/AppLoader'

export const IssueReportTable = ({
  reports,
  loading,
  onViewDetails,
}) => {
  const { t } = useTranslation()

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    return dayjs(dateString).format('MMM DD, YYYY • hh:mm A')
  }

  if (loading && (!reports || reports.length === 0)) {
    return (
      <div className="text-center py-5">
        <AppLoader variant="block" />
        <span className="text-muted">
          {t('issueReport.loadingReports', { defaultValue: 'Loading issue reports...' })}
        </span>
      </div>
    )
  }

  if (!reports || reports.length === 0) {
    return (
      <div className="text-center py-5 border rounded bg-light my-3">
        <h5 className="text-muted mb-1">
          {t('issueReport.noReportsTitle', { defaultValue: 'No issue reports found.' })}
        </h5>
        <p className="text-muted small mb-0">
          {t('issueReport.noReportsSubtitle', {
            defaultValue: 'Try changing your search term or filters.',
          })}
        </p>
      </div>
    )
  }

  return (
    <div className="table-responsive">
      <CTable hover align="middle" className="issue-report-table mb-0 border">
        <CTableHead color="light">
          <CTableRow>
            <CTableHeaderCell scope="col" className="col-number">
              {t('issueReport.colNumber', { defaultValue: 'Report #' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-type">
              {t('issueReport.colType', { defaultValue: 'Type' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-feature">
              {t('issueReport.colFeature', { defaultValue: 'Feature' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-title">
              {t('issueReport.colTitle', { defaultValue: 'Title' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-reporter">
              {t('issueReport.colReporter', { defaultValue: 'Reporter' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-org">
              {t('issueReport.colOrg', { defaultValue: 'Organisation' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-created">
              {t('issueReport.colCreated', { defaultValue: 'Submitted' })}
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="col-actions text-end">
              {t('common.actions', { defaultValue: 'Actions' })}
            </CTableHeaderCell>
          </CTableRow>
        </CTableHead>

        <CTableBody>
          {reports.map((report) => {
            const typeConfig = REPORT_TYPES[report.reportType] || {
              label: report.reportType,
              color: 'secondary',
            }
            const featureLabel = FEATURE_MODULES[report.feature] || report.feature
            const hasAttachments = report.attachments && report.attachments.length > 0

            return (
              <CTableRow key={report._id || report.id} className="align-middle">
                {/* Report Number */}
                <CTableDataCell className="align-middle">
                  <span className="font-monospace fw-bold text-primary">
                    {report.reportNumber}
                  </span>
                </CTableDataCell>

                {/* Report Type */}
                <CTableDataCell className="align-middle">
                  <CBadge color={typeConfig.color} className="text-uppercase py-1 px-2 text-nowrap">
                    {typeConfig.label}
                  </CBadge>
                </CTableDataCell>

                {/* Feature Module */}
                <CTableDataCell className="align-middle">
                  <span className="fw-semibold text-dark text-truncate d-inline-block" title={featureLabel}>
                    {featureLabel}
                  </span>
                </CTableDataCell>

                {/* Title & Attachment Indicator */}
                <CTableDataCell className="align-middle">
                  <div className="d-flex align-items-center">
                    <span
                      className="text-truncate fw-medium table-title-text"
                      title={report.title}
                    >
                      {report.title}
                    </span>
                    {hasAttachments && (
                      <span className="badge bg-secondary-subtle text-secondary ms-2 flex-shrink-0" title="Has screenshot">
                        <CIcon icon={cilPaperclip} size="sm" />
                      </span>
                    )}
                  </div>
                </CTableDataCell>

                {/* Reporter Snapshot */}
                <CTableDataCell className="align-middle">
                  <div className="small">
                    <div className="fw-semibold text-dark text-truncate reporter-name" title={report.reporter?.name || ''}>
                      {report.reporter?.name || '—'}
                    </div>
                    <div className="text-muted text-truncate reporter-email" title={report.reporter?.email || ''}>
                      {report.reporter?.email || ''}
                    </div>
                  </div>
                </CTableDataCell>

                {/* Organisation Snapshot */}
                <CTableDataCell className="align-middle">
                  <span
                    className="small text-dark fw-medium text-truncate d-inline-block org-name"
                    title={report.organisation?.name || ''}
                  >
                    {report.organisation?.name || '—'}
                  </span>
                </CTableDataCell>

                {/* Submitted Timestamp (Stacked for compactness) */}
                <CTableDataCell className="align-middle">
                  <div className="small text-dark fw-medium text-nowrap">
                    {dayjs(report.createdAt).format('MMM DD, YYYY')}
                  </div>
                  <div className="text-muted small text-nowrap">
                    {dayjs(report.createdAt).format('hh:mm A')}
                  </div>
                </CTableDataCell>

                {/* Action */}
                <CTableDataCell className="text-end align-middle">
                  <CButton
                    color="primary"
                    variant="outline"
                    size="sm"
                    className="py-1 px-2 text-nowrap"
                    onClick={() => onViewDetails(report._id || report.id, report)}
                    title={t('issueReport.inspectTooltip', { defaultValue: 'Inspect Report' })}
                  >
                    <CIcon icon={cilSearch} className="me-1" size="sm" />
                    {t('issueReport.viewBtn', { defaultValue: 'View' })}
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            )
          })}
        </CTableBody>
      </CTable>
    </div>
  )
}

IssueReportTable.propTypes = {
  reports: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool,
  onViewDetails: PropTypes.func.isRequired,
}

export default IssueReportTable
