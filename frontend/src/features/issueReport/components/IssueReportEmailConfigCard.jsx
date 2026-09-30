import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CCard,
  CCardHeader,
  CCardBody,
  CForm,
  CFormInput,
  CButton,
  CAlert,
  CSpinner,
  CRow,
  CCol,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilEnvelopeClosed, cilSave, cilCheckCircle, cilWarning, cilSend } from '@coreui/icons'
import useIssueReports from '../hooks/useIssueReports.js'

export const IssueReportEmailConfigCard = () => {
  const { t } = useTranslation()
  const { emailConfig, fetchEmailConfig, updateEmailConfig, testEmailConfig, clearEmailStatus } = useIssueReports()

  const [inputEmail, setInputEmail] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    fetchEmailConfig()
  }, [fetchEmailConfig])

  useEffect(() => {
    if (emailConfig.email !== undefined) {
      setInputEmail(emailConfig.email || '')
    }
  }, [emailConfig.email])

  const validateEmailFormat = (emailStr) => {
    const trimmed = (emailStr || '').trim()
    if (!trimmed) return true // Allow empty string if removing email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(trimmed)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setValidationError('')
    clearEmailStatus()

    const trimmed = inputEmail.trim()
    if (trimmed && !validateEmailFormat(trimmed)) {
      setValidationError(
        t('issueReport.invalidEmailError', {
          defaultValue: 'Please enter a valid email address.',
        }),
      )
      return
    }

    updateEmailConfig(trimmed)
  }

  const handleTestEmail = async () => {
    setValidationError('')
    clearEmailStatus()
    
    const trimmed = inputEmail.trim()
    if (!trimmed || !validateEmailFormat(trimmed)) {
      setValidationError(
        t('issueReport.invalidEmailForTest', {
          defaultValue: 'Please enter and save a valid email address first.',
        }),
      )
      return
    }
    
    await testEmailConfig(trimmed)
  }

  return (
    <CCard className="shadow-sm border-0 mb-4 email-config-card">
      <CCardHeader className="card-header py-3 bg-light d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <CIcon icon={cilEnvelopeClosed} className="me-2 text-primary" size="lg" />
          <div>
            <h5 className="mb-0 fw-semibold">
              {t('issueReport.emailConfigTitle', {
                defaultValue: 'Platform Email Notifications',
              })}
            </h5>
            <small className="text-muted">
              {t('issueReport.emailConfigSubtitle', {
                defaultValue:
                  'Configure the email address that receives reported issue details whenever a user submits an issue.',
              })}
            </small>
          </div>
        </div>
      </CCardHeader>

      <CCardBody className="p-4">
        {/* Success Banner */}
        {emailConfig.successMessage && (
          <CAlert color="success" dismissible onClose={clearEmailStatus} className="mb-3">
            <CIcon icon={cilCheckCircle} className="me-2" />
            {t('issueReport.emailSaveSuccess', {
              defaultValue: emailConfig.successMessage,
            })}
          </CAlert>
        )}

        {/* Server Error Banner */}
        {emailConfig.error && (
          <CAlert color="danger" dismissible onClose={clearEmailStatus} className="mb-3">
            <CIcon icon={cilWarning} className="me-2" />
            {emailConfig.error}
          </CAlert>
        )}

        {/* Client Validation Error */}
        {validationError && (
          <CAlert color="danger" dismissible onClose={() => setValidationError('')} className="mb-3">
            <CIcon icon={cilWarning} className="me-2" />
            {validationError}
          </CAlert>
        )}

        <CForm onSubmit={handleSubmit}>
          <CRow className="align-items-center g-3">
            <CCol md={6} lg={6}>
              <CFormInput
                type="email"
                id="platformNotificationEmail"
                placeholder={t('issueReport.emailPlaceholder', {
                  defaultValue: 'e.g. admin@platform.com',
                })}
                value={inputEmail}
                onChange={(e) => {
                  setInputEmail(e.target.value)
                  if (validationError) setValidationError('')
                }}
                disabled={emailConfig.loading || emailConfig.saving}
                invalid={!!validationError}
              />
            </CCol>

            <CCol md={3} lg={3}>
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                className="w-100"
                onClick={handleTestEmail}
                disabled={emailConfig.loading || emailConfig.saving || !inputEmail.trim()}
              >
                <CIcon icon={cilSend} className="me-2" />
                {t('issueReport.testEmail', { defaultValue: 'Test SMTP' })}
              </CButton>
            </CCol>

            <CCol md={3} lg={3}>
              <CButton
                type="submit"
                color="primary"
                className="w-100"
                disabled={emailConfig.loading || emailConfig.saving}
              >
                {emailConfig.saving ? (
                  <>
                    <CSpinner size="sm" className="me-2" />
                    {t('issueReport.savingEmail', { defaultValue: 'Saving...' })}
                  </>
                ) : (
                  <>
                    <CIcon icon={cilSave} className="me-2" />
                    {t('issueReport.saveEmail', { defaultValue: 'Save' })}
                  </>
                )}
              </CButton>
            </CCol>
          </CRow>
          <div className="mt-2 text-muted small">
            <em>Need to configure SMTP server settings to send emails? Visit the <a href="#/admin/integration-hub">Integration Hub</a> to set up your mail provider.</em>
          </div>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

export default IssueReportEmailConfigCard
