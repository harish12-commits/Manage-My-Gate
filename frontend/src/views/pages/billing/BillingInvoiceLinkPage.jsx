import React, { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CButton, CCard, CCardBody, CContainer } from '@coreui/react'
import config from '../../../config/config.js'

/**
 * Landing page for invoice links in billing emails (https://<domain>/billing/invoice/:id?t=...).
 * With the app installed, the OS opens the app directly and this page is never shown.
 * Otherwise it offers: open the app, install it, or pay online (token-scoped, current balance).
 */
const APP_SCHEME = 'managemygate'
const APP_STORE_URL = 'https://apps.apple.com/app/manage-my-gate/id6746501635'

const BillingInvoiceLinkPage = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const platform = useMemo(() => {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
    if (/android/i.test(ua)) return 'android'
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
    return 'desktop'
  }, [])

  const appUrl = `${APP_SCHEME}://billing/invoice/${encodeURIComponent(id || '')}`
  const payUrl = token ? `/api/billing-links/${encodeURIComponent(token)}/pay` : null
  const storeUrl = platform === 'ios' ? APP_STORE_URL : config.playStoreUrl

  return (
    <div className="min-vh-100 d-flex align-items-center bg-body-tertiary py-4">
      <CContainer style={{ maxWidth: 460 }}>
        <CCard className="border-0 shadow-sm" style={{ borderRadius: 20 }}>
          <CCardBody className="p-4 text-center">
            <h1 className="h4 fw-bold mb-2">{t('billing_link_title', 'Your invoice')}</h1>
            <p className="text-body-secondary mb-4">
              {t(
                'billing_link_subtitle',
                'Open the app to view the invoice and pay with your wallet or any payment method.',
              )}
            </p>

            {platform !== 'desktop' && (
              <CButton color="primary" size="lg" className="w-100 mb-2" href={appUrl}>
                {t('billing_link_open_app', 'Open in the app')}
              </CButton>
            )}

            {payUrl && (
              <CButton
                color={platform === 'desktop' ? 'primary' : 'secondary'}
                variant={platform === 'desktop' ? undefined : 'outline'}
                size="lg"
                className="w-100 mb-2"
                href={payUrl}
                rel="noopener noreferrer"
              >
                {t('billing_link_pay_online', 'Pay online without the app')}
              </CButton>
            )}

            {platform !== 'desktop' && (
              <CButton
                color="link"
                className="w-100"
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('billing_link_install', "Don't have the app? Install it")}
              </CButton>
            )}

            {payUrl && (
              <p className="small text-body-secondary mt-3 mb-0">
                {t(
                  'billing_link_pay_note',
                  'The online link always charges your current balance and stops working once the invoice is paid.',
                )}
              </p>
            )}
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}

export default BillingInvoiceLinkPage
