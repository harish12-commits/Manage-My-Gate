import React, { useEffect, useState } from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling.js'
import { renewSubscription } from '../../services/platformBillingService.js'
import { toast } from 'react-hot-toast'

const ALL_AVAILABLE_FEATURES = [
  { code: 'visitor', name: 'Visitor Management', isBase: true },
  { code: 'villas', name: 'Unit & Villa Management', isBase: true },
  { code: 'users', name: 'User Management', isBase: true },
  { code: 'roles', name: 'Role Builder & RBAC', isBase: true },
  { code: 'complaints', name: 'Helpdesk & Complaints', isBase: true },
  { code: 'billing', name: 'Billing & Collection', isBase: false },
  { code: 'notices', name: 'Digital Notice Board', isBase: false },
  { code: 'amenities', name: 'Amenities & Booking', isBase: false },
  { code: 'integrations', name: 'Integration Hub', isBase: false },
]

const SubscriptionManagerView = () => {
  const { subscriptions = [], fetchAllData } = usePlatformBilling()
  const [selectedSub, setSelectedSub] = useState(null)
  const [renewSub, setRenewSub] = useState(null)
  const [renewalCycle, setRenewalCycle] = useState('YEARLY') // 'MONTHLY', 'SIX_MONTHS', 'YEARLY', 'CUSTOM'
  const [customMonths, setCustomMonths] = useState('')
  const [customYears, setCustomYears] = useState('')
  const [isRenewing, setIsRenewing] = useState(false)

  const [featureCheckboxes, setFeatureCheckboxes] = useState({
    visitor: true,
    villas: true,
    users: true,
    roles: true,
    complaints: true,
    billing: true,
    notices: false,
    amenities: false,
    integrations: false,
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch (e) {
      return dateStr
    }
  }

  const handleOpenRenewModal = (item) => {
    setRenewSub(item)
    setRenewalCycle(item.billingFrequency || 'YEARLY')
    setCustomMonths('')
    setCustomYears('')

    const existingFeatures = item.organizationId?.allowedFeatures ||
      item.entitlementProfile?.selectedAddOns || [
        'visitor',
        'villas',
        'users',
        'roles',
        'complaints',
        'billing',
      ]
    const featureKeys = Array.isArray(existingFeatures)
      ? existingFeatures.map((f) => (typeof f === 'string' ? f : f.code || f.key || f.name))
      : []

    setFeatureCheckboxes({
      visitor: featureKeys.length === 0 ? true : featureKeys.includes('visitor'),
      villas: featureKeys.length === 0 ? true : featureKeys.includes('villas'),
      users: featureKeys.length === 0 ? true : featureKeys.includes('users'),
      roles: featureKeys.length === 0 ? true : featureKeys.includes('roles'),
      complaints: featureKeys.length === 0 ? true : featureKeys.includes('complaints'),
      billing: featureKeys.includes('billing'),
      notices: featureKeys.includes('notices'),
      amenities: featureKeys.includes('amenities'),
      integrations: featureKeys.includes('integrations'),
    })
  }

  const handleToggleFeature = (code) => {
    setFeatureCheckboxes((prev) => ({
      ...prev,
      [code]: !prev[code],
    }))
  }

  const handleConfirmRenewal = async () => {
    if (!renewSub) return
    try {
      setIsRenewing(true)
      const subId = renewSub._id || renewSub.id
      const selectedFeatureKeys = Object.keys(featureCheckboxes).filter((k) => featureCheckboxes[k])

      toast.loading('Processing subscription renewal & updating feature access...', {
        id: 'renew-sub',
      })

      await renewSubscription(subId, {
        billingFrequency: renewalCycle,
        customMonths: customMonths ? parseInt(customMonths, 10) : 0,
        customYears: customYears ? parseInt(customYears, 10) : 0,
        planName: renewSub.planName || renewSub.tier || 'COMMUNITY_STARTER',
        organizationId: renewSub.organizationId?._id || renewSub.organizationId,
        allowedFeatures: selectedFeatureKeys,
      })

      toast.success('Subscription renewed & feature entitlements updated successfully!', {
        id: 'renew-sub',
      })
      setRenewSub(null)
      await fetchAllData()
    } catch (err) {
      toast.error('Failed to renew subscription: ' + (err.message || 'Error occurred'), {
        id: 'renew-sub',
      })
    } finally {
      setIsRenewing(false)
    }
  }

  const calculateNewExpiryDate = (currentEndDate, cycle, monthsStr, yearsStr) => {
    const base = currentEndDate ? new Date(currentEndDate) : new Date()
    const newDate = new Date(base)

    const m = parseInt(monthsStr, 10) || 0
    const y = parseInt(yearsStr, 10) || 0

    if (m > 0 || y > 0) {
      if (y > 0) newDate.setFullYear(newDate.getFullYear() + y)
      if (m > 0) newDate.setMonth(newDate.getMonth() + m)
    } else if (cycle === 'MONTHLY') {
      newDate.setMonth(newDate.getMonth() + 1)
    } else if (cycle === 'SIX_MONTHS') {
      newDate.setMonth(newDate.getMonth() + 6)
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1)
    }
    return formatDate(newDate)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Active Subscriptions</h1>
          <div className="sub">
            Tenant feature access, free trial periods, custom duration renewals, and module
            entitlement configuration.
          </div>
        </div>
      </div>

      <div className="panel panel-body table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Subscription #</th>
              <th>Organization</th>
              <th>Plan Type</th>
              <th>Free Trial</th>
              <th>Start Date</th>
              <th>End / Renewal Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((item, idx) => {
              const orgName =
                item.organizationId?.name ||
                item.organizationName ||
                item.communitySnapshot?.organizationName ||
                item.customerSnapshot?.organizationName ||
                item.inquiryId?.organizationName ||
                'Your Organization'
              const isTrial = item.status === 'TRIALING' || item.isTrial
              const trialText = isTrial ? '14 Days Free Trial (Active)' : 'Trial Completed'

              return (
                <tr key={item._id || idx}>
                  <td>
                    <strong>{item.subscriptionNumber || item._id}</strong>
                  </td>
                  <td>{orgName}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                      }}
                    >
                      {item.planName || item.tier || 'COMMUNITY_STARTER'} (
                      {item.billingFrequency || 'YEARLY'})
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${isTrial ? 'blue' : 'green'}`}>{trialText}</span>
                  </td>
                  <td>{formatDate(item.startDate || item.trialStartDate || item.createdAt)}</td>
                  <td>
                    <strong>
                      {formatDate(item.endDate || item.renewalDate || item.trialEndDate)}
                    </strong>
                  </td>
                  <td>
                    <span
                      className={`badge ${item.status === 'TRIALING' ? 'blue' : item.status === 'ACTIVE' ? 'green' : 'red'}`}
                    >
                      {item.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn small"
                        style={{
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                        }}
                        onClick={() => setSelectedSub(item)}
                      >
                        Entitlements
                      </button>
                      <button
                        className="btn small primary"
                        style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none' }}
                        onClick={() => handleOpenRenewModal(item)}
                      >
                        ⚡ Renew Plan
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {subscriptions.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                  No subscriptions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Entitlements Details Modal */}
      {selectedSub && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="panel"
            style={{
              width: '580px',
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '12px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>
                Subscription Details & Entitlements
              </h2>
              <button
                onClick={() => setSelectedSub(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#334155' }}>
              <div>
                <strong>Organization Name:</strong>{' '}
                {selectedSub.organizationId?.name ||
                  selectedSub.organizationName ||
                  selectedSub.communitySnapshot?.organizationName ||
                  selectedSub.customerSnapshot?.organizationName ||
                  'Your Organization'}
              </div>
              <div>
                <strong>Active Plan:</strong>{' '}
                {selectedSub.planName || selectedSub.tier || 'COMMUNITY_STARTER'}
              </div>
              <div>
                <strong>Billing Frequency:</strong> {selectedSub.billingFrequency || 'YEARLY'}
              </div>
              <div>
                <strong>Subscription Status:</strong>{' '}
                <span className={`badge ${selectedSub.status === 'TRIALING' ? 'blue' : 'green'}`}>
                  {selectedSub.status || 'ACTIVE'}
                </span>
              </div>
              <div>
                <strong>Free Trial Status:</strong>{' '}
                {selectedSub.status === 'TRIALING'
                  ? '14 Days Free Trial (Active)'
                  : 'Trial Completed'}
              </div>
              <div>
                <strong>Subscription Start Date:</strong>{' '}
                {formatDate(
                  selectedSub.startDate || selectedSub.trialStartDate || selectedSub.createdAt,
                )}
              </div>
              <div>
                <strong>Subscription End / Renewal Date:</strong>{' '}
                {formatDate(
                  selectedSub.endDate || selectedSub.renewalDate || selectedSub.trialEndDate,
                )}
              </div>

              <div
                style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}
              >
                <strong>Enabled Module Entitlements:</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {(
                  selectedSub.organizationId?.allowedFeatures ||
                  selectedSub.entitlementProfile?.selectedAddOns || [
                    'visitor',
                    'villas',
                    'users',
                    'roles',
                    'complaints',
                    'billing',
                  ]
                ).map((mod) => {
                  const label = typeof mod === 'string' ? mod : mod.name || mod.code
                  return (
                    <span
                      key={label}
                      className="badge green"
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      ✓ {label}
                    </span>
                  )
                })}
              </div>
            </div>
            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn primary" onClick={() => setSelectedSub(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Subscription Modal with Custom Duration & Feature Select/Deselect */}
      {renewSub && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          <div
            className="panel"
            style={{
              width: '620px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '1px solid #e2e8f0',
                paddingBottom: '14px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>
                ⚡ Renew Subscription & Update Features
              </h2>
              <button
                onClick={() => setRenewSub(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            {/* Organization Meta Banner */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '14px', color: '#334155', marginBottom: '6px' }}>
                Organization:{' '}
                <strong style={{ color: '#0f172a' }}>
                  {renewSub.organizationId?.name ||
                    renewSub.organizationName ||
                    renewSub.communitySnapshot?.organizationName ||
                    'Your Organization'}
                </strong>
              </div>
              <div style={{ fontSize: '14px', color: '#334155', marginBottom: '6px' }}>
                Current Subscription #:{' '}
                <strong style={{ fontFamily: 'monospace' }}>
                  {renewSub.subscriptionNumber || renewSub._id}
                </strong>
              </div>
              <div style={{ fontSize: '14px', color: '#334155' }}>
                Current Expiry Date:{' '}
                <strong style={{ color: '#dc2626' }}>
                  {formatDate(renewSub.endDate || renewSub.renewalDate)}
                </strong>
              </div>
            </div>

            {/* 1. Subscription Renewal Cycle Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#0f172a',
                  marginBottom: '10px',
                }}
              >
                1. Select Subscription Renewal Cycle:
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '10px',
                  marginBottom: '14px',
                }}
              >
                <div
                  onClick={() => {
                    setRenewalCycle('MONTHLY')
                    setCustomMonths('')
                    setCustomYears('')
                  }}
                  style={{
                    border:
                      renewalCycle === 'MONTHLY' && !customMonths && !customYears
                        ? '2px solid #2563eb'
                        : '1px solid #cbd5e1',
                    backgroundColor:
                      renewalCycle === 'MONTHLY' && !customMonths && !customYears
                        ? '#eff6ff'
                        : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>Monthly</div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#2563eb',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    ₹15,500/mo
                  </div>
                </div>

                <div
                  onClick={() => {
                    setRenewalCycle('SIX_MONTHS')
                    setCustomMonths('')
                    setCustomYears('')
                  }}
                  style={{
                    border:
                      renewalCycle === 'SIX_MONTHS' && !customMonths && !customYears
                        ? '2px solid #2563eb'
                        : '1px solid #cbd5e1',
                    backgroundColor:
                      renewalCycle === 'SIX_MONTHS' && !customMonths && !customYears
                        ? '#eff6ff'
                        : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>
                    6 Months
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#2563eb',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    ₹93,150
                  </div>
                </div>

                <div
                  onClick={() => {
                    setRenewalCycle('YEARLY')
                    setCustomMonths('')
                    setCustomYears('')
                  }}
                  style={{
                    border:
                      renewalCycle === 'YEARLY' && !customMonths && !customYears
                        ? '2px solid #2563eb'
                        : '1px solid #cbd5e1',
                    backgroundColor:
                      renewalCycle === 'YEARLY' && !customMonths && !customYears
                        ? '#eff6ff'
                        : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>
                    Annual (Yearly)
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#16a34a',
                      fontWeight: 700,
                      marginTop: '2px',
                    }}
                  >
                    15% Discount
                  </div>
                </div>

                <div
                  onClick={() => setRenewalCycle('CUSTOM')}
                  style={{
                    border:
                      renewalCycle === 'CUSTOM' || customMonths || customYears
                        ? '2px solid #2563eb'
                        : '1px solid #cbd5e1',
                    backgroundColor:
                      renewalCycle === 'CUSTOM' || customMonths || customYears
                        ? '#eff6ff'
                        : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>
                    Custom Term
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Manual Inputs
                  </div>
                </div>
              </div>

              {/* Manual Month / Year Inputs */}
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    📅 Manual Duration (Months):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    placeholder="e.g. 3, 6, 18"
                    value={customMonths}
                    onChange={(e) => {
                      setCustomMonths(e.target.value)
                      if (e.target.value) setRenewalCycle('CUSTOM')
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    🗓️ Manual Duration (Years):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="e.g. 1, 2, 3"
                    value={customYears}
                    onChange={(e) => {
                      setCustomYears(e.target.value)
                      if (e.target.value) setRenewalCycle('CUSTOM')
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Feature Add-ons Configurator (Select / Deselect) */}
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#0f172a',
                  marginBottom: '10px',
                }}
              >
                2. Configure Subscription Features & Module Access (Select / Deselect):
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {ALL_AVAILABLE_FEATURES.map((feat) => {
                  const isChecked = featureCheckboxes[feat.code] ?? true
                  return (
                    <label
                      key={feat.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: isChecked ? '#0f172a' : '#64748b',
                        fontWeight: isChecked ? 600 : 400,
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: isChecked ? '#ffffff' : 'transparent',
                        border: isChecked ? '1px solid #bfdbfe' : '1px transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFeature(feat.code)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span>{feat.name}</span>
                      {feat.isBase && (
                        <span
                          style={{
                            fontSize: '10px',
                            backgroundColor: '#e2e8f0',
                            color: '#475569',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: 'auto',
                          }}
                        >
                          Base
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Calculated New Extended Expiry Date */}
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '16px',
                borderRadius: '10px',
                marginBottom: '24px',
              }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: '14px', color: '#065f46', fontWeight: 600 }}>
                  New Extended Expiry Date:
                </span>
                <strong style={{ fontSize: '16px', color: '#047857' }}>
                  {calculateNewExpiryDate(
                    renewSub.endDate || renewSub.renewalDate,
                    renewalCycle,
                    customMonths,
                    customYears,
                  )}
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  padding: '10px 18px',
                  borderRadius: '8px',
                }}
                onClick={() => setRenewSub(null)}
                disabled={isRenewing}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                }}
                onClick={handleConfirmRenewal}
                disabled={isRenewing}
              >
                {isRenewing ? 'Processing Renewal...' : '⚡ Confirm Renewal & Update Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default SubscriptionManagerView
