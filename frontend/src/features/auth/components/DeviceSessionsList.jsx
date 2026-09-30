import React, { useEffect, useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CButton,
  CListGroup,
  CListGroupItem,
  CAlert,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilScreenDesktop, cilMobile, cilGlobeAlt } from '@coreui/icons'
import { useTranslation } from 'react-i18next'
import authService from '../services/authService.js'
import AppLoader from '../../../components/common/AppLoader'

export const DeviceSessionsList = () => {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchDeviceSessions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await authService.fetchSessions()
      setSessions(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeviceSessions()
  }, [])

  const handleRevoke = async (sessionId) => {
    try {
      await authService.revokeSession(sessionId)
      setSessions(sessions.filter((s) => s._id !== sessionId))
    } catch (err) {
      setError(err.message || 'Failed to revoke session')
    }
  }

  const getDeviceIcon = (deviceStr) => {
    if (!deviceStr) return cilGlobeAlt
    const lower = deviceStr.toLowerCase()
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone'))
      return cilMobile
    return cilScreenDesktop
  }

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>{t('auth.sessions.title', 'Active Sessions & Devices')}</strong>
        <CButton
          color="primary"
          variant="ghost"
          size="sm"
          onClick={fetchDeviceSessions}
          disabled={loading}
        >
          {t('common.refresh', 'Refresh')}
        </CButton>
      </CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}

        {loading ? (
          <div className="text-center py-4">
            <AppLoader variant="block" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-muted text-center py-3">
            {t('auth.sessions.empty', 'No active sessions found.')}
          </p>
        ) : (
          <CListGroup flush>
            {sessions.map((session) => (
              <CListGroupItem
                key={session._id}
                className="d-flex justify-content-between align-items-center py-3"
              >
                <div className="d-flex align-items-center">
                  <CIcon
                    icon={getDeviceIcon(session.deviceInfo?.os)}
                    size="xl"
                    className="me-3 text-secondary"
                  />
                  <div>
                    <h6 className="mb-1">
                      {session.deviceInfo?.browser || 'Unknown Browser'} on{' '}
                      {session.deviceInfo?.os || 'Unknown OS'}
                      {session.isCurrentSession && (
                        <CBadge color="success" className="ms-2">
                          {t('auth.sessions.current', 'Current Device')}
                        </CBadge>
                      )}
                    </h6>
                    <small className="text-muted d-block">
                      {t('auth.sessions.ip', 'IP')}: {session.deviceInfo?.ipAddress || 'Unknown'}{' '}
                      &bull;
                      {t('auth.sessions.lastActive', ' Last Active')}:{' '}
                      {new Date(session.lastActive).toLocaleString()}
                    </small>
                  </div>
                </div>
                {!session.isCurrentSession && (
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(session._id)}
                  >
                    {t('auth.sessions.revoke', 'Revoke')}
                  </CButton>
                )}
              </CListGroupItem>
            ))}
          </CListGroup>
        )}
      </CCardBody>
    </CCard>
  )
}

export default DeviceSessionsList
