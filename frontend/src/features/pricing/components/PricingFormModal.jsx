import React, { useState, useEffect } from 'react'

// Utility to generate slug
const generateSlug = (text) =>
  text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

const PricingFormModal = ({ isOpen, onClose, initialData, onSubmit }) => {
  const [formData, setFormData] = useState({
    planCode: '',
    name: '',
    type: 'BASE_PLAN',
    pricingModel: 'FLAT',
    basePrice: 0,
    unitPrice: 0,
    billingInterval: 'MONTHLY',
    features: [],
    status: 'ACTIVE',
    maxAgentDiscountPercent: 10,
    setupFee: 0,
    freeTrialDuration: 0,
  })

  const [isCodeManual, setIsCodeManual] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialData && initialData._id) {
      setFormData(initialData)
      setIsCodeManual(true)
    } else {
      setFormData({
        planCode: '',
        name: '',
        type: initialData?.type || 'BASE_PLAN',
        pricingModel: 'FLAT',
        basePrice: 0,
        unitPrice: 0,
        billingInterval: 'MONTHLY',
        features: [],
        status: 'ACTIVE',
        maxAgentDiscountPercent: 10,
        setupFee: 0,
        freeTrialDuration: 0,
      })
      setIsCodeManual(false)
    }
  }, [initialData, isOpen])

  const handleNameChange = (e) => {
    const newName = e.target.value
    setFormData((prev) => {
      const updates = { name: newName }
      if (!isCodeManual && !initialData) {
        updates.planCode = generateSlug(newName)
      }
      return { ...prev, ...updates }
    })
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
    if (name === 'planCode') setIsCodeManual(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(formData)
    setSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop open" style={{ zIndex: 99999 }}>
      <div className="modal" role="dialog" aria-labelledby="planModalTitle">
        <div className="modal-head">
          <h2 id="planModalTitle">{initialData ? 'Edit Pricing Plan' : 'Create Pricing Plan'}</h2>
          <button type="button" className="btn small" onClick={onClose} disabled={submitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="modal-body field-grid">
            <div className="field">
              <label>Plan Name</label>
              <input
                type="text"
                name="name"
                className="input"
                value={formData.name}
                onChange={handleNameChange}
                required
              />
            </div>

            <div className="field" style={{ display: 'none' }}>
              <label>
                Plan Code{' '}
                <span className="text-xs text-muted">(Auto-generated. Edit to override)</span>
              </label>
              <input
                type="text"
                name="planCode"
                className="input font-monospace"
                value={formData.planCode}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Type</label>
              <select name="type" className="select" value={formData.type} onChange={handleChange}>
                <option value="BASE_PLAN">Base Plan</option>
                <option value="UNIT_ADDON">Unit Add-on</option>
                <option value="FEATURE_ADDON">Feature Add-on</option>
              </select>
            </div>

            <div className="field">
              <label>Pricing Model</label>
              <select
                name="pricingModel"
                className="select"
                value={formData.pricingModel}
                onChange={handleChange}
              >
                <option value="FLAT">Flat</option>
                <option value="PER_UNIT">Per Unit</option>
                <option value="TIERED">Tiered</option>
              </select>
            </div>

            <div className="field">
              <label>Base Price (₹)</label>
              <input
                type="number"
                name="basePrice"
                className="input"
                min="0"
                value={formData.basePrice}
                onChange={handleChange}
                required
              />
            </div>

            {(formData.pricingModel === 'PER_UNIT' || formData.pricingModel === 'TIERED') && (
              <div className="field">
                <label>Unit Price (₹)</label>
                <input
                  type="number"
                  name="unitPrice"
                  className="input"
                  min="0"
                  value={formData.unitPrice}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="field">
              <label>Setup Fee (₹)</label>
              <input
                type="number"
                name="setupFee"
                className="input"
                min="0"
                value={formData.setupFee}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Free Trial Duration (Days)</label>
              <input
                type="number"
                name="freeTrialDuration"
                className="input"
                min="0"
                value={formData.freeTrialDuration}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Billing Interval</label>
              <select
                name="billingInterval"
                className="select"
                value={formData.billingInterval}
                onChange={handleChange}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>

            <div className="field">
              <label>Max Agent Discount (%)</label>
              <input
                type="number"
                name="maxAgentDiscountPercent"
                className="input"
                min="0"
                max="100"
                value={formData.maxAgentDiscountPercent}
                onChange={handleChange}
              />
            </div>

            <div className="field d-flex align-center gap-2 mt-2" style={{ gridColumn: 'span 2' }}>
              <label>Status</label>
              <select
                name="status"
                className="select"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="ACTIVE">Active (Available for quotes)</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Features (comma separated)</label>
              <textarea
                name="featuresInput"
                className="input"
                rows="3"
                value={formData.features ? formData.features.join(', ') : ''}
                onChange={(e) => {
                  const val = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    features: val
                      ? val
                          .split(',')
                          .map((f) => f.trim())
                          .filter((f) => f !== '')
                      : [],
                  }))
                }}
                placeholder="e.g. 24/7 Support, Custom Domain, Dedicated Account Manager"
              ></textarea>
            </div>
          </div>

          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PricingFormModal
