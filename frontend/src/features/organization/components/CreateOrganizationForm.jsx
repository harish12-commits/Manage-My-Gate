import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilHome } from '@coreui/icons'
import useCreateOrganization from '../hooks/useCreateOrganization.js'
import '../styles/_organization.scss'

/**
 * Presentational form component for creating an organization workspace.
 * Uses centralized SCSS classes, accessible ARIA attributes, and React Hook Form validation.
 *
 * @component
 */
export const CreateOrganizationForm = () => {
  const { t } = useTranslation()
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
    handleBack,
  } = useCreateOrganization()

  return (
    <div className="create-org-page">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-7 col-lg-6 col-xl-5">
            <CCard className="create-org-card">
              <CCardBody className="create-org-card-body">
                <CForm onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="text-center mb-4">
                    <h2 className="create-org-title">
                      {t('organization.create.title', { defaultValue: 'Create Your Organization' })}
                    </h2>
                    <p className="create-org-subtitle">
                      {t('organization.create.subtitle', {
                        defaultValue: 'Establish your enterprise workspace environment',
                      })}
                    </p>
                  </div>

                  {error && (
                    <CAlert color="danger" className="create-org-alert" role="alert">
                      {error}
                    </CAlert>
                  )}

                  <div className="mb-3">
                    <label htmlFor="org-name-input" className="form-label visually-hidden">
                      {t('organization.create.nameLabel', { defaultValue: 'Organization Name' })}
                    </label>
                    <CInputGroup>
                      <CInputGroupText className="create-org-input-group-text">
                        <CIcon icon={cilHome} className="create-org-icon" />
                      </CInputGroupText>
                      <CFormInput
                        id="org-name-input"
                        className="create-org-input"
                        placeholder={t('organization.create.namePlaceholder', {
                          defaultValue: 'Organization Name',
                        })}
                        disabled={loading}
                        aria-invalid={errors.name ? 'true' : 'false'}
                        aria-describedby="org-name-feedback"
                        {...register('name', {
                          required: t('organization.create.nameRequired', {
                            defaultValue: 'Organization name is required.',
                          }),
                          minLength: {
                            value: 3,
                            message: t('organization.create.nameLengthMin', {
                              defaultValue: 'Organization name must be at least 3 characters.',
                            }),
                          },
                          maxLength: {
                            value: 100,
                            message: t('organization.create.nameLengthMax', {
                              defaultValue: 'Organization name must not exceed 100 characters.',
                            }),
                          },
                        })}
                      />
                    </CInputGroup>

                    {errors.name && (
                      <div className="text-danger small mt-1 ms-1" role="alert">
                        {errors.name.message}
                      </div>
                    )}

                    {/* Live Validation Feedback */}
                    {(checking || isAvailable !== null || checkError) && (
                      <div
                        id="org-name-feedback"
                        className="create-org-feedback"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {checking && (
                          <span className="feedback-checking">
                            <CSpinner size="sm" variant="grow" className="feedback-spinner" />
                            {t('organization.create.checking', {
                              defaultValue: 'Checking name availability...',
                            })}
                          </span>
                        )}
                        {!checking && isAvailable === true && (
                          <span className="feedback-available">
                            ✓{' '}
                            {t('organization.create.available', {
                              defaultValue: 'Name is available',
                            })}
                          </span>
                        )}
                        {!checking && isAvailable === false && !checkError && (
                          <span className="feedback-unavailable">
                            ✗{' '}
                            {t('organization.create.taken', {
                              defaultValue: 'Organization name is already taken',
                            })}
                          </span>
                        )}
                        {checkError && <span className="feedback-unavailable">✗ {checkError}</span>}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-3 mt-4">
                    <CButton
                      type="button"
                      color="secondary"
                      variant="ghost"
                      className="create-org-btn-back"
                      onClick={handleBack}
                      disabled={loading}
                    >
                      {t('organization.create.back', { defaultValue: 'Back' })}
                    </CButton>
                    <CButton
                      type="submit"
                      color="primary"
                      className="flex-grow-1 create-org-btn-submit"
                      disabled={isSubmitDisabled}
                      aria-busy={loading}
                    >
                      {loading ? (
                        <>
                          <CSpinner size="sm" className="me-2" />
                          {t('organization.create.loading', {
                            defaultValue: 'Creating Organization...',
                          })}
                        </>
                      ) : (
                        t('organization.create.submit', { defaultValue: 'Create Organization' })
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

export default CreateOrganizationForm
