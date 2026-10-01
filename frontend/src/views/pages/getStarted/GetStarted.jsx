import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import {
  CContainer,
  CRow,
  CCol,
  CCard,
  CCardBody,
  CForm,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CButton,
  CAlert,
  CSpinner,
  CNav,
  CNavItem,
  CNavLink,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import { loginUser, registerUser } from '../../../features/auth/store/authSlice.js'
import useAuthRouting from '../../../features/auth/hooks/useAuthRouting.js'

/**
 * GetStarted View Component
 *
 * Multi-intent Authentication view supporting direct Tab-based toggling
 * between User Signup and Login layout. Matches parameters e.g. intent=create
 * to setup workspaces.
 *
 * Adheres to the "Thin View" architectural pattern.
 */
export const GetStarted = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState('login')

  const { handlePostAuthRedirect, isAuthenticated, loading, error } = useAuthRouting()

  // Redirect automatically on auth success
  useEffect(() => {
    if (isAuthenticated) {
      handlePostAuthRedirect()
    }
  }, [isAuthenticated])

  // Form management for Login
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
  } = useForm({
    defaultValues: { login: '', password: '' },
  })

  // Form management for Signup
  const {
    register: registerSignup,
    handleSubmit: handleSignupSubmit,
    formState: { errors: signupErrors },
  } = useForm({
    defaultValues: { email: '', username: '', name: '', password: '' },
  })

  const onLoginSubmit = (data) => {
    dispatch(loginUser({ login: data.login.trim(), password: data.password }))
  }

  const onSignupSubmit = (data) => {
    dispatch(
      registerUser({
        email: data.email.trim(),
        username: data.username.trim(),
        name: data.name.trim(),
        password: data.password,
      }),
    )
  }

  return (
    <div
      className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center"
      style={{ backgroundColor: '#0b0f19' }}
    >
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6} lg={5}>
            <CCard style={styles.card}>
              <CCardBody style={styles.cardBody}>
                <div className="text-center mb-4">
                  <h2 className="fw-bold text-white mb-1">
                    {t('auth.getStarted.title', { defaultValue: 'Get Started' })}
                  </h2>
                  <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                    {t('auth.getStarted.subtitle', {
                      defaultValue: 'Access your specialized workspace context',
                    })}
                  </p>
                </div>

                {error && (
                  <CAlert color="danger" style={styles.alert}>
                    {error}
                  </CAlert>
                )}

                <CNav
                  variant="pills"
                  layout="justified"
                  className="mb-4 p-1"
                  style={styles.navPills}
                >
                  <CNavItem>
                    <CNavLink
                      active={activeTab === 'login'}
                      onClick={() => setActiveTab('login')}
                      style={activeTab === 'login' ? styles.activeTab : styles.inactiveTab}
                    >
                      {t('auth.getStarted.loginTab', { defaultValue: 'Log In' })}
                    </CNavLink>
                  </CNavItem>
                  <CNavItem>
                    <CNavLink
                      active={activeTab === 'signup'}
                      onClick={() => setActiveTab('signup')}
                      style={activeTab === 'signup' ? styles.activeTab : styles.inactiveTab}
                    >
                      {t('auth.getStarted.signupTab', { defaultValue: 'Sign Up' })}
                    </CNavLink>
                  </CNavItem>
                </CNav>

                {activeTab === 'login' ? (
                  <CForm onSubmit={handleLoginSubmit(onLoginSubmit)}>
                    <div className="mb-3">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>
                          <CIcon icon={cilUser} style={styles.icon} />
                        </CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          placeholder={t('auth.login.usernamePlaceholder', {
                            defaultValue: 'Username or Email',
                          })}
                          disabled={loading}
                          {...registerLogin('login', {
                            required: t('auth.login.loginRequired', {
                              defaultValue: 'Username or Email is required.',
                            }),
                          })}
                        />
                      </CInputGroup>
                      {loginErrors.login && (
                        <div className="text-danger small mt-1 ms-1">
                          {loginErrors.login.message}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>
                          <CIcon icon={cilLockLocked} style={styles.icon} />
                        </CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          type="password"
                          placeholder={t('auth.login.passwordPlaceholder', {
                            defaultValue: 'Password',
                          })}
                          disabled={loading}
                          {...registerLogin('password', {
                            required: t('auth.login.passwordRequired', {
                              defaultValue: 'Password is required.',
                            }),
                            minLength: {
                              value: 6,
                              message: t('auth.login.passwordLength', {
                                defaultValue: 'Password must be at least 6 characters long.',
                              }),
                            },
                          })}
                        />
                      </CInputGroup>
                      {loginErrors.password && (
                        <div className="text-danger small mt-1 ms-1">
                          {loginErrors.password.message}
                        </div>
                      )}
                    </div>

                    <div className="d-grid">
                      <CButton
                        type="submit"
                        color="primary"
                        style={styles.submitButton}
                        disabled={loading}
                      >
                        {loading ? (
                          <CSpinner size="sm" variant="grow" />
                        ) : (
                          t('auth.login.submit', { defaultValue: 'Login' })
                        )}
                      </CButton>
                    </div>
                  </CForm>
                ) : (
                  <CForm onSubmit={handleSignupSubmit(onSignupSubmit)}>
                    <div className="mb-3">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>
                          <CIcon icon={cilUser} style={styles.icon} />
                        </CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          placeholder={t('auth.register.namePlaceholder', {
                            defaultValue: 'Full Name',
                          })}
                          disabled={loading}
                          {...registerSignup('name', {
                            required: t('auth.register.nameRequired', {
                              defaultValue: 'Name is required.',
                            }),
                          })}
                        />
                      </CInputGroup>
                      {signupErrors.name && (
                        <div className="text-danger small mt-1 ms-1">
                          {signupErrors.name.message}
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>@</CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          type="email"
                          placeholder={t('auth.register.emailPlaceholder', {
                            defaultValue: 'Email Address',
                          })}
                          disabled={loading}
                          {...registerSignup('email', {
                            required: t('auth.register.emailRequired', {
                              defaultValue: 'Email is required.',
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
                      {signupErrors.email && (
                        <div className="text-danger small mt-1 ms-1">
                          {signupErrors.email.message}
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>
                          <CIcon icon={cilUser} style={styles.icon} />
                        </CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          placeholder={t('auth.register.usernamePlaceholder', {
                            defaultValue: 'Username',
                          })}
                          disabled={loading}
                          {...registerSignup('username', {
                            required: t('auth.register.usernameRequired', {
                              defaultValue: 'Username is required.',
                            }),
                            minLength: {
                              value: 3,
                              message: t('auth.register.usernameLength', {
                                defaultValue: 'Username must be at least 3 characters.',
                              }),
                            },
                          })}
                        />
                      </CInputGroup>
                      {signupErrors.username && (
                        <div className="text-danger small mt-1 ms-1">
                          {signupErrors.username.message}
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <CInputGroup>
                        <CInputGroupText style={styles.inputIconText}>
                          <CIcon icon={cilLockLocked} style={styles.icon} />
                        </CInputGroupText>
                        <CFormInput
                          style={styles.input}
                          type="password"
                          placeholder={t('auth.register.passwordPlaceholder', {
                            defaultValue: 'Password',
                          })}
                          disabled={loading}
                          {...registerSignup('password', {
                            required: t('auth.register.passwordRequired', {
                              defaultValue: 'Password is required.',
                            }),
                            minLength: {
                              value: 6,
                              message: t('auth.register.passwordLength', {
                                defaultValue: 'Password must be at least 6 characters long.',
                              }),
                            },
                          })}
                        />
                      </CInputGroup>
                      {signupErrors.password && (
                        <div className="text-danger small mt-1 ms-1">
                          {signupErrors.password.message}
                        </div>
                      )}
                    </div>

                    <div className="d-grid">
                      <CButton
                        type="submit"
                        color="primary"
                        style={styles.submitButton}
                        disabled={loading}
                      >
                        {loading ? (
                          <CSpinner size="sm" variant="grow" />
                        ) : (
                          t('auth.register.submit', { defaultValue: 'Create Account' })
                        )}
                      </CButton>
                    </div>
                  </CForm>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

const styles = {
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '24px 12px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    borderRadius: '16px',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  navPills: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
  },
  activeTab: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    color: '#ffffff',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  inactiveTab: {
    color: '#a1a1aa',
    cursor: 'pointer',
    border: 'none',
    fontWeight: '500',
  },
  inputIconText: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#a1a1aa',
    minWidth: '50px',
    justifyContent: 'center',
  },
  icon: {
    width: '18px',
    height: '18px',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#ffffff',
    padding: '12px',
  },
  alert: {
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
  },
  submitButton: {
    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
    border: 'none',
    padding: '12px',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
    transition:
      'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
  },
}

export default GetStarted
