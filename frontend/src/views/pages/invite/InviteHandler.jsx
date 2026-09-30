import React, { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CCard,
  CCardBody,
  CContainer,
  CRow,
  CCol,
  CAlert,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSun, cilMoon } from '@coreui/icons'
import useAuth from '../../../features/auth/hooks/useAuth.js'
import ErrorBoundary from '../../../components/ErrorBoundary/ErrorBoundary.jsx'
import { InviteHeader } from '../../../features/auth/components/InviteHeader.jsx'
import { InviteStatusCard } from '../../../features/auth/components/InviteStatusCard.jsx'
import { InviteSignUpForm } from '../../../features/auth/components/InviteSignUpForm.jsx'
import { InviteSignInForm } from '../../../features/auth/components/InviteSignInForm.jsx'
import { InviteSsoButtons } from '../../../features/auth/components/InviteSsoButtons.jsx'
import { InviteMobileHandoffCard } from '../../../features/auth/components/InviteMobileHandoffCard.jsx'
import '../../../features/auth/styles/_auth.scss'
import AppLoader from '../../../components/common/AppLoader'

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.atominosconsulting.nahom'
const APP_STORE_URL = 'https://apps.apple.com/app/manage-my-gate/id6746501635'

const isMobileDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || navigator.vendor || window.opera || ''
  if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())) {
    return true
  }
  // Detect iPads on iOS 13+ reporting MacIntel with multi-touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
}

/**
 * InviteHandlerContent Component
 *
 * Inner view for the canonical workspace invitation landing experience (/invite/:token or /#/invite?token=).
 * Orchestrates token validation, lifecycle-state presentation, tab selection
 * between New User (Sign Up) and Existing User (Sign In), Single Sign-On, and smart mobile handoff.
 */
