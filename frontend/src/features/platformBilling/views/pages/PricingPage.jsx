import React, { useState } from 'react'
import { usePlatformBilling } from '../../hooks/usePlatformBilling'

const PricingPage = () => {
  const { pricingPlans, togglePlan, savePlan } = usePlatformBilling()

  // Local state for modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    tier: 'TIER_1',
    basePrice: '',
    perUnit: '',
    setupFee: '',
    maxDiscount: '',
    trialDays: '15',
  })

  const handleOpenModal = (plan = null) => {
    if (plan) {
      setFormData({ ...plan })
    } else {
      setFormData({
        id: null,
        name: '',
        tier: 'TIER_1',
        basePrice: '',
        perUnit: '',
        setupFee: '',
        maxDiscount: '',
        trialDays: '15',
      })
    }
    setIsModalOpen(true)
  }

  const handleSave = () => {
    savePlan({
      id: formData.id || Date.now(),
      name: formData.name || 'Unnamed Plan',
      tier: formData.tier,
      basePrice: Number(formData.basePrice) || 0,
      perUnit: Number(formData.perUnit) || 0,
      setupFee: Number(formData.setupFee) || 0,
      maxDiscount: Number(formData.maxDiscount) || 0,
      trialDays: Number(formData.trialDays) || 0,
      status: formData.status || 'ACTIVE',
    })
    setIsModalOpen(false)
  }

  return (
    <section id="page-pricing" className="page">
      <div className="page-head">
        <div>
          <h1>Master Pricing Catalog</h1>
          <div className="sub">
            Global pricing tiers, default free trial durations, and add-ons.
          </div>
        </div>
        <button className="btn primary" onClick={() => handleOpenModal()}>
          + Create Tier
        </button>
      </div>

      <div className="grid2" id="pricing-plans-container">
        {pricingPlans.map((plan) => (
          <div key={plan.id} className="panel">
            <div className="panel-head">
              <h2>{plan.name}</h2>
              <span className={`badge ${plan.status === 'ACTIVE' ? 'green' : 'gray'}`}>
                {plan.status}
              </span>
            </div>

            <div className="panel-body">
              <div className="field-grid">
                <div className="field">
                  <label>Base Price</label>
                  <div className="field-value">
                    ₹{plan.basePrice.toLocaleString('en-IN')} / year
                  </div>
                </div>
                <div className="field">
                  <label>Per Unit Rate</label>
                  <div className="field-value">₹{plan.perUnit.toLocaleString('en-IN')} / unit</div>
                </div>
                <div className="field">
                  <label>Setup Fee</label>
                  <div className="field-value">₹{plan.setupFee.toLocaleString('en-IN')}</div>
                </div>
                <div className="field">
                  <label>Max Agent Discount</label>
                  <div className="field-value">{plan.maxDiscount}%</div>
                </div>
                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Free Trial Duration</label>
                  <div className="field-value">
                    <span className="badge blue">
                      🎁{' '}
                      {plan.trialDays > 0 ? `${plan.trialDays} Days Free Trial` : 'No Free Trial'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="actions mt-4">
                <button className="btn small" onClick={() => handleOpenModal(plan)}>
                  Edit Plan
                </button>
                <button
                  className={`btn small ${plan.status === 'ACTIVE' ? 'danger' : 'success'}`}
                  onClick={() => togglePlan(plan._id || plan.id, plan)}
                >
                  {plan.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Modal */}
      {isModalOpen && (
        <div className="modal-backdrop open">
          <div className="modal" role="dialog" aria-labelledby="planModalTitle">
            <div className="modal-head">
              <h2 id="planModalTitle">
                {formData.id ? 'Edit Pricing Plan' : 'Create Pricing Plan'}
              </h2>
              <button className="btn small" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body field-grid">
              <div className="field">
                <label>Plan Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Tier 2 Growth"
                />
              </div>
              <div className="field">
                <label>Tier</label>
                <select
                  className="select"
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                >
                  <option value="TIER_1">TIER_1</option>
                  <option value="TIER_2">TIER_2</option>
                  <option value="TIER_3">TIER_3</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>
              <div className="field">
                <label>Base Price (₹/year)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Per Unit Rate (₹)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.perUnit}
                  onChange={(e) => setFormData({ ...formData, perUnit: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Setup Fee (₹)</label>
                <input
                  type="number"
                  className="input"
                  value={formData.setupFee}
                  onChange={(e) => setFormData({ ...formData, setupFee: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Max Discount %</label>
                <input
                  type="number"
                  className="input"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Default Free Trial Duration</label>
                <select
                  className="select"
                  value={formData.trialDays}
                  onChange={(e) => setFormData({ ...formData, trialDays: e.target.value })}
                >
                  <option value="0">No Free Trial (0 Days)</option>
                  <option value="15">15 Days Free Trial</option>
                  <option value="30">30 Days (1 Month) Free Trial</option>
                </select>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSave}>
                Save Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default PricingPage
