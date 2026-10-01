import React, { useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked } from '@coreui/icons'
import { GoogleLogin } from '@react-oauth/google'
import { useMsal } from '@azure/msal-react'
import useAuth from '../hooks/useAuth'
import '../styles/_auth.scss'

/**
 * AcceptInviteFormErrorBoundary Component
 * Isolates runtime UI failures on the Accept Invite page.
 */
class AcceptInviteFormErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('AcceptInviteForm Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-error-boundary-container p-4 text-center">
          <h3 className="text-danger">Something went wrong.</h3>
          <p>Please try reloading the page.</p>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Yup validation schema creator with translations.
 */
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\\[\]{};':"\\|,.<>\\/?]).{8,}$/

// Self-contained custom SVG icons for showing/hiding password
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

const createValidationSchema = (t) =>
  yup.object().shape({
    password: yup
      .string()
      .required(t('auth.invite.passwordRequired', 'Password is required'))
      .min(8, t('auth.invite.passwordMinLength', 'Password must be at least 8 characters long'))
      .matches(
        passwordRegex,
        t(
          'auth.invite.passwordStrength',
          'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character',
        ),
      ),
    confirmPassword: yup
      .string()
      .required(t('auth.invite.confirmPasswordRequired', 'Confirm password is required'))
      .oneOf([yup.ref('password')], t('auth.invite.passwordsMustMatch', 'Passwords must match')),
  })

/**
 * AcceptInviteForm Component
 *
 * Clean, modern form for accepting invitations and setting initial account password,
 * as well as accepting invitations via SSO providers (Google & Microsoft).
 * Adheres to the "Thin View" architectural boundary pattern.
 */
export const AcceptInviteForm = () => {
  const { t } = useTranslation()
  const { loading, error, handleAcceptInvitation, handleAcceptSsoInvitation } = useAuth()
  const { token: routeToken } = useParams()
  const [searchParams] = useSearchParams()

  // Extract token from path parameter or search parameter fallback
  const token = routeToken || searchParams.get('token')

  const validationSchema = useMemo(() => createValidationSchema(t), [t])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  // MSAL Instance
  const { instance: msalInstance } = useMsal()

  // Microsoft Login Popup Action
  const handleMicrosoftInvite = () => {
    msalInstance
      .loginPopup({
        scopes: ['openid', 'profile', 'user.read'],
      })
      .then(async (response) => {
        if (response && response.idToken && token) {
          await handleAcceptSsoInvitation(token, response.idToken, 'microsoft')
        }
      })
      .catch((err) => {
        console.error('Microsoft login failed:', err)
      })
  }

  const onSubmit = async (data) => {
    try {
      await handleAcceptInvitation(token || '', data.password)
    } catch (err) {
      console.warn('Accept invite error:', err)
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  return (
    <CCard className="accept-invite-card border-0">
      <CCardBody className="p-0">
        <h1 className="accept-invite-title">{t('auth.invite.title', 'Workspace Invitation')}</h1>
        <p className="accept-invite-subtitle">
          {t('auth.invite.subtitle', 'Accept your invitation using SSO or set up a password.')}
        </p>

        {error && (
          <CAlert color="danger" className="mb-4">
            {error}
          </CAlert>
        )}

        {/* Password Fallback Flow */}
        <CForm onSubmit={handleSubmit(onSubmit)}>
          <CInputGroup className="mb-3 position-relative">
            <CInputGroupText className="accept-invite-input-icon border-0">
              <CIcon icon={cilLockLocked} />
            </CInputGroupText>
            <CFormInput
              type={showPassword ? 'text' : 'password'}
              className="accept-invite-input border-0 pe-5"
              placeholder={t('auth.invite.password', 'Password')}
              autoComplete="new-password"
              disabled={loading}
              invalid={!!errors.password}
              {...register('password')}
            />
            <button
              type="button"
              className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent text-secondary opacity-75 pe-3"
              onClick={() => setShowPassword(!showPassword)}
              style={{ zIndex: 10 }}
            >
              {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
            {errors.password && (
              <div className="invalid-feedback text-danger small mt-1">
                {errors.password.message}
              </div>
            )}
          </CInputGroup>

          <CInputGroup className="mb-4 position-relative">
            <CInputGroupText className="accept-invite-input-icon border-0">
              <CIcon icon={cilLockLocked} />
            </CInputGroupText>
            <CFormInput
              type={showConfirmPassword ? 'text' : 'password'}
              className="accept-invite-input border-0 pe-5"
              placeholder={t('auth.invite.confirmPassword', 'Confirm Password')}
              autoComplete="new-password"
              disabled={loading}
              invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="position-absolute end-0 top-50 translate-middle-y border-0 bg-transparent text-secondary opacity-75 pe-3"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{ zIndex: 10 }}
            >
              {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
            </button>
            {errors.confirmPassword && (
              <div className="invalid-feedback text-danger small mt-1">
                {errors.confirmPassword.message}
              </div>
            )}
          </CInputGroup>

          <CRow>
            <CCol xs={12} className="d-grid mb-3">
              <CButton type="submit" className="accept-invite-btn border-0 py-2" disabled={loading}>
                {loading ? (
                  <CSpinner size="sm" variant="grow" />
                ) : (
                  t('auth.invite.submit', 'Set Password & Accept')
                )}
              </CButton>
            </CCol>
          </CRow>
        </CForm>

        <div className="login-divider mb-3">
          <div className="login-divider-line"></div>
          <span className="login-divider-text">{t('auth.invite.or', 'or')}</span>
          <div className="login-divider-line"></div>
        </div>

        {/* Enterprise SSO Invitation Acceptance */}
        <div className="accept-invite-sso-container">
          <div className="d-flex justify-content-center w-100 mb-2">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                if (token && credentialResponse.credential) {
                  await handleAcceptSsoInvitation(token, credentialResponse.credential, 'google')
                }
              }}
              onError={() => console.error('Google Sign-In failed')}
              type="standard"
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
              width="320px"
            />
          </div>

          <button
            type="button"
            className="accept-invite-sso-btn"
            onClick={handleMicrosoftInvite}
            disabled={loading}
          >
            {/* Microsoft Icon SVG */}
            <svg
              style={{ width: '20px', height: '20px', flexShrink: 0 }}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 23 23"
            >
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            {t('auth.invite.continueWithMicrosoft', 'Continue with Microsoft')}
          </button>
        </div>

        <div className="text-center mt-3">
          <Link to="/login" className="accept-invite-link">
            {t('auth.invite.backToLogin', 'Back to Login')}
          </Link>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default function AcceptInviteFormWithBoundary(props) {
  return (
    <AcceptInviteFormErrorBoundary>
      <AcceptInviteForm {...props} />
    </AcceptInviteFormErrorBoundary>
  )
}
