import React from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Organization Information Card — Notice Board `.section-card` + `.info-grid` pattern.
 */
export const OrganizationInfoCard = ({ organization }) => {
  const { t } = useTranslation()

  if (!organization) return null

  const getStatusClass = (status) => {
    switch (status) {
      case 'Active':
        return 'status-active'
      case 'Pending':
        return 'status-pending'
      case 'Rejected':
        return 'status-rejected'
      default:
        return 'status-inactive'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="section-card">
      <div className="section-card-header">
        <h4 className="section-title">
          {t('superAdmin.orgDetails.infoTitle', { defaultValue: 'Organization Information' })}
        </h4>
        <span className={`status-pill ${getStatusClass(organization.status)}`}>
          {organization.status || 'Unknown'}
        </span>
      </div>
      <div className="section-card-body">
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.name', { defaultValue: 'Community Name' })}
            </div>
            <div className="info-value">{organization.name}</div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.id', { defaultValue: 'Organization ID' })}
            </div>
            <div className="info-value">
              <code>{organization._id}</code>
            </div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.type', { defaultValue: 'Organization Type' })}
            </div>
            <div className="info-value">{organization.organizationType || 'Residential'}</div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.contactEmail', { defaultValue: 'Contact Email' })}
            </div>
            <div className="info-value">{organization.contactEmail || 'N/A'}</div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.contactPhone', { defaultValue: 'Contact Phone' })}
            </div>
            <div className="info-value">{organization.contactPhone || 'N/A'}</div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.timezone', { defaultValue: 'Timezone' })}
            </div>
            <div className="info-value">{organization.timezone || 'Asia/Kolkata'}</div>
          </div>

          <div className="info-item">
            <div className="info-label">
              {t('superAdmin.orgDetails.createdDate', { defaultValue: 'Created Date' })}
            </div>
            <div className="info-value">{formatDate(organization.createdAt)}</div>
          </div>

          <div className="info-item" style={{ gridColumn: 'span 2' }}>
            <div className="info-label">
              {t('superAdmin.orgDetails.allowedFeatures', { defaultValue: 'Allowed Features' })}
            </div>
            <div className="features-list">
              {organization.allowedFeatures && organization.allowedFeatures.length > 0 ? (
                organization.allowedFeatures.map((feat) => (
                  <span key={feat} className="feature-tag">
                    {feat}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('superAdmin.orgDetails.noFeatures', { defaultValue: 'None configured' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrganizationInfoCard
