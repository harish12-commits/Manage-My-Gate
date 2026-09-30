import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardHeader,
  CCardBody,
  CTable,
  CTableHead,
  CTableRow,
  CTableHeaderCell,
  CTableBody,
  CTableDataCell,
  CAlert,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import useAuditLog from '../hooks/useAuditLog.js'
import '../styles/_auditLog.scss'
import AppLoader from '../../../components/common/AppLoader'

/**
 * Super Admin View container rendering system-wide event logs in a table view
 */
export const AuditLogViewer = () => {
  const { t } = useTranslation()
  const { logs, totalPages, page, loading, error, fetchLogs } = useAuditLog()

  useEffect(() => {
    fetchLogs(1, 10)
  }, [])

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchLogs(newPage, 10)
    }
  }

  const formatDate = (dateString) => {
    try {
      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }
      return new Date(dateString).toLocaleDateString(undefined, options)
    } catch {
      return dateString
    }
  }

  return (
    <div className="audit-log-container">
      <CContainer fluid>
        <CRow>
          <CCol xs={12}>
            <CCard className="audit-log-card">
              <CCardHeader className="card-header">
                <h3>{t('superAdmin.auditLog.title', { defaultValue: 'Audit Logs' })}</h3>
                <p>
                  {t('superAdmin.auditLog.subtitle', {
                    defaultValue: 'Track system-wide administrative actions and security events.',
                  })}
                </p>
              </CCardHeader>
              <CCardBody>
                {error && (
                  <CAlert color="danger" dismissible>
                    {error}
                  </CAlert>
                )}

                {loading && logs.length === 0 ? (
                  <div className="text-center py-5">
                    <AppLoader variant="block" />
                    <span>
                      {t('superAdmin.auditLog.loading', { defaultValue: 'Loading audit logs...' })}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="table-responsive">
                      <CTable hover align="middle" responsive className="mb-0">
                        <CTableHead>
                          <CTableRow>
                            <CTableHeaderCell scope="col">
                              {t('superAdmin.auditLog.tableDate', { defaultValue: 'Date' })}
                            </CTableHeaderCell>
                            <CTableHeaderCell scope="col">
                              {t('superAdmin.auditLog.tableActor', { defaultValue: 'Actor' })}
                            </CTableHeaderCell>
                            <CTableHeaderCell scope="col">
                              {t('superAdmin.auditLog.tableAction', { defaultValue: 'Action' })}
                            </CTableHeaderCell>
                            <CTableHeaderCell scope="col">
                              {t('superAdmin.auditLog.tableTarget', { defaultValue: 'Target ID' })}
                            </CTableHeaderCell>
                            <CTableHeaderCell scope="col">
                              {t('superAdmin.auditLog.tableMetadata', { defaultValue: 'Metadata' })}
                            </CTableHeaderCell>
                          </CTableRow>
                        </CTableHead>
                        <CTableBody>
                          {logs.length === 0 ? (
                            <CTableRow>
                              <CTableDataCell colSpan={5} className="text-center py-4">
                                {t('superAdmin.auditLog.noData', {
                                  defaultValue: 'No audit logs registered.',
                                })}
                              </CTableDataCell>
                            </CTableRow>
                          ) : (
                            logs.map((log) => {
                              // Safely resolve actor name
                              const actorText = log.actor
                                ? `${log.actor.username} (${log.actor.email})`
                                : log.actorId || 'System'

                              return (
                                <CTableRow key={log._id}>
                                  <CTableDataCell style={{ whiteSpace: 'nowrap' }}>
                                    {formatDate(log.createdAt)}
                                  </CTableDataCell>
                                  <CTableDataCell>{actorText}</CTableDataCell>
                                  <CTableDataCell className="fw-semibold">
                                    {log.action}
                                  </CTableDataCell>
                                  <CTableDataCell className="text-body-secondary small">
                                    {log.targetId || 'N/A'}
                                  </CTableDataCell>
                                  <CTableDataCell>
                                    {log.metadata ? (
                                      <code className="meta-badge">
                                        {JSON.stringify(log.metadata)}
                                      </code>
                                    ) : (
                                      '-'
                                    )}
                                  </CTableDataCell>
                                </CTableRow>
                              )
                            })
                          )}
                        </CTableBody>
                      </CTable>
                    </div>

                    {totalPages > 1 && (
                      <div className="d-flex justify-content-end mt-4">
                        <CPagination aria-label="Page navigation example">
                          <CPaginationItem
                            aria-label="Previous"
                            disabled={page === 1}
                            onClick={() => handlePageChange(page - 1)}
                            style={{ cursor: page === 1 ? 'default' : 'pointer' }}
                          >
                            <span aria-hidden="true">&laquo;</span>
                          </CPaginationItem>
                          {[...Array(totalPages)].map((_, i) => (
                            <CPaginationItem
                              key={i + 1}
                              active={page === i + 1}
                              onClick={() => handlePageChange(i + 1)}
                              style={{ cursor: 'pointer' }}
                            >
                              {i + 1}
                            </CPaginationItem>
                          ))}
                          <CPaginationItem
                            aria-label="Next"
                            disabled={page === totalPages}
                            onClick={() => handlePageChange(page + 1)}
                            style={{ cursor: page === totalPages ? 'default' : 'pointer' }}
                          >
                            <span aria-hidden="true">&raquo;</span>
                          </CPaginationItem>
                        </CPagination>
                      </div>
                    )}
                  </>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default AuditLogViewer
