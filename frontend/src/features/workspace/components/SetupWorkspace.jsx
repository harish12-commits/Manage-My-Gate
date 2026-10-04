import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilHome,
  cilScreenSmartphone,
  cilEnvelopeOpen,
  cilGlobeAlt,
  cilLockLocked,
} from '@coreui/icons'
import useSetupWorkspace from '../hooks/useSetupWorkspace.js'
import { useSelector } from 'react-redux'
import useAuth from '../../auth/hooks/useAuth.js'

/**
 * SetupWorkspace Component
 *
 * Simplified, decoupled view for community/workspace creation.
 * Implements 500ms debounced live organization name availability validation.
 * Adheres to the "Thin View" architectural pattern.
 */
export const SetupWorkspace = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const authUser = useSelector((state) => state.auth.user)
  const availableWorkspaces = useSelector((state) => state.workspace?.availableWorkspaces) || []

  const handleBack = () => {
    const hasExistingOrg = authUser?.orgId || availableWorkspaces.length > 0
    if (hasExistingOrg) {
      navigate('/dashboard')
    } else {
      logout()
      navigate('/register')
    }
  }

  const {
    register,
    handleSubmit,
    errors,
    loading,
    error,
    checking,
    isAvailable,
    checkError,
    isSubmitDisabled,
    onSubmit,
  } = useSetupWorkspace()

  return (
    <div
      className="setup-workspace min-vh-100 d-flex flex-row align-items-center"
      style={styles.pageBackground}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-7 col-lg-6 col-xl-5">
            <CCard style={styles.card}>
              <CCardBody style={styles.cardBody}>
                <CForm onSubmit={handleSubmit(onSubmit)}>
                  <div className="text-center mb-4">
                    <h2 style={styles.title}>
                      {t('workspace.setup.title', { defaultValue: 'Create Your Community' })}
                    </h2>
                    <p style={styles.subtitle}>
                      {t('workspace.setup.subtitle', {
                        defaultValue: 'Establish your enterprise workspace environment',
                      })}
                    </p>
                  </div>

                  {error && (
                    <CAlert color="danger" style={styles.alert}>
                      {error}
                    </CAlert>
                  )}

                  <div className="mb-3">
                    <CInputGroup>
                      <CInputGroupText style={styles.inputIconText}>
                        <CIcon icon={cilHome} style={styles.icon} />
                      </CInputGroupText>
                      <CFormInput
                        style={styles.input}
                        placeholder={t('workspace.setup.namePlaceholder', {
                          defaultValue: 'Community Name',
                        })}
                        disabled={loading}
                        {...register('name', {
                          required: t('workspace.setup.nameRequired', {
                            defaultValue: 'Community name is required.',
                          }),
                          minLength: {
                            value: 3,
                            message: t('workspace.setup.nameLength', {
                              defaultValue: 'Community name must be at least 3 characters.',
                            }),
                          },
                        })}
                      />
                    </CInputGroup>
                    {errors.name && (
                      <div className="text-danger small mt-1 ms-1">{errors.name.message}</div>
                    )}

                    {/* Live Validation Feedback */}
                    {(checking || isAvailable !== null || checkError) && (
                      <div className="mt-2 ms-1" style={styles.feedbackContainer}>
                        {checking && (
                          <span style={styles.checkingText}>
                            <CSpinner
                              size="sm"
                              variant="grow"
                              className="me-2"
                              style={styles.spinner}
                            />
                            {t('workspace.setup.checking', {
                              defaultValue: 'Checking name availability...',
                            })}
                          </span>
                        )}
                        {!checking && isAvailable === true && (
                          <span style={styles.availableText}>
                            ✓{' '}
                            {t('workspace.setup.available', { defaultValue: 'Name is available' })}
                          </span>
                        )}
                        {!checking && isAvailable === false && !checkError && (
                          <span style={styles.unavailableText}>
                            ✗{' '}
                            {t('workspace.setup.taken', {
                              defaultValue: 'Community name is already taken',
                            })}
                          </span>
                        )}
                        {checkError && <span style={styles.unavailableText}>✗ {checkError}</span>}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-3 mt-4">
                    <CButton
                      type="button"
                      color="secondary"
                      variant="ghost"
                      style={styles.backButton}
                      onClick={handleBack}
                      disabled={loading}
                    >
                      {t('workspace.setup.back', { defaultValue: 'Back' })}
                    </CButton>
                    <CButton
                      type="submit"
                      color="primary"
                      className="flex-grow-1"
                      style={isSubmitDisabled ? styles.submitButtonDisabled : styles.submitButton}
                      disabled={isSubmitDisabled}
                    >
                      {loading ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          {t('workspace.setup.loading', { defaultValue: 'Creating Workspace...' })}
                        </>
                      ) : (
                        t('workspace.setup.submit', { defaultValue: 'Create Community' })
                      )}
                    </CButton>
                  </div>
                </CForm>
              </CCardBody>
            </CCard>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  pageBackground: {
    backgroundColor: '#f3f4f6', // Light gray background matching the screenshot
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
  },
  card: {
    borderRadius: '16px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
    background: '#ffffff',
    border: 'none',
    padding: '24px 16px',
    color: '#1f2937',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: '-0.025em',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '15px',
  },
  inputIconText: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    color: '#6b7280',
    minWidth: '50px',
    justifyContent: 'center',
  },
  icon: {
    width: '18px',
    height: '18px',
  },
  input: {
    background: '#ffffff',
    border: '1px solid #d1d5db',
    color: '#1f2937',
    padding: '12px',
  },
  feedbackContainer: {
    fontSize: '14px',
    fontWeight: '500',
  },
  checkingText: {
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
  },
  spinner: {
    width: '14px',
    height: '14px',
  },
  availableText: {
    color: '#10b981',
  },
  unavailableText: {
    color: '#ef4444',
  },
  alert: {
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  submitButton: {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: 'none',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
    color: '#ffffff',
    transition:
      'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
  },
  backButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    transition:
      'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
    minWidth: '100px',
  },
  submitButtonDisabled: {
    background: '#e5e7eb',
    border: 'none',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
}

export default SetupWorkspace
