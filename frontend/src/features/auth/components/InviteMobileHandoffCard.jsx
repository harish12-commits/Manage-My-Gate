import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { CCard, CCardBody, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCheckCircle } from '@coreui/icons'

/**
 * InviteMobileHandoffCard Component
 *
 * Automated transition state rendered after invitation acceptance on a mobile device.
 * Automatically attempts to launch the installed native application via deep-link,
 * and seamlessly redirects to Google Play / Apple App Store if the app is not detected.
 *
 * Strictly eliminates any manual "USER CHOOSES", "Continue in Web", or manual selection buttons.
 */
export const InviteMobileHandoffCard = ({ handoffData, orgName }) => {
  const { t } = useTranslation()
  const [redirectingToStore, setRedirectingToStore] = useState(false)

  const playStoreFallback = 'https://play.google.com/store/apps/details?id=com.atominosconsulting.nahom'
  const appStoreFallback = 'https://apps.apple.com/app/manage-my-gate/id6746501635'

  const APP_IN_REVIEW_IOS = true // Set to false once the app is approved on the App Store

  const isIos =
    typeof navigator !== 'undefined' &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '')

  let storeUrl = isAndroid
    ? (handoffData?.playStoreUrl || playStoreFallback)
    : (handoffData?.appStoreUrl || appStoreFallback)

  // Temporarily route iOS users to the web dashboard if they don't have the app installed,
  // since the App Store link won't work while the app is in review.
  if (isIos && APP_IN_REVIEW_IOS) {
    storeUrl = '/dashboard'
  }

  const deepLink = handoffData?.deepLink

  useEffect(() => {
    // 1. Automatically attempt to launch the installed native mobile app
    if (deepLink) {
      window.location.href = deepLink
    }

    // 2. Automatic fallback: If browser goes to background, it means the app opened.
    // Otherwise, transition state and redirect to store (or dashboard) after 1.8s.
    const fallbackTimer = setTimeout(() => {
      setRedirectingToStore(true)
      if (storeUrl) {
        window.location.href = storeUrl
      }
    }, 1800)

    const cancelOnHide = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        clearTimeout(fallbackTimer)
        document.removeEventListener('visibilitychange', cancelOnHide)
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', cancelOnHide)
    }

    return () => {
      clearTimeout(fallbackTimer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', cancelOnHide)
      }
    }
  }, [deepLink, storeUrl])

  const storeName = isIos && APP_IN_REVIEW_IOS ? 'Web Dashboard' : isIos ? 'Apple App Store' : 'Google Play Store'

  return (
    <CCard className="invite-card invite-handoff-card border-0 shadow-lg rounded-4 overflow-hidden text-center p-4 p-md-5">
      <CCardBody className="p-0">
        <div
          className="mb-3 d-inline-flex align-items-center justify-content-center bg-success-subtle text-success rounded-circle p-3"
          style={{ width: 68, height: 68 }}
        >
          <CIcon icon={cilCheckCircle} size="xxl" />
        </div>

        <h4 className="fw-bold text-foreground mb-2">
          {t('auth.handoff.joinedTitle', 'Account Activated Successfully!')}
        </h4>

        <p className="text-muted small mb-4">
          {orgName
            ? t('auth.handoff.joinedSubtitleWithOrg', 'Your account is active and you are now a member of {{orgName}}.', { orgName })
            : t('auth.handoff.joinedSubtitle', 'Your account is active and your workspace invitation has been accepted.')}
        </p>

        <div className="bg-light rounded-3 p-4 mb-3 text-center">
          <CSpinner color="primary" size="sm" className="me-2 mb-1" />
          <span className="fw-semibold text-dark small">
            {redirectingToStore
              ? isIos && APP_IN_REVIEW_IOS
                ? t('auth.handoff.redirectingDashboard', 'Opening Web Dashboard...')
                : t('auth.handoff.redirectingStore', 'Opening {{storeName}} to install Nahom...', { storeName })
              : t('auth.handoff.connectingApp', 'Launching the Nahom mobile app...')}
          </span>
          <p className="text-muted small mt-2 mb-0" style={{ fontSize: '0.82rem' }}>
            {t('auth.handoff.autoHandoffDesc', 'Your authenticated session is being securely synced to your device.')}
          </p>
        </div>

        {/* Fallback direct link in case browser pop-up/redirect blocker prevents auto-navigation */}
        <div className="pt-2 text-center">
          <small className="text-muted" style={{ fontSize: '0.78rem' }}>
            {t('auth.handoff.troubleRedirecting', 'If the app or store does not open automatically,')}{' '}
            <a
              href={storeUrl}
              className="text-primary fw-semibold text-decoration-none"
            >
              {t('auth.handoff.tapToContinue', 'tap here to continue.')}
            </a>
          </small>
        </div>
      </CCardBody>
    </CCard>
  )
}

InviteMobileHandoffCard.propTypes = {
  handoffData: PropTypes.shape({
    handoffId: PropTypes.string,
    deepLink: PropTypes.string,
    universalLink: PropTypes.string,
    playStoreUrl: PropTypes.string,
    appStoreUrl: PropTypes.string,
  }),
  orgName: PropTypes.string,
}

export default InviteMobileHandoffCard