const InviteHandlerContent = () => {
  const { token: routeToken } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const {
    currentUser,
    isAuthenticated,
    invitation,
    handleValidateInvitation,
    handleAcceptInvitation,
    handleAcceptSsoInvitation,
    handleRejectInvitation,
    handleCreateInviteHandoff,
    handleSwitchWorkspace,
    login,
    loginGoogle,
    loginMicrosoft,
    logout,
  } = useAuth()

  const token = routeToken || searchParams.get('token') || ''
  const validationKeyRef = useRef('')
  const navigationRef = useRef(false)

  // Theme management with CoreUI useColorModes hook & phone night theme detection
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')

  const isDarkActive =
    colorMode === 'dark' ||
    (colorMode !== 'light' &&
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const toggleTheme = () => {
    setColorMode(isDarkActive ? 'light' : 'dark')
  }

  const renderThemeToggle = () => (
    <div className="position-absolute top-0 end-0 p-2 p-sm-3 z-3">
      <button
        type="button"
        className="btn btn-sm btn-outline-light rounded-pill px-2.5 py-1 px-sm-3 py-sm-1.5 d-flex align-items-center gap-1.5 shadow-sm border-light-subtle"
        onClick={toggleTheme}
        title={
          isDarkActive
            ? t('common.switchToLight', 'Switch to light mode')
            : t('common.switchToDark', 'Switch to dark mode')
        }
        aria-label="Toggle theme"
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255, 255, 255, 0.12)' }}
      >
        <CIcon icon={isDarkActive ? cilSun : cilMoon} size="sm" />
        <span className="small fw-semibold">{isDarkActive ? 'Light' : 'Dark'}</span>
      </button>
    </div>
  )

  // Form submission state
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')

  // Mobile handoff state
  const [handoffData, setHandoffData] = useState(null)

  // Active tab state: 'signup' | 'signin'
  const [activeTab, setActiveTab] = useState(() => {
    const requestedMode = (searchParams.get('mode') || searchParams.get('tab') || '').toLowerCase()
    return requestedMode === 'signin' ? 'signin' : 'signup'
  })

  // 1. Trigger invitation token validation or immediate rejection on mount or token change
  useEffect(() => {
    const authIdentity =
      currentUser?.id || currentUser?._id || (isAuthenticated ? 'authenticated' : 'anonymous')
    const validationKey = `${token}:${authIdentity}:${searchParams.get('action') || ''}`
    if (token && validationKeyRef.current !== validationKey) {
      validationKeyRef.current = validationKey
      if (searchParams.get('action') === 'reject') {
        handleRejectInvitation({ token, email: searchParams.get('email') })
      } else {
        handleValidateInvitation(token)
      }
    }
  }, [
    token,
    currentUser?.id,
    currentUser?._id,
    isAuthenticated,
    searchParams,
    handleValidateInvitation,
    handleRejectInvitation,
  ])

  useEffect(() => {
    const data = invitation.data
    if (
      navigationRef.current ||
      !isAuthenticated ||
      data?.state !== 'ALREADY_ACCEPTED' ||
      !data?.orgId
    )
      return
    navigationRef.current = true
    handleSwitchWorkspace(data.orgId).then((result) => {
      if (result.success) navigate('/dashboard', { replace: true })
      else {
        navigationRef.current = false
        setSubmissionError(result.error || 'Unable to activate the invited workspace.')
      }
    })
  }, [invitation.data, isAuthenticated, handleSwitchWorkspace, navigate])

  const inviteData = invitation.data
  const flowState = inviteData?.state
  const isAccountMismatch =
    flowState === 'ACCOUNT_MISMATCH' || flowState === 'ALREADY_ACCEPTED_OTHER_ACCOUNT'
  const effectiveTab =
    isAccountMismatch || flowState === 'ALREADY_ACCEPTED' || inviteData?.isExisting
      ? 'signin'
      : activeTab
  const isLoading = invitation.loading
  const hasError = !token || !invitation.valid || !!invitation.error
  const errorMessage = !token
    ? t('auth.invite.invalidToken', 'No invitation token provided.')
    : invitation.error ||
      t('auth.invite.invalidToken', 'This invitation link is invalid or has expired.')

  // Handler: Tab Switching
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSubmissionError('')
  }

  // Helper: Process mobile handoff or redirect directly to web dashboard based on user device
  const processSuccessfulAcceptance = async () => {
    if (isMobileDevice()) {
      const handoffRes = await handleCreateInviteHandoff({ token })
      if (handoffRes?.success && handoffRes?.data) {
        setHandoffData(handoffRes.data)
        return
      }

      // Universal link / deep-link fallback with store redirect timer
      const isIos =
        /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const universalLink = `${window.location.origin}/invite/handoff/${token}`
      const storeUrl = isIos ? APP_STORE_URL : PLAY_STORE_URL

      const storeTimer = setTimeout(() => {
        window.location.href = storeUrl
      }, 1500)

      const cancelOnHide = () => {
        if (document.hidden) {
          clearTimeout(storeTimer)
          document.removeEventListener('visibilitychange', cancelOnHide)
        }
      }
      document.addEventListener('visibilitychange', cancelOnHide)
      window.location.href = universalLink
      return
    }

    // PC / Desktop Browser: navigate directly to Web Frontend Dashboard
    navigate('/dashboard', { replace: true })
  }

  // Handler: New User Sign Up submission
  const handleSignUpSubmit = async (formData) => {
    setSubmitting(true)
    setSubmissionError('')

    try {
      const result = await handleAcceptInvitation(
        {
          token,
          password: formData.password,
          name: formData.name,
          phone: formData.phone || '',
          email: inviteData?.email,
        },
        null,
        { skipNavigate: true },
      )

      if (!result.success) {
        setSubmissionError(result.error || t('auth.invite.error', 'Failed to activate account.'))
      } else {
        await processSuccessfulAcceptance()
      }
    } catch (err) {
      setSubmissionError(err.message || t('auth.invite.error', 'Failed to activate account.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Existing User Sign In submission
  const handleSignInSubmit = async ({ email, password }) => {
    setSubmitting(true)
    setSubmissionError('')

    try {
      // Step 1: Validate credentials & log user in with inviteToken attached (server activates workspace)
      const loginResult = await login({ login: email, email, password, inviteToken: token })
      if (!loginResult.success) {
        setSubmissionError(
          loginResult.error || t('auth.invite.invalidCredentials', 'Invalid email or password.'),
        )
        setSubmitting(false)
        return
      }

      // Step 2: User is authenticated and workspace membership is active -> proceed to handoff/dashboard
      await processSuccessfulAcceptance()
    } catch (err) {
      setSubmissionError(
        err.message || t('auth.invite.error', 'Failed to sign in and accept invitation.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Authenticated User direct acceptance
  const handleAcceptExistingAuthenticated = async () => {
    setSubmitting(true)
    setSubmissionError('')

    try {
      const result = await handleAcceptInvitation({ token, email: inviteData?.email }, null, {
        skipNavigate: true,
      })
      if (!result.success) {
        setSubmissionError(result.error || t('auth.invite.error', 'Failed to accept invitation.'))
      } else {
        await processSuccessfulAcceptance()
      }
    } catch (err) {
      setSubmissionError(err.message || t('auth.invite.error', 'Failed to accept invitation.'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: SSO Invitation Acceptance / Existing User Sign In
  const handleSsoSuccess = async (ssoCredential, provider) => {
    setSubmitting(true)
    setSubmissionError('')

    try {
      if (effectiveTab === 'signin') {
        // Existing user SSO authentication
        let loginResult
        if (provider === 'google') {
          loginResult = await loginGoogle(ssoCredential, token, { skipNavigate: true })
        } else if (provider === 'microsoft') {
          loginResult = await loginMicrosoft(ssoCredential, token, { skipNavigate: true })
        }
        if (!loginResult?.success) {
          setSubmissionError(
            loginResult?.error ||
              t('auth.invite.ssoError', 'SSO sign-in failed. Please try again.'),
          )
          return
        }
        await processSuccessfulAcceptance()
      } else {
        // New user SSO invitation acceptance
        const result = await handleAcceptSsoInvitation(token, ssoCredential, provider, {
          skipNavigate: true,
        })

        if (!result.success) {
          setSubmissionError(
            result.error || t('auth.invite.error', 'Failed to accept invitation via SSO.'),
          )
        } else {
          await processSuccessfulAcceptance()
        }
      }
    } catch (err) {
      setSubmissionError(
        err.message || t('auth.invite.error', 'Failed to accept invitation via SSO.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Handler: Sign Out & Switch Account
  const handleSignOut = () => {
    logout()
    setSubmissionError('')
  }

  // Handler: Reject / Decline Invitation
  const handleRejectSubmit = async () => {
    setSubmitting(true)
    setSubmissionError('')

    try {
      const result = await handleRejectInvitation({
        token,
        email: inviteData?.email,
      })
      if (!result.success) {
        setSubmissionError(result.error || t('auth.invite.error', 'Failed to decline invitation.'))
      }
    } catch (err) {
      setSubmissionError(err.message || t('auth.invite.error', 'Failed to decline invitation.'))
    } finally {
      setSubmitting(false)
    }
  }

  // 0. Mobile Handoff State (Rendered after successful acceptance on mobile device)
  if (handoffData) {
    return (
      <div className="invite-page-wrapper position-relative">
        {renderThemeToggle()}
        <CContainer>
          <CRow className="justify-content-center">
            <CCol xs={12} className="d-flex justify-content-center">
              <div className="invite-card-container">
                <InviteMobileHandoffCard handoffData={handoffData} orgName={inviteData?.orgName} />
              </div>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="invite-page-wrapper position-relative">
        {renderThemeToggle()}
        <div className="text-center text-white">
          <AppLoader variant="block" />
          <h5 className="fw-semibold">
            {t('auth.invite.validating', 'Validating workspace invitation...')}
          </h5>
        </div>
      </div>
    )
  }

  // 2. Terminal Lifecycle / Validation Error State
  if (hasError) {
    return (
      <div className="invite-page-wrapper position-relative">
        {renderThemeToggle()}
        <CContainer>
          <CRow className="justify-content-center">
            <CCol xs={12} className="d-flex justify-content-center">
              <div className="invite-card-container">
                <InviteStatusCard
                  status={invitation.error || 'INVALID'}
                  errorMessage={errorMessage}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            </CCol>
          </CRow>
        </CContainer>
      </div>
    )
  }

  // 3. Valid Invitation Experience
  return (
    <div className="invite-page-wrapper position-relative">
      {renderThemeToggle()}
      <CContainer fluid="sm" className="px-2 px-sm-3">
        <CRow className="justify-content-center mx-0">
          <CCol xs={12} className="d-flex justify-content-center px-0">
            <div className="invite-card-container">
              <CCard className="invite-card border-0 shadow-lg rounded-4 overflow-hidden">
                {/* Attribution Header */}
                <InviteHeader inviteData={inviteData} />

                <CCardBody className="p-3 p-sm-4 p-md-5">
                  {/* Mobile App Shortcut Banner */}
                  {isMobileDevice() &&
                    (() => {
                      const isIosDevice =
                        /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
                        (typeof navigator !== 'undefined' &&
                          navigator.platform === 'MacIntel' &&
                          navigator.maxTouchPoints > 1)
                      const targetStoreUrl = isIosDevice ? APP_STORE_URL : PLAY_STORE_URL
                      const targetStoreLabel = isIosDevice ? 'App Store' : 'Play Store'

                      return (
                        <div className="p-2.5 p-sm-3 mb-3 rounded-3 bg-primary-subtle text-primary border border-primary-subtle">
                          <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap flex-sm-nowrap">
                            <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
                              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>📱</span>
                              <span className="small fw-semibold text-truncate">
                                {t('auth.invite.haveMobileApp', 'Using a mobile phone?')}
                              </span>
                            </div>
                            <div className="d-flex align-items-center gap-1.5 flex-shrink-0 ms-auto">
                              <a
                                href={`managemygate://accept-invite?token=${token}`}
                                className="btn btn-sm btn-primary fw-semibold px-2.5 py-1 text-white text-decoration-none text-nowrap"
                              >
                                {t('auth.invite.openInApp', 'Open App')}
                              </a>
                              <a
                                href={targetStoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-primary fw-semibold px-2.5 py-1 text-nowrap"
                              >
                                {targetStoreLabel}
                              </a>
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                  {/* Segmented Tab Controls: New User vs Existing User */}
                  <div className="invite-tabs-container">
                    <button
                      type="button"
                      className={`invite-tab-btn ${effectiveTab === 'signup' ? 'active' : ''}`}
                      onClick={() => handleTabChange('signup')}
                      disabled={submitting}
                    >
                      {t('auth.invite.tabSignUp', 'New User (Sign Up)')}
                    </button>
                    <button
                      type="button"
                      className={`invite-tab-btn ${effectiveTab === 'signin' ? 'active' : ''}`}
                      onClick={() => handleTabChange('signin')}
                      disabled={submitting}
                    >
                      {t('auth.invite.tabSignIn', 'Existing User (Sign In)')}
                    </button>
                  </div>

                  {/* Tab 1: New User Sign Up */}
                  {!isAccountMismatch &&
                    flowState !== 'ALREADY_ACCEPTED' &&
                    effectiveTab === 'signup' && (
                      <div>
                        <InviteSignUpForm
                          email={inviteData?.email}
                          token={token}
                          onSubmit={handleSignUpSubmit}
                          submitting={submitting}
                          submissionError={submissionError}
                        />

                        {/* SSO Providers */}
                        <InviteSsoButtons
                          onSsoSuccess={handleSsoSuccess}
                          onSsoError={(errMsg) => setSubmissionError(errMsg)}
                          disabled={submitting}
                        />

                        <div className="text-center mt-4 pt-2 border-top">
                          <small className="text-muted">
                            {t('auth.invite.alreadyHaveAccount', 'Already registered?')}{' '}
                            <button
                              type="button"
                              className="btn btn-link p-0 text-primary fw-semibold text-decoration-none small"
                              onClick={() => handleTabChange('signin')}
                            >
                              {t('auth.invite.signInTabCta', 'Sign In Instead')}
                            </button>
                          </small>
                        </div>
                      </div>
                    )}

                  {/* Tab 2: Existing User Sign In */}
                  {(isAccountMismatch ||
                    flowState === 'ALREADY_ACCEPTED' ||
                    effectiveTab === 'signin') && (
                    <div>
                      <InviteSignInForm
                        email={inviteData?.email}
                        token={token}
                        orgName={inviteData?.orgName}
                        isAuthenticated={isAuthenticated}
                        currentUser={currentUser}
                        onSubmit={handleSignInSubmit}
                        onAcceptExistingAuthenticated={handleAcceptExistingAuthenticated}
                        onSignOut={handleSignOut}
                        submitting={submitting}
                        submissionError={submissionError}
                      />

                      {/* SSO Providers for Existing Users */}
                      <InviteSsoButtons
                        onSsoSuccess={handleSsoSuccess}
                        onSsoError={(errMsg) => setSubmissionError(errMsg)}
                        disabled={submitting}
                      />

                      <div className="text-center mt-4 pt-2 border-top">
                        <small className="text-muted">
                          {t('auth.invite.needNewAccount', 'Need to create an account?')}{' '}
                          <button
                            type="button"
                            className="btn btn-link p-0 text-primary fw-semibold text-decoration-none small"
                            onClick={() => handleTabChange('signup')}
                          >
                            {t('auth.invite.signUpTabCta', 'Sign Up Instead')}
                          </button>
                        </small>
                      </div>
                    </div>
                  )}

                  {/* Option to decline/reject workspace invitation */}
                  <div className="text-center mt-4 pt-3 border-top">
                    <button
                      type="button"
                      className="btn btn-link text-danger text-decoration-none small p-0 fw-medium"
                      onClick={handleRejectSubmit}
                      disabled={submitting}
                    >
                      {t('auth.invite.declineInvitation', 'Decline this invitation')}
                    </button>
                  </div>
                </CCardBody>
              </CCard>
            </div>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

/**
 * Top-Level Export Wrapped in Error Boundary
 */
export const InviteHandler = () => (
  <ErrorBoundary>
    <InviteHandlerContent />
  </ErrorBoundary>
)

export default InviteHandler
