import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import useAuthRouting from '../hooks/useAuthRouting.js'
import useAuth from '../hooks/useAuth.js'
import { loginWithGoogle, acceptInvitation } from '../store/authSlice.js'
import ForgotPasswordModal from './ForgotPasswordModal.jsx'
import { GoogleLogin } from '@react-oauth/google'
import { useMsal } from '@azure/msal-react'
import nahomLogo from '../../../assets/images/nahom_full_logo.png'

const MemoizedGoogleLogin = React.memo(({ onSuccess, onError }) => (
  <GoogleLogin
    onSuccess={onSuccess}
    onError={onError}
    type="standard"
    theme="outline"
    size="large"
    width="220px"
  />
))
MemoizedGoogleLogin.displayName = 'MemoizedGoogleLogin'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import { toast } from 'react-hot-toast'
import {
  CButton,
  CCard,
  CCardBody,
  CCardGroup,
  CCol,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CAlert,
  CSpinner,
  CFormCheck,
  CFormSelect,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilScreenSmartphone } from '@coreui/icons'
import '../styles/_auth.scss'

/**
 * LoginFormErrorBoundary Component
 * Isolates runtime UI crashes in the LoginForm.
 */
class LoginFormErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('LoginForm Error Boundary caught an error:', error, errorInfo)
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
 * Standard Login Form component.
 * Features username/email & password inputs and basic validation.
 * Adheres to the "Thin View" architectural pattern.
 */
