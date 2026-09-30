import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CBadge,
  CSpinner,
  CAlert,
  CRow,
  CCol,
  CCard,
  CCardBody,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCopy, cilCheck, cilImage, cilExternalLink } from '@coreui/icons'
import {
  REPORT_TYPES,
  FEATURE_MODULES,
  SOURCES,
} from '../constants/issueReport.constants.js'
import { useProtectedAttachment } from '../hooks/useProtectedAttachment.js'
import AppLoader from '../../../components/common/AppLoader'

export const IssueReportDetailModal = ({
  visible,
  onClose,
  report,
  loading,
  error,
}) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const [imageError, setImageError] = useState(false)

  const handleCopyReportNumber = () => {
    if (report?.reportNumber && navigator.clipboard) {
      navigator.clipboard.writeText(report.reportNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const typeConfig = report?.reportType
    ? REPORT_TYPES[report.reportType] || { label: report.reportType, color: 'secondary' }
    : null

  const featureLabel = report?.feature
    ? FEATURE_MODULES[report.feature] || report.feature
    : '—'

  const sourceLabel = report?.source
    ? SOURCES[report.source] || report.source
    : 'Mobile App'

  const screenshot =
    report?.attachments && report.attachments.length > 0
      ? report.attachments[0]
      : null

  const { src: screenshotUrl, failed: screenshotFailed } = useProtectedAttachment(screenshot?.url)

  return (
    <>
      <CModal
        visible={visible}
        onClose={onClose}
        size="lg"
        backdrop="static"
        className="issue-report-detail-modal"
      >
        <CModalHeader closeButton>
          <CModalTitle className="d-flex align-items-center">
            <span className="me-2">
              {t('issueReport.detailModalTitle', { defaultValue: 'Issue Report Details' })}
            </span>
            {report?.reportNumber && (
              <span className="badge bg-primary-subtle text-primary font-monospace ms-2">
                {report.reportNumber}
              </span>
            )}
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          {loading && !report && (
            <div className="text-center py-5">
              <AppLoader variant="block" />
              <span>{t('issueReport.loadingDetails', { defaultValue: 'Loading report details...' })}</span>
            </div>
          )}

          {error && !report && (
            <CAlert color="danger" className="mb-0">
              {error}
            </CAlert>
          )}

          {!report && !loading && !error && (
            <div className="text-center py-5 text-muted">
              <p className="mb-0">{t('issueReport.noDetailsFound', { defaultValue: 'No report details available.' })}</p>
            </div>
          )}

          {report && (
            <div className="report-detail-content">
              {loading && (
                <div className="text-end mb-2">
                  <small className="text-muted d-inline-flex align-items-center">
                    <CSpinner size="sm" color="secondary" className="me-1" />
                    {t('issueReport.refreshing', { defaultValue: 'Syncing details...' })}
                  </small>
                </div>
              )}
              {error && (
                <CAlert color="warning" className="mb-3 py-2 small">
                  {error}
                </CAlert>
              )}
              {/* Header Badges & Copy ID Bar */}
              <div className="d-flex flex-wrap align-items-center justify-content-between p-3 rounded bg-light border mb-4">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="h5 font-monospace fw-bold text-primary mb-0 me-2">
                    {report.reportNumber}
                  </span>

                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    className="py-0 px-2"
                    onClick={handleCopyReportNumber}
                    title={t('issueReport.copyReportNumber', { defaultValue: 'Copy Report #' })}
                  >
                    <CIcon icon={copied ? cilCheck : cilCopy} size="sm" className="me-1" />
                    <small>{copied ? t('common.copied', { defaultValue: 'Copied' }) : t('common.copy', { defaultValue: 'Copy' })}</small>
                  </CButton>

                  {typeConfig && (
                    <CBadge color={typeConfig.color} className="text-uppercase px-2 py-1">
                      {typeConfig.label}
                    </CBadge>
                  )}

                  <CBadge color="dark" className="px-2 py-1">
                    {featureLabel}
                  </CBadge>

                  <CBadge color="light" className="text-muted border px-2 py-1">
                    {sourceLabel}
                  </CBadge>
                </div>

                <div className="text-muted small mt-2 mt-sm-0">
                  {dayjs(report.createdAt).format('MMMM DD, YYYY • hh:mm A')}
                </div>
              </div>

              {/* Title */}
              <div className="mb-4">
                <label className="text-uppercase text-muted fw-bold small mb-1">
                  {t('issueReport.colTitle', { defaultValue: 'Title' })}
                </label>
                <h5 className="fw-bold text-dark">{report.title}</h5>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-uppercase text-muted fw-bold small mb-1">
                  {t('issueReport.description', { defaultValue: 'Description' })}
                </label>
                <div className="p-3 bg-light rounded border text-dark pre-wrap-box">
                  {report.description}
                </div>
              </div>

              {/* 2-Column Info Cards */}
              <CRow className="g-3 mb-4">
                {/* Column 1: Reporter & Organisation */}
                <CCol xs={12} md={6}>
                  <CCard className="h-100 border">
                    <CCardBody>
                      <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">
                        {t('issueReport.reporterAndOrg', { defaultValue: 'Reporter & Community' })}
                      </h6>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.reporterName', { defaultValue: 'Name' })}
                        </span>
                        <strong className="text-dark">{report.reporter?.name || '—'}</strong>
                      </div>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.reporterEmail', { defaultValue: 'Email' })}
                        </span>
                        <span className="text-dark">{report.reporter?.email || '—'}</span>
                      </div>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.reporterPhone', { defaultValue: 'Phone' })}
                        </span>
                        <span className="text-dark">{report.reporter?.phone || '—'}</span>
                      </div>

                      <div className="mb-3">
                        <span className="text-muted small d-block">
                          {t('issueReport.reporterRole', { defaultValue: 'Role' })}
                        </span>
                        <CBadge color="secondary" className="px-2 py-1">
                          {report.reporter?.role || 'Resident'}
                        </CBadge>
                      </div>

                      <div className="pt-2 border-top">
                        <span className="text-muted small d-block">
                          {t('issueReport.colOrg', { defaultValue: 'Organisation' })}
                        </span>
                        <strong className="text-dark">{report.organisation?.name || '—'}</strong>
                        {(report.organisation?.organisationId || report.organisation?.id) && (
                          <div className="text-muted font-monospace org-id-text">
                            ID: {report.organisation.organisationId || report.organisation.id}
                          </div>
                        )}
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>

                {/* Column 2: Technical Context */}
                <CCol xs={12} md={6}>
                  <CCard className="h-100 border">
                    <CCardBody>
                      <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">
                        {t('issueReport.techContext', { defaultValue: 'Technical / Device Context' })}
                      </h6>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.platform', { defaultValue: 'Platform' })}
                        </span>
                        <strong className="text-capitalize text-dark">
                          {report.technicalContext?.platform || '—'}
                        </strong>
                      </div>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.appVersion', { defaultValue: 'App Version' })}
                        </span>
                        <span className="font-monospace text-dark">
                          {report.technicalContext?.appVersion || '—'}
                        </span>
                      </div>

                      <div className="mb-2">
                        <span className="text-muted small d-block">
                          {t('issueReport.deviceModel', { defaultValue: 'Device Model' })}
                        </span>
                        <span className="text-dark">
                          {report.technicalContext?.deviceModel || '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted small d-block">
                          {t('issueReport.osVersion', { defaultValue: 'OS Version' })}
                        </span>
                        <span className="text-dark">
                          {report.technicalContext?.osVersion || '—'}
                        </span>
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>

              {/* Attachments Section */}
              <div className="mb-2">
                <label className="text-uppercase text-muted fw-bold small mb-2 d-block">
                  {t('issueReport.attachment', { defaultValue: 'Screenshot Attachment' })}
                </label>

                {screenshot ? (
                  <div className="p-3 bg-light rounded border">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold text-dark small">{screenshot.fileName}</span>
                      <span className="text-muted small">{formatSize(screenshot.size)}</span>
                    </div>

                    {screenshotUrl && !imageError && !screenshotFailed ? (
                      <div
                        className="screenshot-preview-container text-center rounded border overflow-hidden position-relative bg-white"
                        role="button"
                        tabIndex={0}
                        onClick={() => setPreviewImage(screenshotUrl)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setPreviewImage(screenshotUrl)
                          }
                        }}
                        title={t('issueReport.clickToEnlarge', { defaultValue: 'Click to enlarge' })}
                      >
                        <img
                          src={screenshotUrl}
                          alt="Report screenshot"
                          className="img-fluid screenshot-image"
                          onError={() => setImageError(true)}
                        />
                        <div className="preview-overlay position-absolute bottom-0 end-0 p-2">
                          <CButton size="sm" color="light" className="shadow-sm border">
                            <CIcon icon={cilExternalLink} className="me-1" size="sm" />
                            {t('issueReport.enlarge', { defaultValue: 'Enlarge' })}
                          </CButton>
                        </div>
                      </div>
                    ) : imageError || screenshotFailed ? (
                      <div className="p-4 text-center text-muted border rounded bg-white">
                        <CIcon icon={cilImage} size="xl" className="mb-2" />
                        <div>{t('issueReport.imageLoadError', { defaultValue: 'Screenshot preview unavailable.' })}</div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-muted border rounded bg-white">
                        <CSpinner size="sm" className="me-2" />
                        {t('issueReport.loadingScreenshot', { defaultValue: 'Loading screenshot...' })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-light rounded border text-muted small">
                    {t('issueReport.noAttachment', { defaultValue: 'No screenshot was attached to this report.' })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CModalBody>

        <CModalFooter>
          <CButton color="secondary" onClick={onClose}>
            {t('common.close', { defaultValue: 'Close' })}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Lightbox / Full-screen Image Modal */}
      {previewImage && (
        <CModal
          visible={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          size="xl"
          alignment="center"
        >
          <CModalHeader closeButton>
            <CModalTitle>{t('issueReport.screenshotViewer', { defaultValue: 'Screenshot Viewer' })}</CModalTitle>
          </CModalHeader>
          <CModalBody className="text-center p-2 bg-dark">
            <img
              src={previewImage}
              alt="Screenshot full size"
              className="img-fluid rounded"
              style={{ maxHeight: '80vh', objectFit: 'contain' }}
            />
          </CModalBody>
          <CModalFooter>
            <a
              href={previewImage}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-primary"
            >
              <CIcon icon={cilExternalLink} className="me-1" />
              {t('issueReport.openOriginal', { defaultValue: 'Open Original' })}
            </a>
            <CButton color="secondary" onClick={() => setPreviewImage(null)}>
              {t('common.close', { defaultValue: 'Close' })}
            </CButton>
          </CModalFooter>
        </CModal>
      )}
    </>
  )
}

IssueReportDetailModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  report: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
}

export default IssueReportDetailModal
