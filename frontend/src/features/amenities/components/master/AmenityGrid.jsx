import React from 'react'
import { memo } from 'react'

const AmenityGrid = memo(
  ({
    amenities,
    canManage,
    canUpdate,
    canDelete,
    onEdit,
    onToggleStatus,
    onViewDetails,
    onDelete,
  }) => {
    if (!amenities || amenities.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No amenities match your criteria.
        </div>
      )
    }

    return (
      <div
        className="dashboard-grid"
        id="amenity-master-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
      >
        {amenities.map((item) => {
          const imageUrl =
            item.images && item.images.length > 0
              ? item.images[0]
              : 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=800&q=80'
          const rate =
            item.pricing?.baseRate ?? item.pricingConfig?.baseRate ?? item.ratePerHour ?? 0
          const pType = (
            item.pricing?.pricingType ||
            item.pricingConfig?.pricingType ||
            ''
          ).toLowerCase()
          const pricingLabel =
            pType === 'daily'
              ? '/day'
              : pType === 'session'
                ? '/session'
                : pType === 'free' || rate === 0
                  ? ' (Free)'
                  : '/hr'

          const statusLower = String(item.status || '').toLowerCase()
          const isMaintenance =
            item.currentStatus === 'Under Maintenance' || statusLower === 'maintenance'
          const isActive = statusLower === 'active'
          const isDraft = statusLower === 'draft' || item.isDraft === true

          return (
            <div
              key={item._id}
              className="card card-hover amenity-item-card"
              style={{
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
              }}
              onClick={() => onViewDetails(item)}
            >
              <div
                style={{
                  height: '180px',
                  background: `url('${imageUrl}') center/cover`,
                  flexShrink: 0,
                }}
              ></div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                    gap: '8px',
                  }}
                >
                  <h4
                    style={{ margin: 0, lineHeight: 1.3 }}
                    className="fs-5 text-primary text-decoration-underline-hover"
                  >
                    {item.name}
                  </h4>
                  <span
                    className={`badge ${isMaintenance ? 'badge-warning' : isActive ? 'badge-success' : isDraft ? 'badge-info' : 'badge-secondary'}`}
                    style={{ flexShrink: 0 }}
                  >
                    {isMaintenance
                      ? 'Maintenance'
                      : isActive
                        ? 'Active'
                        : isDraft
                          ? 'Draft'
                          : 'Inactive'}
                  </span>
                </div>

                <div
                  style={{
                    color: 'var(--text-muted)',
                    marginBottom: '16px',
                    lineHeight: 1.8,
                    flex: 1,
                  }}
                  className="fw-medium small"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i
                      className="fa-solid fa-location-dot"
                      style={{ color: 'var(--primary)', width: '14px', textAlign: 'center' }}
                    ></i>
                    <span>{item.location || 'No location specified'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i
                      className="fa-solid fa-users"
                      style={{ color: 'var(--primary)', width: '14px', textAlign: 'center' }}
                    ></i>
                    <span>Capacity: {item.capacity ?? item.maxCapacity ?? 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i
                      className="fa-solid fa-indian-rupee-sign"
                      style={{ color: 'var(--primary)', width: '14px', textAlign: 'center' }}
                    ></i>
                    <span>
                      ₹{rate.toLocaleString()}
                      {pricingLabel}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="small btn btn-outline"
                    style={{ flex: 1, padding: '10px 16px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(item)
                    }}
                    disabled={!canUpdate}
                  >
                    <i className="small fa-solid fa-pen-to-square"></i> Edit
                  </button>
                  <button
                    className="small btn btn-outline"
                    style={{ flex: 1, padding: '10px 16px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleStatus(item)
                    }}
                    disabled={!(canDelete ?? canManage)}
                  >
                    <i
                      className={`small fa-solid ${item.status === 'active' ? 'fa-ban' : 'fa-check'}`}
                    ></i>{' '}
                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="small btn btn-outline"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      color: 'var(--danger)',
                      borderColor: 'var(--danger)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(item)
                    }}
                    disabled={!(canDelete ?? canManage)}
                  >
                    <i className="small fa-solid fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  },
)

export default AmenityGrid
