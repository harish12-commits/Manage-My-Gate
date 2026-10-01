import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CFormLabel, CFormInput, CButton, CFormSelect } from '@coreui/react'

export const GuardInviteVisitorForm = ({
  dbVillas = [],
  dbUsers = [],
  loadingDirectory = false,
  onInitiateWalkIn,
  onCheckInSuccess,
}) => {
  // Visitor Details
  const [visitorName, setVisitorName] = useState('')
  const [walkInType, setWalkInType] = useState('id_proof') // 'id_proof' | 'vehicle'
  const [idProofType, setIdProofType] = useState('Aadhaar Card')
  const [idProofNumber, setIdProofNumber] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  // Host Selection States
  const [inviteMethod, setInviteMethod] = useState('villa') // 'villa' | 'admin'

  // Selected Host Targets
  const [selectedVillaId, setSelectedVillaId] = useState('')
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [adminSearch, setAdminSearch] = useState('')

  // Derived filtered lists
  const residentsOfSelectedVilla = dbUsers.filter((u) => u.villaId === selectedVillaId)

  const communityAdmins = dbUsers.filter(
    (u) => u.role === 'Community Admin' || u.role?.toLowerCase().includes('admin'),
  )

  const filteredAdmins = communityAdmins.filter(
    (admin) =>
      admin.name?.toLowerCase().includes(adminSearch.toLowerCase()) ||
      admin.email?.toLowerCase().includes(adminSearch.toLowerCase()),
  )

  // Auto select default resident or admin
  useEffect(() => {
    if (residentsOfSelectedVilla.length > 0) {
      setSelectedResidentId(residentsOfSelectedVilla[0].id)
    } else {
      setSelectedResidentId('')
    }
  }, [selectedVillaId, dbUsers])

  useEffect(() => {
    if (communityAdmins.length > 0) {
      setSelectedAdminId(communityAdmins[0].id)
    } else {
      setSelectedAdminId('')
    }
  }, [inviteMethod, dbUsers])

  const validateIdProof = (type, number) => {
    if (!number?.trim()) {
      return 'ID Proof Reference / Number is required.'
    }
    const val = number.trim()
    switch (type) {
      case 'Aadhaar Card': {
        const aadhaarRegex = /^\d{4}\s?\d{4}\s?\d{4}$/
        if (!aadhaarRegex.test(val)) {
          return 'Invalid Aadhaar Card format. Expected 12 digits (e.g., 1234 5678 9012).'
        }
        break
      }
      case 'PAN Card': {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i
        if (!panRegex.test(val)) {
          return 'Invalid PAN Card format. Expected 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F).'
        }
        break
      }
      case 'Driving License': {
        const cleaned = val.replace(/[\s-]/g, '')
        const dlRegex = /^[A-Z]{2}\d{13}$/i
        if (!dlRegex.test(cleaned)) {
          return 'Invalid Driving License format. Expected standard Indian DL format with 15 characters (e.g., MH1220181234567).'
        }
        break
      }
      case 'Voter ID': {
        const voterRegex = /^[A-Z]{3}\d{7}$/i
        if (!voterRegex.test(val)) {
          return 'Invalid Voter ID format. Expected 3 letters followed by 7 digits (e.g., XYZ1234567).'
        }
        break
      }
      case 'Indian Passport': {
        const passportRegex = /^[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]$/
        if (!passportRegex.test(val)) {
          return 'Invalid Indian Passport format.'
        }
        break
      }
      default:
        break
    }
    return null
  }

  const validateVehiclePlate = (plate) => {
    if (!plate?.trim()) {
      return 'Vehicle Plate Number is required.'
    }
    const cleanedPlateForRegex = plate.replace(/[\s-]/g, '')
    const licensePlateRegex =
      /^([A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}|\d{2}[ -]?BH[ -]?\d{4}[ -]?[A-Z]{1,2})$/i
    if (!licensePlateRegex.test(cleanedPlateForRegex)) {
      return 'Invalid vehicle number plate format. Must be a valid Indian state plate (e.g. MH-12-AB-1234) or BH series (e.g. 22-BH-1234-AB).'
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!visitorName.trim()) {
      toast.error('Visitor Name is required.')
      return
    }

    if (walkInType === 'id_proof') {
      const errorMsg = validateIdProof(idProofType, idProofNumber)
      if (errorMsg) {
        toast.error(errorMsg)
        return
      }
    } else {
      const errorMsg = validateVehiclePlate(vehicleNumber)
      if (errorMsg) {
        toast.error(errorMsg)
        return
      }
    }

    const targetHostId = inviteMethod === 'villa' ? selectedResidentId : selectedAdminId
    if (!targetHostId) {
      toast.error('Please select a resident or administrator to approve the entry.')
      return
    }

    const payload = {
      residentId: targetHostId,
      snapshot: {
        visitorName: visitorName.trim(),
        idProofNumber:
          walkInType === 'id_proof' ? `${idProofType}: ${idProofNumber.trim()}` : undefined,
        vehicleNumber: walkInType === 'vehicle' ? vehicleNumber.trim().toUpperCase() : undefined,
      },
    }

    try {
      const res = await onInitiateWalkIn(payload)
      if (res && res.success) {
        // Reset form
        setVisitorName('')
        setIdProofType('Aadhaar Card')
        setIdProofNumber('')
        setVehicleNumber('')
        setSelectedVillaId('')
        setAdminSearch('')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to initiate walk-in request.')
    }
  }

  return (
    <div className="card invite-form-card">
      <h3 className="invite-form-title">
        <i
          className="fa-solid fa-user-plus"
          style={{ color: 'var(--primary)', marginRight: '8px' }}
        ></i>
        Invite Walk-in Visitor
      </h3>

      <form onSubmit={handleSubmit} className="row g-4">
        {/* Left Column: Visitor Info */}
        <div className="col-md-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <CFormLabel
              htmlFor="visitor-name-input"
              style={{ fontWeight: '600', fontSize: '13px' }}
            >
              Visitor Full Name *
            </CFormLabel>
            <CFormInput
              id="visitor-name-input"
              type="text"
              placeholder="e.g. David Smith"
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              required
            />
          </div>

          {/* Segmented Verification Method Switch */}
          <div>
            <CFormLabel style={{ fontWeight: '600', fontSize: '13px', marginBottom: '8px' }}>
              Verification Method
            </CFormLabel>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                backgroundColor: '#F1F5F9',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setWalkInType('id_proof')
                  setVehicleNumber('')
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: walkInType === 'id_proof' ? '#fff' : 'transparent',
                  color:
                    walkInType === 'id_proof'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: walkInType === 'id_proof' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition:
                    'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                By ID Proof
              </button>
              <button
                type="button"
                onClick={() => {
                  setWalkInType('vehicle')
                  setIdProofNumber('')
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: 'none',
                  backgroundColor: walkInType === 'vehicle' ? '#fff' : 'transparent',
                  color:
                    walkInType === 'vehicle'
                      ? 'var(--primary, #0084FF)'
                      : 'var(--text-muted, #64748B)',
                  boxShadow: walkInType === 'vehicle' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition:
                    'color 0.2s, background-color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s, opacity 0.2s, width 0.2s, height 0.2s, max-height 0.2s',
                }}
              >
                By Vehicle Plate
              </button>
            </div>
          </div>

          <div
            style={{
              minHeight: '170px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
            }}
          >
            {walkInType === 'id_proof' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <CFormLabel
                    htmlFor="id-proof-type-select"
                    style={{ fontWeight: '600', fontSize: '13px' }}
                  >
                    Select ID Proof Type *
                  </CFormLabel>
                  <CFormSelect
                    id="id-proof-type-select"
                    value={idProofType}
                    onChange={(e) => {
                      setIdProofType(e.target.value)
                      setIdProofNumber('')
                    }}
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Indian Passport">Indian Passport</option>
                  </CFormSelect>
                </div>

                <div>
                  <CFormLabel
                    htmlFor="visitor-id-input"
                    style={{ fontWeight: '600', fontSize: '13px' }}
                  >
                    {idProofType} Reference Number *
                  </CFormLabel>
                  <CFormInput
                    id="visitor-id-input"
                    type="text"
                    placeholder={`Enter valid ${idProofType} number`}
                    value={idProofNumber}
                    onChange={(e) => setIdProofNumber(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <CFormLabel
                  htmlFor="visitor-plate-input"
                  style={{ fontWeight: '600', fontSize: '13px' }}
                >
                  Vehicle Plate Number *
                </CFormLabel>
                <CFormInput
                  id="visitor-plate-input"
                  type="text"
                  placeholder="e.g. MH-12-AB-1234 or 22-BH-1234-AB"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Host Selection */}
        <div className="col-md-6 invite-host-sidebar">
          <CFormLabel style={{ fontWeight: '600', fontSize: '13px', marginBottom: '12px' }}>
            Choose Approval Target
          </CFormLabel>

          {/* Toggle buttons */}
          <div className="invite-toggle-btns">
            <CButton
              type="button"
              color={inviteMethod === 'villa' ? 'primary' : 'light'}
              onClick={() => setInviteMethod('villa')}
              style={{ flex: 1, fontWeight: '600', fontSize: '13px' }}
            >
              <i className="fa-solid fa-home" style={{ marginRight: '6px' }}></i>
              Invite by Villa
            </CButton>
            <CButton
              type="button"
              color={inviteMethod === 'admin' ? 'primary' : 'light'}
              onClick={() => setInviteMethod('admin')}
              style={{ flex: 1, fontWeight: '600', fontSize: '13px' }}
            >
              <i className="fa-solid fa-user-shield" style={{ marginRight: '6px' }}></i>
              Invite for Admin
            </CButton>
          </div>

          {inviteMethod === 'villa' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="position-relative">
                <CFormLabel
                  htmlFor="villa-select-box"
                  style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  Select Destination Villa / Unit
                </CFormLabel>
                <div className="dropdown w-100">
                  <button
                    id="villa-select-box"
                    className="form-control text-start d-flex justify-content-between align-items-center bg-white"
                    type="button"
                    data-coreui-toggle="dropdown"
                    aria-expanded="false"
                    disabled={loadingDirectory}
                    onClick={(e) => {
                      const menu = e.currentTarget.nextElementSibling
                      if (menu.classList.contains('show')) {
                        menu.classList.remove('show')
                      } else {
                        menu.classList.add('show')
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span>
                      {selectedVillaId
                        ? (() => {
                            const v = dbVillas.find((v) => v._id === selectedVillaId)
                            const uName = v.unitNumber || v.villaNumber
                            const bName = v.blockOrBuilding || v.block
                            return v
                              ? `${uName} ${bName ? `(${bName})` : ''}`
                              : '-- Choose a Villa --'
                          })()
                        : '-- Choose a Villa --'}
                    </span>
                    <span
                      className="caret"
                      style={{
                        display: 'inline-block',
                        width: '0',
                        height: '0',
                        marginLeft: '4px',
                        verticalAlign: 'middle',
                        borderTop: '5px solid var(--text-muted)',
                        borderRight: '5px solid transparent',
                        borderLeft: '5px solid transparent',
                      }}
                    ></span>
                  </button>
                  <ul
                    className="dropdown-menu w-100 shadow-sm m-0 p-1"
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      position: 'absolute',
                      top: '100%',
                      left: '0',
                      zIndex: 9999,
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <li>
                      <button
                        className="dropdown-item"
                        type="button"
                        style={{ padding: '10px 16px', fontSize: '14px', borderRadius: '6px' }}
                        onClick={(e) => {
                          setSelectedVillaId('')
                          e.currentTarget.closest('.dropdown-menu').classList.remove('show')
                        }}
                      >
                        -- Choose a Villa --
                      </button>
                    </li>
                    {dbVillas.map((villa) => (
                      <li key={villa._id}>
                        <button
                          className="dropdown-item"
                          type="button"
                          style={{ padding: '10px 16px', fontSize: '14px', borderRadius: '6px' }}
                          onClick={(e) => {
                            setSelectedVillaId(villa._id)
                            e.currentTarget.closest('.dropdown-menu').classList.remove('show')
                          }}
                        >
                          {villa.unitNumber || villa.villaNumber}{' '}
                          {villa.blockOrBuilding || villa.block
                            ? `(${villa.blockOrBuilding || villa.block})`
                            : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Select Resident */}
              {selectedVillaId && (
                <div>
                  <CFormLabel
                    style={{
                      fontWeight: '600',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                    }}
                  >
                    Select Resident to Notify
                  </CFormLabel>
                  {residentsOfSelectedVilla.length === 0 ? (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--danger)',
                        padding: '6px',
                        backgroundColor: '#FEF2F2',
                        borderRadius: '6px',
                      }}
                    >
                      No registered occupants found in this Villa.
                    </div>
                  ) : (
                    <div className="selection-scroll-container">
                      {residentsOfSelectedVilla.map((r) => (
                        <label
                          key={r.id}
                          className={`selection-radio-label ${selectedResidentId === r.id ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="residentSelect"
                            value={r.id}
                            checked={selectedResidentId === r.id}
                            onChange={() => setSelectedResidentId(r.id)}
                          />
                          <div>
                            <div style={{ fontWeight: '700' }}>{r.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                              {r.residentType}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Admin Search */}
              <div>
                <CFormLabel
                  htmlFor="admin-search-input"
                  style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  Search Community Admin Role
                </CFormLabel>
                <CFormInput
                  id="admin-search-input"
                  type="text"
                  placeholder="Type name/email to search..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
              </div>

              {/* Admins List selection */}
              <div>
                <CFormLabel
                  style={{
                    fontWeight: '600',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                  }}
                >
                  Select Admin to Approve Request
                </CFormLabel>
                {filteredAdmins.length === 0 ? (
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      padding: '12px',
                      border: '1px dashed var(--border-light)',
                      textAlign: 'center',
                    }}
                  >
                    No administrators found.
                  </div>
                ) : (
                  <div className="selection-scroll-container">
                    {filteredAdmins.map((admin) => (
                      <label
                        key={admin.id}
                        className={`selection-radio-label ${selectedAdminId === admin.id ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="adminSelect"
                          value={admin.id}
                          checked={selectedAdminId === admin.id}
                          onChange={() => setSelectedAdminId(admin.id)}
                        />
                        <div>
                          <div style={{ fontWeight: '700' }}>{admin.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                            {admin.email}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Submit */}
        <div className="col-12 invite-form-footer">
          <CButton
            type="submit"
            color="primary"
            disabled={
              !visitorName.trim() ||
              (inviteMethod === 'villa' ? !selectedResidentId : !selectedAdminId)
            }
            style={{ fontWeight: '700', padding: '10px 24px' }}
          >
            <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }}></i>
            Send Approval Request
          </CButton>
        </div>
      </form>
    </div>
  )
}

export default GuardInviteVisitorForm