export const LoginForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const { handlePostAuthRedirect, isAuthenticated, loading, error } = useAuthRouting()
  const { login, loginMicrosoft, sendOtp, verifyOtp, otpSent, clearStatus } = useAuth()

  const location = useLocation()

  const inviteTokenParam = searchParams.get('invite_token')
  const emailParam = searchParams.get('email') || location.state?.email || ''
  const passwordParam = searchParams.get('password') || location.state?.password || ''
  const intentParam =
    searchParams.get('intent') ||
    location.state?.intent ||
    (window.location.href.includes('intent=create-org')
      ? 'create-org'
      : window.location.href.includes('intent=create')
      ? 'create'
      : null)

  useEffect(() => {
    if (intentParam) {
      sessionStorage.setItem('auth_intent', intentParam)
    }
  }, [intentParam])

  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12) // Default for India (91 + 10 digits)

  const [loginMethod, setLoginMethod] = useState('password') // 'password', 'phone', 'email'
  const [forgotModalVisible, setForgotModalVisible] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('rememberedEmail') !== null)
  const [countryCode, setCountryCode] = useState('+91')
  const [otpTimer, setOtpTimer] = useState(0)

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    setError,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      login: emailParam || localStorage.getItem('rememberedEmail') || '',
      password: passwordParam || '',
    },
  })

  // Explicitly force the values into the form fields after mount.
  // CoreUI components sometimes ignore react-hook-form's defaultValues on initial render, 
  // so we apply a multi-layered approach to guarantee they appear.
  useEffect(() => {
    const loginVal = emailParam || localStorage.getItem('rememberedEmail') || ''
    const passVal = passwordParam || ''
    
    if (loginVal || passVal) {
      reset({ login: loginVal, password: passVal })
      if (emailParam) setLoginMethod('password')

      // Brute-force fallback for UI visual sync
      setTimeout(() => {
        setValue('login', loginVal, { shouldValidate: true })
        setValue('password', passVal, { shouldValidate: true })
        
        const loginInput = document.querySelector('input[name="login"]')
        const passInput = document.querySelector('input[name="password"]')
        if (loginInput && loginVal) loginInput.value = loginVal
        if (passInput && passVal) passInput.value = passVal
      }, 50)
    }
  }, [emailParam, passwordParam, reset, setValue])

  // Automatically handle routing updates post-authentication
  const inviteAcceptedRef = useRef(false)
  useEffect(() => {
    if (isAuthenticated) {
      if (inviteTokenParam && !inviteAcceptedRef.current) {
        inviteAcceptedRef.current = true
        dispatch(acceptInvitation({ token: inviteTokenParam }))
          .unwrap()
          .then(() => {
            toast.success('Workspace invitation accepted!')
            navigate('/dashboard', { replace: true })
          })
          .catch((err) => {
            console.warn('Invite token processing:', err)
            handlePostAuthRedirect()
          })
      } else {
        handlePostAuthRedirect()
      }
    }
  }, [isAuthenticated, inviteTokenParam])

  // Handle OTP countdown timer
  useEffect(() => {
    let interval = null
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [otpTimer])

  const { instance: msalInstance } = useMsal()

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      try {
        const response = await dispatch(
          loginWithGoogle({ token: credentialResponse.credential, inviteToken: inviteTokenParam }),
        ).unwrap()

        if (response.data?.isNewUser) {
          navigate('/register', {
            state: {
              email: response.data.googleData.email,
              name: response.data.googleData.name,
              isGoogleSso: true,
            },
          })
        } else {
          handlePostAuthRedirect()
        }
      } catch (err) {
        toast.error(err || 'Failed to verify Google account')
      }
    },
    [dispatch, inviteTokenParam, navigate, handlePostAuthRedirect],
  )

  const handleGoogleError = useCallback(() => {
    toast.error('Google Sign-In failed')
  }, [])
  const { instance: msalInstanceObj, accounts, inProgress } = useMsal()

  const handleMicrosoftLogin = () => {
    let retries = 0
    const triggerLogin = () => {
      msalInstanceObj
        .loginPopup({
          scopes: ['openid', 'profile', 'user.read'],
        })
        .then(async (response) => {
          if (!response) {
            toast.error('MSAL returned an empty response.')
            return
          }
          if (!response.idToken && !response.accessToken) {
            toast.error('MSAL succeeded but no tokens were found in the response.')
            return
          }
          
          const tokenToUse = response.idToken || response.accessToken
          const res = await loginMicrosoft(tokenToUse, inviteTokenParam)
          if (!res.success) {
            const errorMessage = typeof res.error === 'string' ? res.error : (res.error?.message || 'Microsoft login failed on server.')
            toast.error(errorMessage)
          }
        })
        .catch((err) => {
          console.error('Microsoft login failed:', err)
          if (
            (err.errorCode === 'interaction_in_progress' ||
              (err.message && err.message.includes('interaction_in_progress'))) &&
            retries < 3
          ) {
            retries++
            localStorage.removeItem('msal.interaction.status')
            triggerLogin()
          } else {
            toast.error('Microsoft Error: ' + (err.message || 'Unknown error. Check Azure SPA settings.'))
          }
        })
    }

    triggerLogin()
  }

  const handleSendOtp = async (identifier, isEmail) => {
    const resultAction = await sendOtp(identifier, isEmail)
    if (resultAction.meta.requestStatus === 'fulfilled') {
      setOtpTimer(60)
      toast.success(t('auth.login.otpSent', 'OTP sent successfully!'))
    } else {
      toast.error(resultAction.payload || t('auth.login.otpFailed', 'Failed to send OTP'))
    }
  }

  const onSubmit = async (data) => {
    if (loginMethod === 'password') {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', data.login.trim())
      } else {
        localStorage.removeItem('rememberedEmail')
      }
      
      try {
        const res = await login({
          login: data.login.trim(),
          password: data.password,
          inviteToken: inviteTokenParam || undefined,
        })
        
        if (res?.success) {
          if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials?.store) {
            try {
              const cred = new window.PasswordCredential({
                id: data.login.trim(),
                password: data.password,
                name: data.login.trim(),
              })
              await navigator.credentials.store(cred)
            } catch (credErr) {
              // Non-blocking fallback for browsers/environments where credential store is restricted
            }
          }
          if (inviteTokenParam) {
            inviteAcceptedRef.current = true
          }
          handlePostAuthRedirect()
        } else if (res?.error) {
          const backendErrorMessage = typeof res.error === 'string' ? res.error : (res.error?.message || 'Login failed')
          const lowerError = backendErrorMessage.toLowerCase()
          
          if (lowerError.includes('not found') || lowerError.includes('invalid') || lowerError.includes('credential')) {
            setError('login', { type: 'server', message: backendErrorMessage })
          }
        }
      } catch (err) {
        setError('login', { type: 'server', message: err?.message || 'An unexpected error occurred' })
      }
    } else {
      const isEmail = loginMethod === 'email'
      const identifier =
        loginMethod === 'phone' ? `+${(data.phone || '').trim()}` : (data.login || '').trim()

      if (!otpSent) {
        await handleSendOtp(identifier, isEmail)
      } else {
        const res = await verifyOtp(identifier, otpCode, isEmail)
        if (res?.success) {
          handlePostAuthRedirect()
        }
      }
    }
  }

  return (
    <CCard style={styles.card}>
      <CCardBody style={styles.cardBody}>
        {/* Top Section Info Alert */}
        <CAlert color="info" style={styles.alertHeader}>
          <h5 className="alert-heading fw-semibold">
            {t('auth.login.promoTitle', 'Enterprise Workspace Platform')}
          </h5>
          <p className="mb-0">
            {t('auth.login.promoText', 'Access your secure organization workspace, manage team privileges, configure third-party API integrations, and view full audit records in one unified dashboard.')}
          </p>
        </CAlert>

        <CForm onSubmit={handleSubmit(onSubmit)}>
          <div style={styles.logoContainer}>
            <img
              src={nahomLogo}
              alt="NAHOM"
              style={styles.brandLogo}
            />
          </div>

          <h1 style={styles.title}>{t('auth.login.title', 'Welcome Back')}</h1>
          <p style={styles.subtitle}>
            {t('auth.login.subtitle', 'Choose your preferred sign-in method.')}
          </p>

          <div className="login-method-toggle mb-4">
            <button
              type="button"
              className={`login-method-tab ${loginMethod === 'password' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('password')
                clearStatus()
                setOtpTimer(0)
                setOtpCode('')
                setValue('login', localStorage.getItem('rememberedEmail') || '')
                setValue('phone', '')
                clearErrors()
              }}
            >
              {t('auth.login.passwordTab', 'Password Login')}
            </button>
            <button
              type="button"
              className={`login-method-tab ${loginMethod === 'phone' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('phone')
                clearStatus()
                setOtpTimer(0)
                setOtpCode('')
                setValue('login', '')
                setValue('phone', '')
                clearErrors()
              }}
            >
              {t('auth.login.mobileTab', 'Mobile Login')}
            </button>
            <button
              type="button"
              className={`login-method-tab ${loginMethod === 'email' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('email')
                clearStatus()
                setOtpTimer(0)
                setOtpCode('')
                setValue('login', '')
                setValue('phone', '')
                clearErrors()
              }}
            >
              {t('auth.login.emailOtpTab', 'Email OTP')}
            </button>
          </div>

          {error && (
            <CAlert color="danger" style={styles.alert}>
              {error}
            </CAlert>
          )}

          <div className="mb-3">
            {loginMethod === 'phone' ? (
              <>
                <Controller
                  name="phone"
                  control={control}
                  rules={{
                    required: t('auth.login.phoneRequired', 'Phone number is required.'),
                    validate: (value) => {
                      if (!value) return true
                      if (value.length < expectedPhoneLength) {
                        return t(
                          'auth.login.phoneInvalid',
                          'Invalid phone number length for this country.',
                        )
                      }
                      return true
                    },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <PhoneInput
                      country={'in'}
                      value={value}
                      onChange={(phone, country) => {
                        if (country && country.format) {
                          setExpectedPhoneLength(country.format.replace(/[^.]/g, '').length)
                        }
                        onChange(phone)
                      }}
                      containerStyle={{ width: '100%' }}
                      inputStyle={{
                        width: '100%',
                        height: '42px',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '14px',
                      }}
                      buttonStyle={{
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem 0 0 0.375rem',
                        backgroundColor: '#f3f4f6',
                      }}
                      disabled={loading || otpSent}
                    />
                  )}
                />
                {errors.phone && (
                  <div className="text-danger small mt-1 ms-1">{errors.phone.message}</div>
                )}
              </>
            ) : (
              <>
                <CInputGroup>
                  <CInputGroupText style={styles.inputIconText}>
                    <CIcon icon={cilUser} style={styles.icon} />
                  </CInputGroupText>
                  <CFormInput
                    id="username"
                    style={styles.input}
                    placeholder={
                      loginMethod === 'password'
                        ? t('auth.login.usernamePlaceholder', 'Email Address')
                        : t('auth.login.emailPlaceholder', 'Email Address')
                    }
                    autoComplete="username"
                    aria-label={
                      loginMethod === 'password'
                        ? t('auth.login.usernamePlaceholder', 'Email Address')
                        : t('auth.login.emailPlaceholder', 'Email Address')
                    }
                    disabled={loading || otpSent}
                    autoFocus
                    maxLength={255}
                    {...register('login', {
                      required: t('auth.login.loginRequired', 'Email is required.'),
                      maxLength: {
                        value: 255,
                        message: t('auth.login.emailMaxLength', 'Email cannot exceed 255 characters'),
                      },
                      pattern: {
                        value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                        message: t('auth.login.emailInvalidFormat', 'Please enter a valid email address format'),
                      },
                    })}
                  />
                </CInputGroup>
                {errors.login && (
                  <div className="text-danger small mt-1 ms-1">{errors.login.message}</div>
                )}
              </>
            )}
          </div>

          {loginMethod === 'password' && (
            <div className="mb-4">
              <CInputGroup>
                <CInputGroupText style={styles.inputIconText}>
                  <CIcon icon={cilLockLocked} style={styles.icon} />
                </CInputGroupText>
                <CFormInput
                  id="password"
                  style={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.login.passwordPlaceholder', 'Password')}
                  autoComplete="current-password"
                  aria-label={t('auth.login.passwordPlaceholder', 'Password')}
                  disabled={loading}
                  {...register('password', {
                    required:
                      loginMethod === 'password'
                        ? t('auth.login.passwordRequired', 'Password is required.')
                        : false,
                    minLength:
                      loginMethod === 'password'
                        ? {
                            value: 6,
                            message: t(
                              'auth.login.passwordLength',
                              'Password must be at least 6 characters long.',
                            ),
                          }
                        : undefined,
                  })}
                />
                <CInputGroupText
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    cursor: 'pointer',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    color: '#6b7280',
                    fontSize: '13px',
                  }}
                >
                  {showPassword ? t('auth.login.hide', 'Hide') : t('auth.login.show', 'Show')}
                </CInputGroupText>
              </CInputGroup>
              {errors.password && (
                <div className="text-danger small mt-1 ms-1">{errors.password.message}</div>
              )}
            </div>
          )}

          {loginMethod !== 'password' && otpSent && (
            <div className="mb-4">
              <CInputGroup>
                <CInputGroupText style={styles.inputIconText}>OTP</CInputGroupText>
                <CFormInput
                  style={styles.input}
                  placeholder={t('auth.login.otpPlaceholder', 'Enter 6-digit Code')}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={loading}
                  required
                />
              </CInputGroup>
              <div className="text-end mt-2">
                <CButton
                  color="link"
                  className="px-0 small text-muted text-decoration-none"
                  disabled={loading || otpTimer > 0}
                  onClick={() => {
                    const isEmail = loginMethod === 'email'
                    const identifier =
                      loginMethod === 'phone'
                        ? `+${(watch('phone') || '').trim()}`
                        : (watch('login') || '').trim()
                    handleSendOtp(identifier, isEmail)
                  }}
                >
                  {otpTimer > 0
                    ? `${t('auth.login.resendOtpIn', 'Resend OTP in')} ${otpTimer}s`
                    : t('auth.login.resendOtp', 'Resend OTP')}
                </CButton>
              </div>
            </div>
          )}

          {loginMethod === 'password' && (
            <CRow className="mb-3">
              <CCol xs={6}>
                <CFormCheck
                  id="rememberMe"
                  label={t('auth.login.rememberMe', 'Remember Me')}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
              </CCol>
              <CCol xs={6} className="text-end">
                <CButton
                  color="link"
                  className="px-0 text-decoration-none"
                  style={styles.toggleLink}
                  onClick={() => setForgotModalVisible(true)}
                >
                  {t('auth.login.forgotPassword', 'Forgot password?')}
                </CButton>
              </CCol>
            </CRow>
          )}

          <CRow>
            <CCol xs={12} className="d-grid mb-3">
              <CButton
                type="submit"
                color="primary"
                style={styles.submitButton}
                disabled={loading}
              >
                {loading ? (
                  <CSpinner size="sm" variant="grow" />
                ) : loginMethod !== 'password' && !otpSent ? (
                  t('auth.login.sendOtp', 'Send OTP')
                ) : (
                  t('auth.login.submit', 'Sign In')
                )}
              </CButton>
            </CCol>
          </CRow>

          <div style={styles.dividerContainer}>
            <div style={styles.dividerLine}></div>
            <span style={styles.dividerText}>
              {t('auth.login.orContinueWith', 'or continue with')}
            </span>
            <div style={styles.dividerLine}></div>
          </div>

          <CRow className="g-3 align-items-center justify-content-center">
            <CCol xs={12} sm={6} className="d-flex justify-content-center">
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', maxWidth: '210px' }}>
                <MemoizedGoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                />
              </div>
            </CCol>
            <CCol xs={12} sm={6} className="d-flex justify-content-center">
              <CButton
                onClick={handleMicrosoftLogin}
                style={styles.msButton}
                disabled={loading}
                className="w-100"
              >
                <span style={styles.msIcon}>❖</span>
                {t('auth.login.continueWithMicrosoft', 'Continue with Microsoft')}
              </CButton>
            </CCol>
          </CRow>
        </CForm>

        <div className="text-center mt-3">
          <CButton color="link" onClick={() => navigate('/register')} style={styles.toggleLink} className="p-0">
            {t('auth.login.noAccount', "Don't have an account? Create an Account")}
          </CButton>
        </div>
      </CCardBody>

      <ForgotPasswordModal visible={forgotModalVisible} setVisible={setForgotModalVisible} />
    </CCard>
  )
}

const styles = {
  card: {
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    borderRadius: '16px',
    overflow: 'hidden',
    background: '#ffffff',
    border: 'none',
    padding: '24px 16px',
    color: '#1f2937',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  alertHeader: {
    borderRadius: '12px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    color: '#1e3a8a',
    marginBottom: '28px',
    padding: '16px',
  },
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '8px',
    letterSpacing: '-0.025em',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '15px',
    marginBottom: '24px',
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
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
    transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
  },
  toggleLink: {
    color: '#2563eb',
    fontSize: '14px',
    textDecoration: 'none',
    fontWeight: '500',
  },
  dividerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '24px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    padding: '0 12px',
    color: '#9ca3af',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '500',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    marginTop: '6px',
    background: 'transparent',
  },
  brandLogo: {
    height: '92px',
    width: 'auto',
    maxWidth: '220px',
    objectFit: 'contain',
    display: 'block',
    margin: '0 auto',
    filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.05))',
  },
  msButton: {
    background: '#2f2f2f',
    color: '#ffffff',
    border: 'none',
    padding: '9px 16px',
    fontSize: '14px',
    fontWeight: '500',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  msIcon: {
    marginRight: '8px',
    fontSize: '16px',
  },
}

export default function LoginFormWithBoundary(props) {
  return (
    <LoginFormErrorBoundary>
      <LoginForm {...props} />
    </LoginFormErrorBoundary>
  )
}
