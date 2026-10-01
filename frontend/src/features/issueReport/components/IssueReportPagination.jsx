import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { CPagination, CPaginationItem, CFormSelect } from '@coreui/react'
import { PAGE_LIMIT_OPTIONS } from '../constants/issueReport.constants.js'

export const IssueReportPagination = ({ pagination, onPageChange, onLimitChange, loading }) => {
  const { t } = useTranslation()

  const { currentPage, totalPages, totalRecords, limit } = pagination

  if (totalRecords === 0) return null

  const startRecord = (currentPage - 1) * limit + 1
  const endRecord = Math.min(currentPage * limit, totalRecords)

  // Generate page numbers array (with ellipsis if large)
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      let start = Math.max(1, currentPage - 2)
      let end = Math.min(totalPages, start + maxVisible - 1)

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1)
      }

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
    }
    return pages
  }

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between pt-3 border-top mt-3">
      {/* Records Count & Limit Selector */}
      <div className="d-flex align-items-center mb-2 mb-sm-0">
        <span className="text-muted small me-3">
          {t('issueReport.paginationSummary', {
            defaultValue: 'Showing {{start}}–{{end}} of {{total}} reports',
            start: startRecord,
            end: endRecord,
            total: totalRecords,
          })}
        </span>

        <div className="d-flex align-items-center">
          <span className="text-muted small me-2">
            {t('issueReport.perPage', { defaultValue: 'Per page:' })}
          </span>
          <CFormSelect
            size="sm"
            style={{ width: '80px' }}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={loading}
          >
            {PAGE_LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </CFormSelect>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <CPagination align="end" className="mb-0" size="sm">
          <CPaginationItem
            aria-label="Previous"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(currentPage - 1)}
          >
            &laquo;
          </CPaginationItem>

          {getPageNumbers().map((pageNum) => (
            <CPaginationItem
              key={pageNum}
              active={pageNum === currentPage}
              disabled={loading}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </CPaginationItem>
          ))}

          <CPaginationItem
            aria-label="Next"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(currentPage + 1)}
          >
            &raquo;
          </CPaginationItem>
        </CPagination>
      )}
    </div>
  )
}

IssueReportPagination.propTypes = {
  pagination: PropTypes.shape({
    currentPage: PropTypes.number.isRequired,
    totalPages: PropTypes.number.isRequired,
    totalRecords: PropTypes.number.isRequired,
    limit: PropTypes.number.isRequired,
  }).isRequired,
  onPageChange: PropTypes.func.isRequired,
  onLimitChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

export default IssueReportPagination
