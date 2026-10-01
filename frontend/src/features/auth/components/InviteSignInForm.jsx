import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CSpinner,
  CAlert,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilEnvelopeClosed, cilLockLocked, cilCheckCircle, cilWarning } from '@coreui/icons'

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" />
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
  </svg>
)

const EyeSlashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a18.883 18.883 0 0 0-2.79.223L6.36 3.868C7.458 3.597 8.761 3.5 9 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.7-.7zm-1.802 1.802a8.72 8.72 0 0 1-1.162.721C9.28 14.232 8.704 14.5 8 14.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8c.028-.042.063-.092.109-.151.272-.349.689-.817 1.218-1.348l1.414 1.414A3.5 3.5 0 0 0 8 11.5c.34 0 .668-.05 1.002-.132l1.155 1.155z" />
    <path d="M11.643 14.127L1.393 3.877l-.707.707 1.848 1.848A18.883 18.883 0 0 0 0 8s3 5.5 8 5.5a9.06 9.06 0 0 0 2.737-.418l1.199 1.199.707-.707zM5.337 7.45L8.55 10.662A2.5 2.5 0 0 1 5.337 7.45z" />
    <path d="M12.454 9.638A3.491 3.491 0 0 0 12.5 8a3.5 3.5 0 0 0-7-0c0 .343.05.668.132 1.002L3.93 7.302A3.5 3.5 0 0 1 8 4.5c1.93 0 3.5 1.57 3.5 3.5a3.49 3.49 0 0 1-.132 1.002l1.086 1.336z" />
  </svg>
)

