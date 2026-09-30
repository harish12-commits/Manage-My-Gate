import React, { useState } from 'react'

export const InvitationForm = ({
  inviteMethod,
  guestPassType,
  setGuestPassType,
  cabPassType,
  setCabPassType,
  cabUsageType,
  setCabUsageType,
  servicePassType,
  setServicePassType,
  serviceUsageType,
  setServiceUsageType,
  formData,
  handleInputChange,
  handleCreatePass,
}) => {
  const providers = [
    'Amazon Prime',
    'FedEx Express',
    'DHL Worldwide',
    'Uber Cab',
    'Noon eCommerce',
    'Zomato Delivery',
    'Talabat Delivery',
    'Deliveroo',
    'Careem Taxi',
  ]
  const serviceTypes = [
    'Plumber',
    'Electrician',
    'Carpenter',
    'AC Technician',
    'Cleaning Staff',
    'Maid',
    'Gardener',
    'Painter',
    'Pest Control',
  ]
  const [searchOpen, setSearchOpen] = useState(false)
  const [serviceSearchOpen, setServiceSearchOpen] = useState(false)

  const selectedDays = formData.selectedDays || [1, 2, 3, 4, 5]
  const serviceSelectedDays = formData.serviceSelectedDays || [1, 2, 3, 4, 5]

  return (
    <div className="card card-hover">
      <h3 style={{ fontSize: '18px', marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
        <i
          className="fa-solid fa-paper-plane"
          style={{ color: 'var(--primary)', marginRight: '8px' }}
        ></i>
        {inviteMethod === 'guest' && 'Personal Guest Pass'}
        {inviteMethod === 'group' && 'Group / Event Pass'}
        {inviteMethod === 'cab_delivery' && 'Cab & Delivery pre-entry'}
        {inviteMethod === 'service' && 'Maintenance Service Entry'}
      </h3>

      {(searchOpen || serviceSearchOpen) && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
          onClick={() => {
            setSearchOpen(false)
            setServiceSearchOpen(false)
          }}
        />
      )}

      <form onSubmit={handleCreatePass}>
        {inviteMethod === 'guest' && (
          <>
            {/* Toggle box / Segmented Switch for Pass Type */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setGuestPassType('default')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: guestPassType === 'default' ? '#fff' : 'transparent',
                  color:
                    guestPassType === 'default'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: guestPassType === 'default' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Default Pass
              </button>
              <button
                type="button"
                onClick={() => setGuestPassType('id_proof')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: guestPassType === 'id_proof' ? '#fff' : 'transparent',
                  color:
                    guestPassType === 'id_proof'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: guestPassType === 'id_proof' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                By ID Proof
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Guest Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. John Doe"
                value={formData.guestName || ''}
                onChange={(e) => handleInputChange('guestName', e.target.value)}
              />
            </div>

            {guestPassType === 'id_proof' && (
              <>
                <div className="form-group">
                  <label className="form-label">Select ID Proof Type</label>
                  <select
                    className="form-control"
                    value={formData.idProofType}
                    onChange={(e) => handleInputChange('idProofType', e.target.value)}
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Indian Passport">Indian Passport</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ID Proof Reference / Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ID Code / Serial"
                    value={formData.idProof}
                    onChange={(e) => handleInputChange('idProof', e.target.value)}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.startDate || ''}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.endDate || ''}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Usage Limit (Max entries)</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={formData.usageLimit || ''}
                onChange={(e) => handleInputChange('usageLimit', Number(e.target.value))}
              />
            </div>
          </>
        )}

        {inviteMethod === 'group' && (
          <>
            <div className="form-group">
              <label className="form-label">Event Name / Occasion</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Housewarming Party"
                value={formData.eventName || ''}
                onChange={(e) => handleInputChange('eventName', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Expected Tokens</label>
              <input
                type="number"
                className="form-control"
                min="1"
                value={formData.totalTokens || ''}
                onChange={(e) => handleInputChange('totalTokens', Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input
                type="date"
                className="form-control"
                value={formData.eventDate || ''}
                onChange={(e) => handleInputChange('eventDate', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.eventStartTime}
                  onChange={(e) => handleInputChange('eventStartTime', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={formData.eventEndTime}
                  onChange={(e) => handleInputChange('eventEndTime', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {inviteMethod === 'cab_delivery' && (
          <>
            {/* Toggle box for Usage Type */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setCabUsageType('one_time')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: cabUsageType === 'one_time' ? '#fff' : 'transparent',
                  color:
                    cabUsageType === 'one_time'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: cabUsageType === 'one_time' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                One-time Pass
              </button>
              <button
                type="button"
                onClick={() => setCabUsageType('multi_use')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: cabUsageType === 'multi_use' ? '#fff' : 'transparent',
                  color:
                    cabUsageType === 'multi_use'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: cabUsageType === 'multi_use' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Multi-use Pass
              </button>
            </div>

            {/* Cab / Taxi vs Delivery / Order Toggle */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                key="toggle-delivery"
                type="button"
                onClick={() => {
                  handleInputChange('cabCategory', 'delivery')
                  handleInputChange('vehicleNumber', '')
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor:
                    (formData.cabCategory || 'delivery') === 'delivery' ? '#fff' : 'transparent',
                  color:
                    (formData.cabCategory || 'delivery') === 'delivery'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow:
                    (formData.cabCategory || 'delivery') === 'delivery'
                      ? '0 1px 3px rgba(0,0,0,0.1)'
                      : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Delivery / Order
              </button>
              <button
                key="toggle-cab"
                type="button"
                onClick={() => {
                  handleInputChange('cabCategory', 'cab')
                  handleInputChange('orderId', '')
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: formData.cabCategory === 'cab' ? '#fff' : 'transparent',
                  color:
                    formData.cabCategory === 'cab'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: formData.cabCategory === 'cab' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Cab / Taxi
              </button>
            </div>

            {/* Search & Select Provider */}
            <div className="form-group" style={{ position: 'relative', zIndex: 10 }}>
              <label className="form-label">Delivery Provider / Cab Brand</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search & select provider..."
                value={formData.companyName || ''}
                onChange={(e) => {
                  handleInputChange('companyName', e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
              />
              {searchOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 20,
                    marginTop: '4px',
                  }}
                >
                  {providers
                    .filter(
                      (p) =>
                        !formData.companyName ||
                        p.toLowerCase().includes(formData.companyName.toLowerCase()),
                    )
                    .map((provider) => (
                      <div
                        key={provider}
                        onClick={() => {
                          handleInputChange('companyName', provider)
                          setSearchOpen(false)
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text-main)',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#fff')}
                      >
                        {provider}
                      </div>
                    ))}

                  {formData.companyName &&
                    !providers.some(
                      (p) => p.toLowerCase() === formData.companyName.trim().toLowerCase(),
                    ) && (
                      <div
                        onClick={() => setSearchOpen(false)}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: 'var(--primary, #0084FF)',
                          backgroundColor: '#F0F7FF',
                        }}
                      >
                        + Use custom provider: "{formData.companyName}"
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Conditional input fields */}
            {(formData.cabCategory || 'delivery') === 'delivery' ? (
              <div className="form-group">
                <label className="form-label">Order Reference ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. AMZ-199-082"
                  value={formData.orderId || ''}
                  onChange={(e) => handleInputChange('orderId', e.target.value)}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Taxi License Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. MH 12 AB 1234 or 22 BH 1234 AB"
                  value={formData.vehicleNumber || ''}
                  onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                />
              </div>
            )}

            {cabUsageType === 'one_time' ? (
              <div className="form-group">
                <label className="form-label">Expected Time Window</label>
                <select
                  className="form-control"
                  value={formData.timeWindow}
                  onChange={(e) => handleInputChange('timeWindow', e.target.value)}
                >
                  <option value="08:00 - 12:00">Morning (08:00 - 12:00)</option>
                  <option value="12:00 - 16:00">Afternoon (12:00 - 16:00)</option>
                  <option value="16:00 - 20:00">Evening (16:00 - 20:00)</option>
                  <option value="20:00 - 23:59">Night (20:00 - 23:59)</option>
                </select>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Active Days in Week</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 1, name: 'Mon' },
                      { id: 2, name: 'Tue' },
                      { id: 3, name: 'Wed' },
                      { id: 4, name: 'Thu' },
                      { id: 5, name: 'Fri' },
                      { id: 6, name: 'Sat' },
                      { id: 0, name: 'Sun' },
                    ].map((day) => {
                      const isDaySelected = selectedDays.includes(day.id)
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const nextDays = isDaySelected
                              ? selectedDays.filter((d) => d !== day.id)
                              : [...selectedDays, day.id]
                            handleInputChange('selectedDays', nextDays)
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            border: '1px solid',
                            borderColor: isDaySelected
                              ? 'var(--primary, #0084FF)'
                              : 'var(--border-light, #E2E8F0)',
                            backgroundColor: isDaySelected
                              ? 'var(--primary-light, #E5F3FF)'
                              : '#fff',
                            color: isDaySelected
                              ? 'var(--primary, #0084FF)'
                              : 'var(--text-muted, #64748B)',
                            cursor: 'pointer',
                            transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                          }}
                        >
                          {day.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Allowed Entry Time Windows</label>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '16px' }}
                      onClick={() => {
                        const current = formData.timeWindows || [
                          { start: formData.eventStartTime || '07:30', end: formData.eventEndTime || '09:00' },
                        ]
                        const updated = [...current, { start: '15:30', end: '17:00' }]
                        handleInputChange('timeWindows', updated)
                      }}
                    >
                      + Add Time Slot
                    </button>
                  </div>

                  {(formData.timeWindows && formData.timeWindows.length > 0
                    ? formData.timeWindows
                    : [{ start: formData.eventStartTime || '07:30', end: formData.eventEndTime || '19:00' }]
                  ).map((slot, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr auto',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '12px',
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
                          Slot #{idx + 1} Start
                        </label>
                        <input
                          type="time"
                          className="form-control"
                          value={slot.start}
                          onChange={(e) => {
                            const current = formData.timeWindows || [
                              { start: formData.eventStartTime || '07:30', end: formData.eventEndTime || '19:00' },
                            ]
                            const updated = current.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s))
                            handleInputChange('timeWindows', updated)
                            if (idx === 0) handleInputChange('eventStartTime', e.target.value)
                          }}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>
                          Slot #{idx + 1} End
                        </label>
                        <input
                          type="time"
                          className="form-control"
                          value={slot.end}
                          onChange={(e) => {
                            const current = formData.timeWindows || [
                              { start: formData.eventStartTime || '07:30', end: formData.eventEndTime || '19:00' },
                            ]
                            const updated = current.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s))
                            handleInputChange('timeWindows', updated)
                            if (idx === 0) handleInputChange('eventEndTime', e.target.value)
                          }}
                        />
                      </div>
                      {(formData.timeWindows || []).length > 1 && (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          style={{ padding: '6px 10px', height: '36px', marginTop: '18px', borderRadius: '6px' }}
                          onClick={() => {
                            const current = formData.timeWindows || []
                            const updated = current.filter((_, i) => i !== idx)
                            handleInputChange('timeWindows', updated)
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {inviteMethod === 'service' && (
          <>
            {/* Toggle box for Pass Type */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setServicePassType('default')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: servicePassType === 'default' ? '#fff' : 'transparent',
                  color:
                    servicePassType === 'default'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: servicePassType === 'default' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Default Pass
              </button>
              <button
                type="button"
                onClick={() => setServicePassType('id_proof')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: servicePassType === 'id_proof' ? '#fff' : 'transparent',
                  color:
                    servicePassType === 'id_proof'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: servicePassType === 'id_proof' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                By ID Proof
              </button>
            </div>

            {/* Toggle box for Usage Type */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => setServiceUsageType('one_time')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: serviceUsageType === 'one_time' ? '#fff' : 'transparent',
                  color:
                    serviceUsageType === 'one_time'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: serviceUsageType === 'one_time' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                One-time Pass
              </button>
              <button
                type="button"
                onClick={() => setServiceUsageType('multi_use')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: serviceUsageType === 'multi_use' ? '#fff' : 'transparent',
                  color:
                    serviceUsageType === 'multi_use'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow:
                    serviceUsageType === 'multi_use' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                Multi-use Pass
              </button>
            </div>

            {/* Search & Select Service Type */}
            <div className="form-group" style={{ position: 'relative', zIndex: 10 }}>
              <label className="form-label">Service Type</label>
              <input
                type="text"
                className="form-control"
                placeholder="Search & select service type..."
                value={formData.serviceType || ''}
                onChange={(e) => {
                  handleInputChange('serviceType', e.target.value)
                  setServiceSearchOpen(true)
                }}
                onFocus={() => setServiceSearchOpen(true)}
              />
              {serviceSearchOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    maxHeight: '160px',
                    overflowY: 'auto',
                    zIndex: 20,
                    marginTop: '4px',
                  }}
                >
                  {serviceTypes
                    .filter(
                      (s) =>
                        !formData.serviceType ||
                        s.toLowerCase().includes(formData.serviceType.toLowerCase()),
                    )
                    .map((service) => (
                      <div
                        key={service}
                        onClick={() => {
                          handleInputChange('serviceType', service)
                          setServiceSearchOpen(false)
                        }}
                        style={{
                          padding: '10px 16px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text-main)',
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={(e) => (e.target.style.backgroundColor = '#fff')}
                      >
                        {service}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Staff Name / Agency Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Mike from Urban Company"
                value={formData.providerName}
                onChange={(e) => handleInputChange('providerName', e.target.value)}
              />
            </div>

            {servicePassType === 'id_proof' && (
              <>
                <div className="form-group">
                  <label className="form-label">Select ID Proof Type</label>
                  <select
                    className="form-control"
                    value={formData.idProofType}
                    onChange={(e) => handleInputChange('idProofType', e.target.value)}
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Indian Passport">Indian Passport</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">ID Proof Reference / Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ID Code / Serial"
                    value={formData.idProof}
                    onChange={(e) => handleInputChange('idProof', e.target.value)}
                  />
                </div>
              </>
            )}

            {serviceUsageType === 'multi_use' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Active Days in Week</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { id: 1, name: 'Mon' },
                      { id: 2, name: 'Tue' },
                      { id: 3, name: 'Wed' },
                      { id: 4, name: 'Thu' },
                      { id: 5, name: 'Fri' },
                      { id: 6, name: 'Sat' },
                      { id: 0, name: 'Sun' },
                    ].map((day) => {
                      const isDaySelected = serviceSelectedDays.includes(day.id)
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            const nextDays = isDaySelected
                              ? serviceSelectedDays.filter((d) => d !== day.id)
                              : [...serviceSelectedDays, day.id]
                            handleInputChange('serviceSelectedDays', nextDays)
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            border: '1px solid',
                            borderColor: isDaySelected
                              ? 'var(--primary, #0084FF)'
                              : 'var(--border-light, #E2E8F0)',
                            backgroundColor: isDaySelected
                              ? 'var(--primary-light, #E5F3FF)'
                              : '#fff',
                            color: isDaySelected
                              ? 'var(--primary, #0084FF)'
                              : 'var(--text-muted, #64748B)',
                            cursor: 'pointer',
                            transition: 'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                          }}
                        >
                          {day.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.eventStartTime}
                      onChange={(e) => handleInputChange('eventStartTime', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.eventEndTime}
                      onChange={(e) => handleInputChange('eventEndTime', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
              <input
                type="checkbox"
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                checked={formData.intercomAlert}
                onChange={(e) => handleInputChange('intercomAlert', e.target.checked)}
              />
              <label
                style={{
                  fontSize: '14px',
                  color: 'var(--text-main)',
                  fontWeight: '500',
                  marginBottom: 0,
                }}
              >
                Enable intercom call verification alert
              </label>
            </div>
          </>
        )}

        <button type="submit" className="btn btn-primary w-100" style={{ marginTop: '24px' }}>
          Generate Invitation Code
        </button>
      </form>
    </div>
  )
}

export default InvitationForm
