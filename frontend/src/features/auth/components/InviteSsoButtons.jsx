import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { GoogleLogin } from '@react-oauth/google'
import { useMsal } from '@azure/msal-react'
import { CButton } from '@coreui/react'

/**
 * InviteSsoButtons Component
 *
 * Provides single-click Google and Microsoft SSO invitation acceptance.
 * Reuses existing provider token flows and delegates to backend accept-invite/sso.
 */
const useIsDarkMode = () => {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === 'undefined') return false
    const coreuiTheme = document.documentElement.getAttribute('data-coreui-theme')
    if (coreuiTheme === 'dark') return true
    if (coreuiTheme === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const currentCoreui = document.documentElement.getAttribute('data-coreui-theme')
      if (currentCoreui === 'dark') setIsDark(true)
      else if (currentCoreui === 'light') setIsDark(false)
      else setIsDark(mediaQuery.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    const observer = new MutationObserver(handleChange)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-coreui-theme'],
    })

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      observer.disconnect()
    }
  }, [])

  return isDark
}

export const InviteSsoButtons = ({ onSsoSuccess, onSsoError, disabled }) => {
  const { t } = useTranslation()
  const { instance: msalInstance } = useMsal()
  const isDarkMode = useIsDarkMode()

  const handleMicrosoftClick = async () => {
    if (!msalInstance) {
      if (onSsoError) {
        onSsoError(
          t('auth.invite.msalUnavailable', 'Microsoft sign-in is not configured or unavailable.'),
        )
      }
      return
    }

    try {
      const response = await msalInstance.loginPopup({
        scopes: ['openid', 'profile', 'user.read', 'email'],
      })
      if (response && response.idToken) {
        onSsoSuccess(response.idToken, 'microsoft')
      }
    } catch (err) {
      console.error('Microsoft SSO login error:', err)
      const errorMsg =
        err?.errorMessage ||
        err?.message ||
        t('auth.invite.ssoError', 'Microsoft sign-in failed. Please try again.')
      if (onSsoError) {
        onSsoError(errorMsg)
      }
    }
  }

  // Responsive button width matching mobile card content and capped at Google's 400px maximum
  const [btnWidth, setBtnWidth] = React.useState(360)

  React.useEffect(() => {
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        const calculated = Math.min(Math.max(window.innerWidth - 64, 260), 400)
        setBtnWidth(calculated)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  return (
    <div className="invite-sso-container">
      <div className="d-flex align-items-center my-4">
        <div className="flex-grow-1 border-top" />
        <span
          className="px-3 text-muted small text-uppercase fw-semibold"
          style={{ letterSpacing: '0.05em' }}
        >
          {t('auth.invite.orContinueWith', 'Or continue with')}
        </span>
        <div className="flex-grow-1 border-top" />
      </div>

      <div className="d-flex flex-column align-items-center gap-2.5 w-100">
        {/* Google SSO */}
        <div className="google-login-wrapper w-100 d-flex justify-content-center">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse?.credential) {
                onSsoSuccess(credentialResponse.credential, 'google')
              }
            }}
            onError={() => {
              console.error('Google SSO Error')
              if (onSsoError) {
                onSsoError(
                  t(
                    'auth.invite.googleSsoError',
                    'Google sign-in was cancelled or encountered an error.',
                  ),
                )
              }
            }}
            type="standard"
            theme={isDarkMode ? 'filled_black' : 'outline'}
            size="large"
            width={String(btnWidth)}
            text="continue_with"
          />
        </div>

        {/* Microsoft SSO */}
        <div className="w-100 d-flex justify-content-center">
          <CButton
            type="button"
            color="light"
            variant="outline"
            className="invite-microsoft-btn w-100 py-2 d-flex align-items-center justify-content-center gap-2 border rounded-3 fw-semibold shadow-xs"
            style={{ maxWidth: `${btnWidth}px`, minHeight: '40px' }}
            disabled={disabled}
            onClick={handleMicrosoftClick}
          >
            <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span>{t('auth.invite.continueWithMicrosoft', 'Continue with Microsoft')}</span>
          </CButton>
        </div>
      </div>
    </div>
  )
}

InviteSsoButtons.propTypes = {
  onSsoSuccess: PropTypes.func.isRequired,
  onSsoError: PropTypes.func,
  disabled: PropTypes.bool,
}

export default InviteSsoButtons