export const InviteSignInForm = ({
  email,
  token,
  orgName,
  isAuthenticated,
  currentUser,
  onSubmit,
  onAcceptExistingAuthenticated,
  onSignOut,
  submitting,
  submissionError,
}) => {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)

  const isEmailMatch =
    isAuthenticated &&
    currentUser &&
    currentUser.email &&
    email &&
    currentUser.email.trim().toLowerCase() === email.trim().toLowerCase()

  const isEmailMismatch =
    isAuthenticated &&
    currentUser &&
    currentUser.email &&
    email &&
    currentUser.email.trim().toLowerCase() !== email.trim().toLowerCase()

  const schema = yup.object().shape({
    password: yup.string().required(t('auth.invite.passwordRequired', 'Password is required')),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { password: '' },
  })

  // Case 1: User is already signed in with matching account
  if (isEmailMatch) {
    return (
      <div className="invite-signin-authenticated text-start">
        {submissionError && (
          <CAlert color="danger" className="mb-3 py-2 small">
            {submissionError}
          </CAlert>
        )}

        <div className="bg-success-subtle border border-success-subtle p-3 rounded-3 mb-4">
          <div className="d-flex align-items-center gap-2 mb-1">
            <CIcon icon={cilCheckCircle} className="text-success" size="lg" />
            <span className="fw-bold text-success">
              {t('auth.invite.signedInAs', 'Signed in as {{name}}', {
                name: currentUser.name || currentUser.username || currentUser.email,
              })}
            </span>
          </div>
          <div className="small text-muted font-monospace">{currentUser.email}</div>
        </div>

        <CButton
          type="button"
          color="success"
          className="w-100 py-2.5 fw-bold text-white rounded-3 shadow-sm mb-3"
          disabled={submitting}
          onClick={() => onAcceptExistingAuthenticated(token)}
        >
          {submitting ? (
            <>
              <CSpinner size="sm" className="me-2" />
              {t('auth.invite.joining', 'Joining Community...')}
            </>
          ) : (
            t('auth.invite.acceptCtaWithOrg', 'Accept Invitation & Join {{org}}', {
              org: orgName || 'Community',
            })
          )}
        </CButton>

        <div className="text-center pt-2 border-top">
          <button
            type="button"
            className="btn btn-link text-decoration-none text-muted small p-0"
            onClick={onSignOut}
          >
            {t('auth.invite.switchAccount', 'Sign in with a different account')}
          </button>
        </div>
      </div>
    )
  }

  // Case 2: User is already signed in with a mismatched account
  if (isEmailMismatch) {
    return (
      <div className="invite-signin-mismatch text-start">
        <CAlert color="warning" className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-1 fw-bold text-warning-emphasis">
            <CIcon icon={cilWarning} />
            {t('auth.invite.identityMismatchTitle', 'Account Mismatch')}
          </div>
          <div className="small">
            {t(
              'auth.invite.identityMismatchDesc',
              'You are currently signed in as {{currentEmail}}, but this invitation was sent to {{invitedEmail}}.',
              { currentEmail: currentUser.email, invitedEmail: email },
            )}
          </div>
        </CAlert>

        <CButton
          type="button"
          color="primary"
          variant="outline"
          className="w-100 py-2 fw-semibold rounded-3 mb-2"
          onClick={onSignOut}
        >
          {t('auth.invite.signOutAndSwitch', 'Sign Out & Continue with {{invitedEmail}}', {
            invitedEmail: email,
          })}
        </CButton>
      </div>
    )
  }

  // Case 3: Standard unauthenticated sign-in
  const onFormSubmit = (data) => {
    onSubmit({
      login: email,
      email,
      password: data.password,
      token,
    })
  }

  return (
    <CForm onSubmit={handleSubmit(onFormSubmit)} className="invite-signin-form text-start">
      {submissionError && (
        <CAlert color="danger" className="mb-3 py-2 small">
          {submissionError}
        </CAlert>
      )}

      {/* Pre-filled Email (Read-Only) */}
      <div className="mb-3">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.emailLabel', 'Email Address')} (
          {t('auth.invite.invitedEmailLocked', 'Verified Invitation Recipient')})
        </label>
        <CInputGroup>
          <CInputGroupText className="bg-light">
            <CIcon icon={cilEnvelopeClosed} />
          </CInputGroupText>
          <CFormInput
            type="email"
            value={email}
            title={email}
            readOnly
            disabled
            className="bg-light text-muted small"
            style={{ minWidth: 0, textOverflow: 'ellipsis' }}
          />
        </CInputGroup>
      </div>

      {/* Password */}
      <div className="mb-4">
        <label className="form-label small fw-semibold text-muted">
          {t('auth.invite.password', 'Password')} *
        </label>
        <CInputGroup className="position-relative">
          <CInputGroupText className="bg-light">
            <CIcon icon={cilLockLocked} />
          </CInputGroupText>
          <CFormInput
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            disabled={submitting}
            invalid={!!errors.password}
            className="pe-5"
            {...register('password')}
          />
          <button
            type="button"
            className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent text-secondary opacity-75 pe-3"
            onClick={() => setShowPassword(!showPassword)}
            style={{ zIndex: 10 }}
            aria-label={
              showPassword
                ? t('common.hidePassword', 'Hide password')
                : t('common.showPassword', 'Show password')
            }
          >
            {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
          </button>
        </CInputGroup>
        {errors.password && <div className="text-danger small mt-1">{errors.password.message}</div>}
      </div>

      <CButton
        type="submit"
        color="primary"
        className="w-100 py-2.5 fw-bold rounded-3 shadow-sm text-white"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <CSpinner size="sm" className="me-2" />
            {t('auth.invite.signingIn', 'Signing In & Joining...')}
          </>
        ) : (
          t('auth.invite.signInAndJoinCta', 'Sign In & Join Community')
        )}
      </CButton>
    </CForm>
  )
}

InviteSignInForm.propTypes = {
  email: PropTypes.string.isRequired,
  token: PropTypes.string.isRequired,
  orgName: PropTypes.string,
  isAuthenticated: PropTypes.bool,
  currentUser: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onAcceptExistingAuthenticated: PropTypes.func.isRequired,
  onSignOut: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  submissionError: PropTypes.string,
}

export default InviteSignInForm
