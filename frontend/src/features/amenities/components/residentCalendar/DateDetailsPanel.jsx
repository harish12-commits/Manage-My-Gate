import React, { memo } from 'react'
import { CPlaceholder } from '@coreui/react'

const STATUS_CONFIG = {
  Available: { color: '#10B981', bg: '#D1FAE5', label: 'Available', badge: 'badge-available' },
  Booked: { color: '#EF4444', bg: '#FEE2E2', label: 'Booked', badge: 'badge-booked' },
  BookedByMe: { color: '#059669', bg: '#D1FAE5', label: 'Booked by You', badge: 'badge-booked-me' },
  Maintenance: { color: '#F59E0B', bg: '#FEF3C7', label: 'Maintenance', badge: 'badge-maint' },
  Closed: { color: '#94A3B8', bg: '#F1F5F9', label: 'Closed', badge: 'badge-closed' },
}

const getStatusCfg = (slot) => {
  if (slot.bookedByMe) return STATUS_CONFIG.BookedByMe
  return STATUS_CONFIG[slot.status] || STATUS_CONFIG.Closed
}

const DateDetailsPanel = memo(
  ({
    selectedDate,
    dateBookings,
    amenities,
    selectedAmenityId,
    onAmenitySelect,
    allSlots,
    slotsLoading,
    onSlotSelect,
    selectedSlot,
    onBookNow,
    onClose,
  }) => {
    const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const activeAmenities = (amenities || []).filter((a) => a.status === 'active')
    const selectedAmenity = amenities?.find((a) => a._id === selectedAmenityId)

    const bookingStatusClass = (status) => {
      if (status === 'confirmed' || status === 'approved') return 'ddp-booking-badge--success'
      if (status === 'cancelled' || status === 'rejected') return 'ddp-booking-badge--danger'
      return 'ddp-booking-badge--default'
    }

    return (
      <div className="ddp-root">
        {/* Header */}
        <div className="ddp-header">
          <div>
            <div className="ddp-header__label">Selected Date</div>
            <div className="ddp-header__date">{formattedDate}</div>
          </div>
          <button className="ddp-close-btn" onClick={onClose} aria-label="Close panel">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="ddp-body">
          {/* ── Section 1: Existing Bookings ── */}
          {dateBookings.length > 0 && (
            <div className="ddp-card">
              <div className="ddp-card__title">
                <i className="fa-regular fa-calendar-check me-2" style={{ color: '#0084FF' }}></i>
                Your Bookings
                <span className="ddp-count-pill">{dateBookings.length}</span>
              </div>
              <div className="ddp-booking-list">
                {dateBookings.map((b) => (
                  <div key={b.id} className="ddp-booking-row">
                    <div>
                      <div className="ddp-booking-name">{b.amenityName}</div>
                      <div className="ddp-booking-time">
                        <i className="fa-regular fa-clock me-1"></i>
                        {b.start} – {b.end}
                      </div>
                    </div>
                    <span className={`ddp-booking-badge ${bookingStatusClass(b.status)}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 2: Book an Amenity ── */}
          <div className="ddp-card">
            <div
              className="fw-bold fs-5 ddp-card__title"
              style={{ color: '#0F172A', marginBottom: '16px' }}
            >
              Available Slots
            </div>

            <select
              className="ddp-select mb-3"
              value={selectedAmenityId || ''}
              onChange={(e) => onAmenitySelect(e.target.value)}
            >
              <option value="">— Select Amenity —</option>
              {activeAmenities.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {activeAmenities.map((a) => (
                <button
                  key={a._id}
                  onClick={() => onAmenitySelect(selectedAmenityId === a._id ? '' : a._id)}
                  className={`btn btn-sm rounded-pill px-3 py-1 d-flex align-items-center gap-2 ${selectedAmenityId === a._id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                  style={{
                    backgroundColor:
                      selectedAmenityId !== a._id ? 'var(--bg-secondary, #F8FAFC)' : '',
                    border:
                      selectedAmenityId === a._id
                        ? 'none'
                        : '1px solid var(--border-light, #E2E8F0)',
                    transition:
                      'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                    fontWeight: selectedAmenityId === a._id ? '600' : '400',
                    color: selectedAmenityId !== a._id ? '#475569' : '',
                  }}
                >
                  {a.name}
                </button>
              ))}
              {activeAmenities.length === 0 && (
                <span className="text-muted small">No amenities available</span>
              )}
            </div>

            {selectedAmenityId && (
              <>
                {slotsLoading ? (
                  <div className="ddp-slot-grid">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <CPlaceholder
                        key={i}
                        animation="glow"
                        style={{ height: '80px', borderRadius: '12px' }}
                      />
                    ))}
                  </div>
                ) : selectedAmenity?.pricing?.pricingType === 'daily' ? (
                  <div
                    className="ddp-card shadow-sm mt-3 mb-2"
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #0084FF',
                      padding: '16px',
                      animation: 'fadeIn 0.3s ease-out',
                    }}
                  >
                    <div className="fs-6 ddp-card__title" style={{ marginBottom: '12px' }}>
                      Day-Based Booking Summary
                    </div>
                    <div
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                      className="small"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Amenity</span>
                        <strong style={{ color: '#0F172A' }}>{selectedAmenity.name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Date</span>
                        <strong style={{ color: '#0F172A' }}>{formattedDate}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Operating Hours</span>
                        <strong style={{ color: '#0F172A' }}>
                          {selectedAmenity.bookingRules?.openTime} -{' '}
                          {selectedAmenity.bookingRules?.closeTime}
                        </strong>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          borderTop: '1px solid #E2E8F0',
                          paddingTop: '8px',
                          marginTop: '4px',
                        }}
                      >
                        <span style={{ color: '#64748B' }}>Daily Rate</span>
                        <strong style={{ color: '#0F172A' }} className="fs-6">
                          {selectedAmenity.pricing?.baseRate > 0
                            ? `₹${selectedAmenity.pricing.baseRate}`
                            : 'Free'}
                        </strong>
                      </div>
                    </div>
                    {allSlots &&
                    allSlots[0] &&
                    (allSlots[0].status !== 'Available' ||
                      allSlots[0].myBookingsCount >=
                        (selectedAmenity.maxBookingsPerUserPerSlot || 1)) ? (
                      <div
                        className="text-danger small mt-3 fw-medium"
                        style={{ background: '#FEE2E2', padding: '8px 12px', borderRadius: '8px' }}
                      >
                        <i className="fa-solid fa-triangle-exclamation me-1"></i>
                        This amenity is{' '}
                        {allSlots[0].status === 'Available'
                          ? 'already booked by you'
                          : allSlots[0].status.toLowerCase()}{' '}
                        for the selected date.
                      </div>
                    ) : (
                      <button
                        className="fw-semibold btn btn-primary w-100 mt-3"
                        style={{ padding: '10px' }}
                        onClick={() => {
                          const slotToBook =
                            allSlots && allSlots[0]
                              ? allSlots[0]
                              : {
                                  startTime: selectedAmenity.bookingRules?.openTime,
                                  endTime: selectedAmenity.bookingRules?.closeTime,
                                  price: selectedAmenity.pricing?.baseRate,
                                  status: 'Available',
                                }
                          onSlotSelect(slotToBook)
                          onBookNow()
                        }}
                      >
                        Book Full Day
                      </button>
                    )}
                  </div>
                ) : allSlots && allSlots.length > 0 ? (
                  <>
                    {/* Legend */}
                    <div className="ddp-legend">
                      {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                        <span key={status} className="ddp-legend-item">
                          <span className="ddp-legend-dot" style={{ background: cfg.color }}></span>
                          {status}
                        </span>
                      ))}
                    </div>

                    {/* Slot Grid */}
                    <div className="ddp-slot-grid">
                      {allSlots.map((slot, i) => {
                        const maxLimit =
                          slot.maxBookingsPerUser || selectedAmenity?.maxBookingsPerUserPerSlot || 2
                        const myCount = slot.myBookingsCount || 0
                        const canBookMore = myCount < maxLimit && slot.status === 'Available'

                        const cfg = getStatusCfg(slot)
                        const isAvailable = slot.status === 'Available' && canBookMore
                        const isSelected =
                          selectedSlot?.startTime === slot.startTime &&
                          selectedSlot?.endTime === slot.endTime

                        let cardClass = isAvailable
                          ? 'ddp-slot-card--available'
                          : 'ddp-slot-card--disabled'
                        if (isSelected) cardClass += ' ddp-slot-card--selected'

                        let badgeLabel = cfg.label
                        if (slot.bookedByMe) {
                          badgeLabel = `Booked by You (${myCount}/${maxLimit})`
                        }

                        const slotCard = (
                          <div
                            key={`slot-${i}`}
                            className={`ddp-slot-card ${cardClass}`}
                            style={{
                              borderLeftColor: isSelected ? '#0084FF' : cfg.color,
                              '--slot-bg-hover': cfg.bg,
                              background: isSelected ? '#F0F9FF' : '#ffffff',
                              borderColor: isSelected ? '#0084FF' : '#E2E8F0',
                              opacity: !isAvailable && !slot.bookedByMe ? 0.6 : 1,
                            }}
                            onClick={() => {
                              if (isAvailable) {
                                onSlotSelect(slot)
                              }
                            }}
                            title={
                              isAvailable ? `Book ${slot.startTime} – ${slot.endTime}` : cfg.label
                            }
                          >
                            {isSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '-10px',
                                  right: '-10px',
                                  background: '#0084FF',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '24px',
                                  height: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 4px rgba(0,132,255,0.3)',
                                }}
                                className="small"
                              >
                                <i className="fa-solid fa-check"></i>
                              </div>
                            )}
                            <div className="ddp-slot-time">{slot.startTime}</div>
                            <div className="ddp-slot-meta">
                              <span className="ddp-slot-end">{slot.endTime}</span>
                              {selectedAmenity?.pricing?.pricingType !== 'daily' && (
                                <span className="ddp-slot-duration">
                                  {slot.duration ||
                                    selectedAmenity.bookingRules?.slotDurationMinutes ||
                                    60}
                                  m
                                </span>
                              )}
                            </div>
                            <div
                              className="ddp-slot-badge"
                              style={{
                                background: isSelected ? '#0084FF' : cfg.bg,
                                color: isSelected ? '#ffffff' : cfg.color,
                              }}
                            >
                              {!isSelected && (
                                <span
                                  className="ddp-badge-dot"
                                  style={{ background: cfg.color }}
                                ></span>
                              )}
                              {isSelected ? 'Selected' : badgeLabel}
                            </div>
                          </div>
                        )

                        // Determine if this is the end of a row or the last item
                        const isRowEnd = i % 2 === 1 || i === allSlots.length - 1
                        const selectedIndex = selectedSlot
                          ? allSlots.findIndex(
                              (s) =>
                                s.startTime === selectedSlot.startTime &&
                                s.endTime === selectedSlot.endTime,
                            )
                          : -1
                        const isSelectedRow =
                          selectedIndex !== -1 &&
                          Math.floor(selectedIndex / 2) === Math.floor(i / 2)

                        if (isRowEnd && isSelectedRow && selectedAmenity) {
                          return (
                            <React.Fragment key={`row-${i}`}>
                              {slotCard}
                              <div
                                className="ddp-card shadow-sm mt-1 mb-2"
                                style={{
                                  gridColumn: '1 / -1',
                                  background: '#F8FAFC',
                                  border: '1px solid #0084FF',
                                  padding: '16px',
                                  animation: 'fadeIn 0.3s ease-out',
                                }}
                              >
                                <div
                                  className="fs-6 ddp-card__title"
                                  style={{ marginBottom: '12px' }}
                                >
                                  Booking Summary
                                </div>
                                <div
                                  style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                                  className="small"
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Amenity</span>
                                    <strong style={{ color: '#0F172A' }}>
                                      {selectedAmenity.name}
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Date</span>
                                    <strong style={{ color: '#0F172A' }}>{formattedDate}</strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Time</span>
                                    <strong style={{ color: '#0F172A' }}>
                                      {selectedSlot.startTime} - {selectedSlot.endTime}
                                    </strong>
                                  </div>
                                  {selectedAmenity?.pricing?.pricingType !== 'daily' && (
                                    <div
                                      style={{ display: 'flex', justifyContent: 'space-between' }}
                                    >
                                      <span style={{ color: '#64748B' }}>Duration</span>
                                      <strong style={{ color: '#0F172A' }}>
                                        {selectedSlot.duration ||
                                          selectedAmenity.bookingRules?.slotDurationMinutes ||
                                          60}{' '}
                                        Minutes
                                      </strong>
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      borderTop: '1px solid #E2E8F0',
                                      paddingTop: '8px',
                                      marginTop: '4px',
                                    }}
                                  >
                                    <span style={{ color: '#64748B' }}>Booking Amount</span>
                                    <strong style={{ color: '#0F172A' }} className="fs-6">
                                      {selectedSlot.price > 0 ? `₹${selectedSlot.price}` : 'Free'}
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#64748B' }}>Status</span>
                                    <strong style={{ color: '#10B981' }}>Ready to Book</strong>
                                  </div>
                                </div>
                                <button
                                  className="fw-semibold btn btn-primary w-100 mt-3"
                                  style={{ padding: '10px' }}
                                  onClick={onBookNow}
                                >
                                  Book Now
                                </button>
                              </div>
                            </React.Fragment>
                          )
                        }

                        return slotCard
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    className="ddp-empty-text"
                    style={{ textAlign: 'center', padding: '24px 0' }}
                  >
                    <i
                      className="fs-2 fa-regular fa-calendar-xmark"
                      style={{ marginBottom: '8px', display: 'block', color: '#CBD5E1' }}
                    ></i>
                    <div style={{ color: '#0F172A', marginBottom: '4px' }} className="fw-semibold">
                      No available slots for this date.
                    </div>
                    <div className="small">Please select another date or amenity.</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Section 3: Operating Info ── */}
          {selectedAmenity && (
            <div className="ddp-card">
              <div className="ddp-card__title">
                <i className="fa-regular fa-clock me-2" style={{ color: '#0084FF' }}></i>
                Operating Information
              </div>
              <div className="ddp-info-row">
                <i className="fa-solid fa-door-open ddp-info-icon"></i>
                <span>
                  Opens at <strong>{selectedAmenity.bookingRules?.openTime || 'N/A'}</strong>
                </span>
              </div>
              <div className="ddp-info-row">
                <i className="fa-solid fa-door-closed ddp-info-icon"></i>
                <span>
                  Closes at <strong>{selectedAmenity.bookingRules?.closeTime || 'N/A'}</strong>
                </span>
              </div>
              {selectedAmenity.status === 'maintenance' && (
                <div className="ddp-info-row ddp-info-row--warning">
                  <i className="fa-solid fa-wrench ddp-info-icon"></i>
                  <span>Currently Under Maintenance</span>
                </div>
              )}
              {selectedAmenity.bookingRules?.slotDurationMinutes &&
                selectedAmenity?.pricing?.pricingType !== 'daily' && (
                  <div className="ddp-info-row">
                    <i className="fa-regular fa-hourglass-half ddp-info-icon"></i>
                    <span>
                      Slot Duration:{' '}
                      <strong>{selectedAmenity.bookingRules?.slotDurationMinutes} min</strong>
                    </span>
                  </div>
                )}
            </div>
          )}
        </div>
        <style>{`
      .ddp-root {
        display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid #F1F5F9;
          background: #ffffff;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
        }

        .ddp-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 24px;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          color: #ffffff;
        }

        .ddp-header__label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94A3B8;
          margin-bottom: 6px;
        }

        .ddp-header__date {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        .ddp-close-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease;
          flex-shrink: 0;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ddp-close-btn:hover {
          background: rgba(255,255,255,0.15);
        }

        .ddp-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #F8FAFC;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ddp-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #F1F5F9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }

        .ddp-card__title {
          font-size: 15px;
          font-weight: 700;
          color: #0F172A;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
        }

        .ddp-count-pill {
          margin-left: 8px;
          background: #EFF6FF;
          color: #0084FF;
          font-size: 12px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          border: 1px solid #BFDBFE;
        }

        .ddp-empty-text {
          font-size: 14px;
          color: #64748B;
          margin: 0;
        }

        .ddp-booking-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ddp-booking-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }

        .ddp-booking-name {
          font-size: 14px;
          font-weight: 700;
          color: #1E293B;
          margin-bottom: 4px;
        }

        .ddp-booking-time {
          font-size: 13px;
          color: #64748B;
          font-weight: 500;
        }

        .ddp-booking-badge {
          font-size: 12px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 24px;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .ddp-booking-badge--success { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
        .ddp-booking-badge--danger  { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .ddp-booking-badge--default { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }

        .ddp-select {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid #CBD5E1;
          font-size: 14px;
          font-weight: 600;
          color: #1E293B;
          background: #ffffff;
          cursor: pointer;
          transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease, width 0.2s ease, height 0.2s ease, max-height 0.2s ease;
          margin-bottom: 16px;
          outline: none;
        }

        .ddp-select:focus {
          border-color: #0084FF;
          box-shadow: 0 0 0 4px rgba(0,132,255,0.1);
        }

        .ddp-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ddp-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
        }

        .ddp-legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ddp-slot-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .ddp-slot-card {
          border: 1px solid #E2E8F0;
          border-left-width: 4px;
          border-radius: 14px;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          transition: color 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          background: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
          position: relative;
        }

        .ddp-slot-card--available {
          cursor: pointer;
        }

        .ddp-slot-card--available:hover:not(.ddp-slot-card--selected) {
          background: #ffffff;
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          border-color: #CBD5E1;
        }
        
        .ddp-slot-card--selected {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 132, 255, 0.15);
        }

        .ddp-slot-card--disabled {
          cursor: not-allowed;
          opacity: 0.6;
          background: #F8FAFC;
        }

        .ddp-slot-time {
          font-size: 20px;
          font-weight: 800;
          color: #0F172A;
          line-height: 1.2;
        }

        .ddp-slot-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .ddp-slot-end {
          font-size: 13px;
          color: #64748B;
          font-weight: 600;
        }

        .ddp-slot-duration {
          font-size: 13px;
          color: #94A3B8;
          font-weight: 500;
        }

        .ddp-slot-badge {
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: auto;
        }

        .ddp-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .ddp-info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          font-weight: 500;
          color: #475569;
          padding: 10px 0;
          border-bottom: 1px solid #F1F5F9;
        }

        .ddp-info-row:last-child {
          border-bottom: none;
        }

        .ddp-info-row--warning {
          color: #9A3412;
          background: #FFFBEB;
          padding: 12px 14px;
          border-radius: 12px;
          margin-top: 8px;
          border: 1px solid #FDE68A;
        }

        .ddp-info-icon {
          color: #0084FF;
          width: 18px;
          font-size: 16px;
          text-align: center;
          flex-shrink: 0;
        }

        .ddp-info-row--warning .ddp-info-icon {
          color: #D97706;
        }
      `}</style>
      </div>
    )
  },
)

export default DateDetailsPanel
