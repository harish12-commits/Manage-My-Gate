import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import useAuthRouting from '../hooks/useAuthRouting.js'
import useAuth from '../hooks/useAuth.js'
import { GoogleLogin } from '@react-oauth/google'
import { useMsal } from '@azure/msal-react'
import PhoneInput from 'react-phone-input-2'
import 'react-phone-input-2/lib/style.css'
import {
  CButton,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CCol,
  CAlert,
  CSpinner,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser, cilPhone, cilEnvelopeOpen } from '@coreui/icons'

/**
 * RegisterForm Component
 * Refactored to support SSO and strong password validations.
 * Adheres to the "Thin View" architectural pattern.
 */
export const RegisterForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isLoginModeParam = location.pathname === '/login-createOrg'
  const [isLoginMode, setIsLoginMode] = useState(isLoginModeParam)
  const [isOtpMode, setIsOtpMode] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  const isGoogleSso = location.state?.isGoogleSso || false
  const ssoEmail = location.state?.email || ''
  const ssoName = location.state?.name || ''

  const {
    loading,
    error,
    successMsg,
    login,
    register: authRegister,
    verifyRegistration,
    loginGoogle,
    loginMicrosoft,
    clearStatus,
  } = useAuth()
  const { handlePostAuthRedirect, isAuthenticated } = useAuthRouting()

  const [expectedPhoneLength, setExpectedPhoneLength] = useState(12) // Default for India (91 + 10 digits)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    clearErrors,
    control,
    getValues,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: {
      name: ssoName,
      email: ssoEmail,
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  // Watch fields for logic
  const watchEmail = watch('email', '')
  const watchPassword = watch('password', '')
  const watchPhone = watch('phone', '')

  useEffect(() => {
    clearStatus()
  }, [isLoginMode])

  // Sync mode and form state with the active URL path
  useEffect(() => {
    setIsLoginMode(location.pathname === '/login-createOrg')
    setValue('password', '')
    setValue('confirmPassword', '')
    clearErrors()
  }, [location.pathname])

  // When changing mode, navigate to the correct onboarding route
  const toggleMode = () => {
    const domEmail = document.querySelector('input[name="email"]')?.value || ''
    const domPassword = document.querySelector('input[name="password"]')?.value || ''

    const currentEmail = getValues('email') || domEmail || ''
    const currentPassword = getValues('password') || domPassword || ''

    const emailParam = currentEmail ? `&email=${encodeURIComponent(currentEmail.trim())}` : ''
    const passwordParam = currentPassword
      ? `&password=${encodeURIComponent(currentPassword.trim())}`
      : ''
    if (isLoginMode) {
      sessionStorage.removeItem('auth_intent')
      navigate('/register', { state: location.state })
    } else {
      sessionStorage.setItem('auth_intent', 'create-org')
      navigate(`/login?intent=create-org${emailParam}${passwordParam}`, {
        state: {
          ...location.state,
          email: currentEmail.trim(),
          password: currentPassword,
          intent: 'create-org',
        },
      })
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      handlePostAuthRedirect()
    }
  }, [isAuthenticated])

  const { instance: msalInstance } = useMsal()

  const handleMicrosoftLogin = () => {
    import('react-hot-toast').then(({ toast }) => {
      msalInstance
        .loginPopup({
          scopes: ['openid', 'profile', 'user.read'],
        })
        .then((response) => {
          if (response && response.idToken) {
            navigate('/workspace-setup?intent=sso-register', {
              state: {
                ssoToken: response.idToken,
                provider: 'microsoft',
                email: response.account?.username,
                name: response.account?.name,
              },
            })
          }
        })
        .catch((err) => {
          console.error('Microsoft login failed:', err)
          if (
            err.errorCode === 'interaction_in_progress' ||
            (err.message && err.message.includes('interaction_in_progress'))
          ) {
            sessionStorage.clear()
            toast.error('Stuck Microsoft session cleared! Please click the button one more time.')
          } else {
            toast.error(`Microsoft login failed: ${err.message || 'Unknown error'}`)
          }
        })
    })
  }

  const onSubmit = (data) => {
    if (isLoginMode) {
      login({ login: data.email.trim(), password: data.password })
    } else {
      const emailPrefix = data.email
        .trim()
        .split('@')[0]
        .replace(/[^a-zA-Z0-9]/g, '')
      let derivedUsername = emailPrefix
      if (derivedUsername.length < 3) {
        derivedUsername = 'user' + Math.floor(100 + Math.random() * 900)
      } else if (derivedUsername.length > 30) {
        derivedUsername = derivedUsername.substring(0, 30)
      }

      authRegister({
        name: data.name.trim(),
        username: derivedUsername,
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() ? `+${data.phone.trim()}` : undefined,
        password: data.password,
        isGoogleSso,
      }).then((action) => {
        if (action.meta.requestStatus === 'fulfilled') {
          setValue('otp', '')
          setIsOtpMode(true)
          setOtpEmail(data.email.trim().toLowerCase())
        }
      })
    }
  }

  const onVerifyOtp = (data) => {
    verifyRegistration(otpEmail, data.otp).then((res) => {
      if (res.success) {
        setTimeout(() => {
          navigate('/workspace-setup?intent=create')
        }, 1500)
      }
    })
  }

  // Password Strength Calculation
  const getPasswordStrength = (pass) => {
    let score = 0
    if (!pass) return { score: 0, color: 'danger', label: 'Weak' }
    if (pass.length >= 8) score += 25
    if (/[A-Z]/.test(pass)) score += 25
    if (/[a-z]/.test(pass)) score += 25
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 25

    if (score < 50) return { score, color: 'danger', label: 'Weak' }
    if (score < 100) return { score, color: 'warning', label: 'Fair' }
    return { score, color: 'success', label: 'Strong' }
  }

  const strength = getPasswordStrength(watchPassword)

  return (
    <CCard style={styles.card}>
      <CCardBody style={styles.cardBody}>
        {/* Top Section Info Alert */}
        <CAlert color="info" style={styles.alertHeader}>
          <h5 className="alert-heading fw-semibold">
            {t('auth.register.alertTitle', { defaultValue: 'Enterprise Workspace Platform' })}
          </h5>
          <p className="mb-0">
            {t('auth.register.alertText', {
              defaultValue:
                'Create an account to access the platform and set up your secure organization workspace.',
            })}
          </p>
        </CAlert>

        <h1 style={styles.title}>
          {isLoginMode
            ? t('auth.register.loginTitle', { defaultValue: 'Log In to Your Account' })
            : t('auth.register.title', { defaultValue: 'Register' })}
        </h1>
        <p style={styles.subtitle}>
          {isLoginMode
            ? t('auth.register.loginSubtitle', { defaultValue: 'Access the platform securely' })
            : t('auth.register.subtitle', { defaultValue: 'Create your enterprise account' })}
        </p>

        {error && (
          <CAlert color="danger" style={styles.alert}>
            <div>{error}</div>
            {typeof error === 'string' && error.toLowerCase().includes('already exists') && (
              <div className="mt-2 pt-2 border-top border-danger-subtle">
                <CButton
                  color="link"
                  className="p-0 text-danger text-decoration-underline fw-semibold small"
                  onClick={toggleMode}
                >
                  {t('auth.register.userExistsSignInPrompt', {
                    defaultValue:
                      'Already have an account? Sign in to create another organisation under your account',
                  })}
                </CButton>
              </div>
            )}
          </CAlert>
        )}

        {successMsg && (
          <CAlert color="success" style={styles.alert}>
            {successMsg}
          </CAlert>
        )}

        {/* Form Registration OR OTP Verification */}
        {isOtpMode ? (
          <CForm key="otp-verification-form" onSubmit={handleSubmit(onVerifyOtp)} autoComplete="off">
            {/* Fake fields to prevent browser autofill on OTP screen */}
            <input type="text" name="fake_email_autofill" style={{ opacity: 0, position: 'absolute', zIndex: -1, width: 0, height: 0 }} tabIndex="-1" aria-hidden="true" autoComplete="off" />

            <CAlert color="info" className="mb-3">
              We sent a verification code to <strong>{otpEmail}</strong>. Please enter it below to
              activate your account.
            </CAlert>
            <div className="mb-3">
              <CInputGroup>
                <CInputGroupText style={styles.inputIconText}>
                  <CIcon icon={cilLockLocked} style={styles.icon} />
                </CInputGroupText>
                <CFormInput
                  key="otp-numeric-code-input"
                  style={styles.input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t('auth.register.otpPlaceholder', {
                    defaultValue: 'Enter 6-digit code',
                  })}
                  disabled={loading}
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  {...register('otp', {
                    required: t('auth.register.otpRequired', { defaultValue: 'OTP is required.' }),
                    pattern: {
                      value: /^\d{6}$/,
                      message: t('auth.register.otpInvalid', {
                        defaultValue: 'OTP must be exactly 6 digits.',
                      }),
                    },
                  })}
                />
              </CInputGroup>
              {errors.otp && (
                <div className="text-danger small mt-1 ms-1">{errors.otp.message}</div>
              )}
            </div>
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
                  ) : (
                    t('auth.register.verifySubmit', { defaultValue: 'Verify Account' })
                  )}
                </CButton>
              </CCol>
            </CRow>
            <div className="text-center mt-2">
              <CButton
                color="link"
                className="px-0 text-muted text-decoration-none"
                onClick={() => {
                  setIsOtpMode(false)
                  setValue('otp', '')
                }}
              >
                {t('auth.register.backToRegister', { defaultValue: 'Back to Registration' })}
              </CButton>
            </div>
          </CForm>
        ) : (
          <CForm onSubmit={handleSubmit(onSubmit)}>
            {/* Full Name */}
            {!isLoginMode && (
              <div className="mb-3">
                <CInputGroup>
                  <CInputGroupText style={styles.inputIconText}>
                    <CIcon icon={cilUser} style={styles.icon} />
                  </CInputGroupText>
                  <CFormInput
                    style={styles.input}
                    placeholder={t('auth.register.fullNamePlaceholder', {
                      defaultValue: 'Full Name',
                    })}
                    autoComplete="name"
                    disabled={loading}
                    {...register('name', {
                      required:
                        !isLoginMode &&
                        t('auth.register.nameRequired', { defaultValue: 'Full Name is required.' }),
                    })}
                  />
                </CInputGroup>
                {errors.name && (
                  <div className="text-danger small mt-1 ms-1">{errors.name.message}</div>
                )}
              </div>
            )}

            {/* Email */}
            <div className="mb-3">
              <CInputGroup>
                <CInputGroupText style={styles.inputIconText}>
                  <CIcon icon={cilEnvelopeOpen} style={styles.icon} />
                </CInputGroupText>
                <CFormInput
                  style={
                    isGoogleSso
                      ? { ...styles.input, backgroundColor: '#f9fafb', color: '#6b7280' }
                      : styles.input
                  }
                  type="email"
                  placeholder={t('auth.register.emailPlaceholder', { defaultValue: 'Email' })}
                  autoComplete="email"
                  disabled={loading}
                  readOnly={isGoogleSso}
                  {...register('email', {
                    required: t('auth.register.emailRequired', {
                      defaultValue: 'Email address is required.',
                    }),
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: t('auth.register.emailInvalid', {
                        defaultValue: 'Invalid email address.',
                      }),
                    },
                  })}
                />
              </CInputGroup>
              {isGoogleSso && (
                <div className="text-success small mt-1 ms-1 fw-medium d-flex align-items-center">
                  <CIcon icon={cilLockLocked} size="sm" className="me-1" />
                  Verified via Google
                </div>
              )}
              {errors.email && (
                <div className="text-danger small mt-1 ms-1">{errors.email.message}</div>
              )}
            </div>

            {/* Phone */}
            {!isLoginMode && (
              <div className="mb-3">
                <Controller
                  name="phone"
                  control={control}
                  rules={{
                    required: t('auth.register.phoneRequired', {
                      defaultValue: 'Phone number is required.',
                    }),
                    validate: (value) => {
                      if (!value) return true
                      if (value.length < expectedPhoneLength) {
                        return t('auth.register.phoneInvalid', {
                          defaultValue: 'Invalid phone number length for this country.',
                        })
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
                      containerStyle={{
                        width: '100%',
                      }}
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
                      disabled={loading}
                    />
                  )}
                />
                {errors.phone && (
                  <div className="text-danger small mt-1 ms-1">{errors.phone.message}</div>
                )}
              </div>
            )}

            {/* Password */}
            <div className="mb-3">
              <CInputGroup>
                <CInputGroupText style={styles.inputIconText}>
                  <CIcon icon={cilLockLocked} style={styles.icon} />
                </CInputGroupText>
                <CFormInput
                  style={styles.input}
                  type="password"
                  placeholder={t('auth.register.passwordPlaceholder', { defaultValue: 'Password' })}
                  autoComplete="new-password"
                  disabled={loading}
                  {...register('password', {
                    required: t('auth.register.passwordRequired', {
                      defaultValue: 'Password is required.',
                    }),
                    validate: (value) => {
                      if (isLoginMode) return true
                      if (value.length < 8) return 'Password must be at least 8 characters long.'
                      if (!/[A-Z]/.test(value))
                        return 'Password must contain at least one uppercase letter.'
                      if (!/[a-z]/.test(value))
                        return 'Password must contain at least one lowercase letter.'
                      if (!/[0-9]/.test(value)) return 'Password must contain at least one number.'
                      if (!/[^A-Za-z0-9]/.test(value))
                        return 'Password must contain at least one special character.'
                      return true
                    },
                  })}
                />
              </CInputGroup>
              {errors.password && (
                <div className="text-danger small mt-1 ms-1">{errors.password.message}</div>
              )}
              {!isLoginMode && watchPassword && (
                <div className="mt-2 ms-1">
                  <CProgress
                    value={strength.score}
                    color={strength.color}
                    height={6}
                    className="mb-1 rounded"
                  />
                  <div className="small text-muted d-flex justify-content-between">
                    <span>
                      Password strength:{' '}
                      <strong className={`text-${strength.color}`}>{strength.label}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            {!isLoginMode && (
              <div className="mb-4">
                <CInputGroup>
                  <CInputGroupText style={styles.inputIconText}>
                    <CIcon icon={cilLockLocked} style={styles.icon} />
                  </CInputGroupText>
                  <CFormInput
                    style={styles.input}
                    type="password"
                    placeholder={t('auth.register.confirmPasswordPlaceholder', {
                      defaultValue: 'Repeat password',
                    })}
                    autoComplete="new-password"
                    disabled={loading}
                    {...register('confirmPassword', {
                      required:
                        !isLoginMode &&
                        t('auth.register.confirmPasswordRequired', {
                          defaultValue: 'Please repeat your password.',
                        }),
                      validate: (value, formValues) =>
                        isLoginMode ||
                        value === formValues.password ||
                        t('auth.register.passwordsMustMatch', {
                          defaultValue: 'Passwords do not match.',
                        }),
                    })}
                  />
                </CInputGroup>
                {errors.confirmPassword && (
                  <div className="text-danger small mt-1 ms-1">
                    {errors.confirmPassword.message}
                  </div>
                )}
              </div>
            )}

            {!isLoginMode && (
              <div className="mb-3 text-center">
                <span className="small text-secondary">
                  By creating an account, you agree to our{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-decoration-underline fw-semibold"
                  >
                    Terms &amp; Conditions
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-decoration-underline fw-semibold"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </div>
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
                  ) : isLoginMode ? (
                    t('auth.register.loginSubmit', { defaultValue: 'Log In' })
                  ) : (
                    t('auth.register.submit', { defaultValue: 'Create Account' })
                  )}
                </CButton>
              </CCol>
            </CRow>
          </CForm>
        )}

        {!isLoginMode && !isOtpMode && (
          <div style={styles.dividerContainer}>
            <div style={styles.dividerLine}></div>
            <span style={styles.dividerText}>OR</span>
            <div style={styles.dividerLine}></div>
          </div>
        )}

        {/* Enterprise SSO Registration */}
        {!isLoginMode && (
          <div className="mb-4">
            <CRow className="g-3 align-items-center justify-content-center">
              <CCol xs={12} sm={6} className="d-flex justify-content-center">
                <div style={{ width: '100%', maxWidth: '210px' }}>
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      navigate('/workspace-setup?intent=sso-register', {
                        state: {
                          ssoToken: credentialResponse.credential,
                          provider: 'google',
                          email: ssoEmail,
                          name: ssoName,
                        },
                      })
                    }}
                    onError={() => {
                      console.error('Google Sign-In failed')
                    }}
                    type="standard"
                    theme="outline"
                    size="large"
                    text="signup_with"
                    shape="pill"
                    width="210px"
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
                  Continue with Microsoft
                </CButton>
              </CCol>
            </CRow>
          </div>
        )}

        <div className="text-center mt-2">
          <CButton color="link" onClick={toggleMode} style={styles.toggleLink} className="p-0">
            {isLoginMode
              ? t('auth.login.noAccount', { defaultValue: "Don't have an account? Create an Account" })
              : t('auth.register.loginLink', { defaultValue: 'Already have an account? Sign in' })}
          </CButton>
        </div>
      </CCardBody>
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

export default RegisterForm
