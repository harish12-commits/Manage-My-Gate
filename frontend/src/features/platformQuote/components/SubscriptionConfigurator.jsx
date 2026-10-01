import React, { useState, useEffect, useMemo } from 'react'
import InstantQuoteAction from './InstantQuoteAction.jsx'
import { GST_RATE } from '../../../config/taxConfig.js'
import { useMasterPricing } from '../../pricing/hooks/useMasterPricing.js'

const SubscriptionConfigurator = ({ quoteId, onQuoteTotalChange }) => {
  const { items: pricingPlans, loadPricing } = useMasterPricing()

  const basePlans = useMemo(
    () => pricingPlans.filter((p) => p.type === 'BASE_PLAN' && p.status === 'ACTIVE'),
    [pricingPlans],
  )
  const addonPlans = useMemo(
    () =>
      pricingPlans.filter(
        (p) => (p.type === 'UNIT_ADDON' || p.type === 'FEATURE_ADDON') && p.status === 'ACTIVE',
      ),
    [pricingPlans],
  )

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [adminDiscountPercent, setAdminDiscountPercent] = useState(10)
  const [baseUnits, setBaseUnits] = useState(250)

  // Selected features: { [featureId]: quantity }
  const [selectedFeatures, setSelectedFeatures] = useState({})
  // Custom overrides for feature prices: { [featureId]: customPrice }
  const [customPrices, setCustomPrices] = useState({})

  useEffect(() => {
    loadPricing()
  }, [loadPricing])

  // When plans load, auto-select the first base plan if none is selected
  useEffect(() => {
    if (!selectedPlanId && basePlans.length > 0) {
      setSelectedPlanId(basePlans[0]._id)
    }
  }, [basePlans, selectedPlanId])

  const selectedPlan = basePlans.find((p) => p._id === selectedPlanId)

  const handleFeatureToggle = (addonId, checked, defaultUnits = 1) => {
    if (checked) {
      setSelectedFeatures((prev) => ({ ...prev, [addonId]: defaultUnits }))
    } else {
      setSelectedFeatures((prev) => {
        const next = { ...prev }
        delete next[addonId]
        return next
      })
    }
  }

  const handleFeatureQuantityChange = (addonId, quantity) => {
    setSelectedFeatures((prev) => ({ ...prev, [addonId]: Number(quantity) }))
  }

  const handleFeaturePriceChange = (addonId, price) => {
    setCustomPrices((prev) => ({ ...prev, [addonId]: price === '' ? '' : Number(price) }))
  }

  // Calculations
  const basePrice = selectedPlan ? selectedPlan.basePrice : 0
  const unitPrice =
    selectedPlan && selectedPlan.pricingModel !== 'FLAT' ? selectedPlan.unitPrice || 0 : 0
  const perUnitTotal = baseUnits * unitPrice
  const setupFee = selectedPlan ? selectedPlan.setupFee || 0 : 0

  let featuresTotal = 0

  addonPlans.forEach((addon) => {
    if (selectedFeatures[addon._id] !== undefined) {
      const qty = selectedFeatures[addon._id]
      const defaultPrice = (addon.basePrice || 0) + (addon.unitPrice || 0) * qty
      const customPriceStr = customPrices[addon._id]
      const addonPrice =
        customPriceStr !== undefined && customPriceStr !== ''
          ? Number(customPriceStr)
          : defaultPrice
      featuresTotal += addonPrice
    }
  })

  const subtotal = basePrice + perUnitTotal + featuresTotal + setupFee
  const discountAmount = subtotal * (adminDiscountPercent / 100)
  const taxableAmount = subtotal - discountAmount
  const taxAmount = taxableAmount * GST_RATE
  const grandTotal = taxableAmount + taxAmount

  useEffect(() => {
    if (onQuoteTotalChange) {
      onQuoteTotalChange(grandTotal)
    }
  }, [grandTotal, onQuoteTotalChange])

  const selectedAddOnsList = useMemo(() => {
    return addonPlans
      .filter((addon) => selectedFeatures[addon._id] !== undefined)
      .map((addon) => {
        const qty = selectedFeatures[addon._id] || 1
        const customPriceStr = customPrices[addon._id]
        const defaultPrice = (addon.basePrice || 0) + (addon.unitPrice || 0) * qty
        const addonPrice =
          customPriceStr !== undefined && customPriceStr !== ''
            ? Number(customPriceStr)
            : defaultPrice

        let featureCode = addon.code || addon.key || addon.name?.toLowerCase() || ''
        if (addon.name?.toLowerCase().includes('billing')) featureCode = 'billing'
        else if (addon.name?.toLowerCase().includes('complaint')) featureCode = 'complaints'
        else if (addon.name?.toLowerCase().includes('visitor')) featureCode = 'visitor'
        else if (addon.name?.toLowerCase().includes('notice')) featureCode = 'notices'
        else if (addon.name?.toLowerCase().includes('amenit')) featureCode = 'amenities'

        return {
          addonId: addon._id,
          code: featureCode,
          name: addon.name,
          qty,
          price: addonPrice,
        }
      })
  }, [addonPlans, selectedFeatures, customPrices])

  const selectedAddOnKeys = useMemo(() => {
    return selectedAddOnsList.map((a) => a.code).filter(Boolean)
  }, [selectedAddOnsList])

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      {/* Base Plan Card */}
      <div
        className="panel"
        style={{ backgroundColor: '#f8f9fa', border: '1px solid #cce5ff', marginBottom: '20px' }}
      >
        <div className="panel-body">
          <div
            className="d-flex justify-between align-center mb-2"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              {selectedPlan ? selectedPlan.name : 'Select a Plan'}
            </h3>
            <select
              className="form-control"
              style={{ width: 'auto', fontWeight: 'bold' }}
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              <option value="">Change</option>
              {basePlans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          {selectedPlan ? (
            <div>
              <div style={{ color: '#495057', fontWeight: '500', marginBottom: '15px' }}>
                Base ₹{basePrice.toLocaleString()} · Per Unit ₹{unitPrice.toLocaleString()} · Setup
                ₹{setupFee.toLocaleString()} · Max Discount{' '}
                {selectedPlan.maxAgentDiscountPercent || 0}%
              </div>
              {selectedPlan.features && selectedPlan.features.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#343a40' }}>
                    Base Plan Features:
                  </strong>
                  <ul style={{ paddingLeft: '20px', margin: 0, color: '#6c757d' }}>
                    {selectedPlan.features.map((feature, idx) => (
                      <li key={idx} style={{ paddingBottom: '4px' }}>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>No base plan selected</div>
          )}
        </div>
      </div>

      {/* Features List */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Optional Add-ons</h4>
        {addonPlans.map((addon) => {
          const isSelected = selectedFeatures[addon._id] !== undefined
          const qty = isSelected ? selectedFeatures[addon._id] : addon.unitPrice > 0 ? 1000 : 1
          const currentPrice =
            (addon.basePrice || 0) + (addon.unitPrice || 0) * (isSelected ? qty : 0)

          return (
            <div
              key={addon._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '15px 0',
                borderBottom: '1px solid #e9ecef',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', flex: 1 }}>
                <input
                  type="checkbox"
                  style={{ marginTop: '5px', width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={isSelected}
                  onChange={(e) => handleFeatureToggle(addon._id, e.target.checked, qty)}
                />
                <div>
                  <div style={{ fontWeight: 'bold', color: '#212529', fontSize: '15px' }}>
                    {addon.name}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6c757d', marginTop: '2px' }}>
                    {addon.features?.join(', ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {addon.pricingModel === 'PER_UNIT' && (
                  <input
                    type="number"
                    className="form-control"
                    style={{ width: '100px', textAlign: 'right' }}
                    value={qty}
                    disabled={!isSelected}
                    onChange={(e) => handleFeatureQuantityChange(addon._id, e.target.value)}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#212529', fontSize: '15px' }}>₹</span>
                  {isSelected ? (
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '80px', textAlign: 'right', fontWeight: 'bold' }}
                      value={
                        customPrices[addon._id] !== undefined
                          ? customPrices[addon._id]
                          : currentPrice
                      }
                      onChange={(e) => handleFeaturePriceChange(addon._id, e.target.value)}
                    />
                  ) : (
                    <div
                      style={{
                        fontWeight: 'bold',
                        width: '80px',
                        textAlign: 'right',
                        fontSize: '15px',
                        color: '#212529',
                      }}
                    >
                      {(addon.basePrice || 0).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {addonPlans.length === 0 && (
          <div style={{ color: '#6c757d', fontStyle: 'italic', padding: '15px 0' }}>
            No optional features available.
          </div>
        )}
      </div>

      {/* Overrides */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginTop: '25px',
          paddingTop: '20px',
          borderTop: '1px solid #e9ecef',
        }}
      >
        <div className="form-group">
          <label style={{ fontSize: '13px', color: '#6c757d' }}>Discount %</label>
          <input
            type="number"
            className="form-control"
            value={adminDiscountPercent}
            onChange={(e) => setAdminDiscountPercent(Number(e.target.value))}
          />
        </div>
        <div className="form-group">
          <label style={{ fontSize: '13px', color: '#6c757d' }}>
            Admin Price Override (optional)
          </label>
          <input
            type="number"
            className="form-control"
            placeholder="Leave blank to use calculated total"
          />
        </div>
      </div>

      {/* Quote Summary */}
      <div
        className="panel"
        style={{ marginTop: '30px', padding: '25px', border: '1px solid #dee2e6' }}
      >
        <h3
          style={{ fontWeight: 'bold', fontSize: '20px', marginBottom: '25px', color: '#212529' }}
        >
          Quote Summary
        </h3>

        <div style={{ fontSize: '15px', color: '#495057' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Base Plan</span>
            <span style={{ fontWeight: 'bold', color: '#212529' }}>
              ₹{basePrice.toLocaleString()}
            </span>
          </div>

          {unitPrice > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span>
                Per Unit ({baseUnits} × ₹{unitPrice})
              </span>
              <span style={{ fontWeight: 'bold', color: '#212529' }}>
                ₹{perUnitTotal.toLocaleString()}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>Selected Features</span>
            <span style={{ fontWeight: 'bold', color: '#212529' }}>
              ₹{featuresTotal.toLocaleString()}
            </span>
          </div>

          {setupFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span>Setup Fee</span>
              <span style={{ fontWeight: 'bold', color: '#212529' }}>
                ₹{setupFee.toLocaleString()}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '15px',
              paddingTop: '15px',
              borderTop: '1px solid #e9ecef',
            }}
          >
            <span>Subtotal</span>
            <span style={{ fontWeight: 'bold', color: '#212529' }}>
              ₹{subtotal.toLocaleString()}
            </span>
          </div>

          {discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span>Discount</span>
              <span style={{ fontWeight: 'bold', color: '#212529' }}>
                -₹{discountAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>GST ({GST_RATE * 100}%)</span>
            <span style={{ fontWeight: 'bold', color: '#212529' }}>
              ₹{taxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '15px',
              borderTop: '2px solid #dee2e6',
            }}
          >
            <span style={{ fontWeight: '900', fontSize: '22px', color: '#212529' }}>
              Post-Trial Total
            </span>
            <span style={{ fontWeight: '900', fontSize: '22px', color: '#212529' }}>
              ₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '10px',
              fontWeight: 'bold',
              backgroundColor: '#e6f4ea',
              padding: '10px 14px',
              borderRadius: '6px',
            }}
          >
            <span style={{ color: '#137333', fontSize: '15px' }}>
              🎁 Due Today (14-Day Free Trial)
            </span>
            <span style={{ color: '#137333', fontSize: '20px', fontWeight: '900' }}>₹0</span>
          </div>
        </div>

        <InstantQuoteAction
          quoteId={quoteId}
          payload={{
            billingCycle: selectedPlan?.billingInterval || 'YEARLY',
            trialDays: 14,
            isTrial: true,
            freeTrialDuration: 14,
            adminDiscountPercent,
            tierPrice: basePrice,
            basePrice,
            perUnitRate: unitPrice,
            setupFee,
            subtotal,
            discountAmount,
            taxAmount,
            calculatedTotal: grandTotal,
            totalAmount: grandTotal,
            grandTotal,
            dueToday: 0,
            inquiryId: quoteId,
            masterPricingId: selectedPlanId,
            unitCount: baseUnits,
            planName: selectedPlan?.name || selectedPlan?.planName || 'COMMUNITY_ENTERPRISE',
            selectedAddOns: selectedAddOnsList,
            selectedFeatures: selectedAddOnKeys,
            addOns: selectedAddOnsList,
          }}
        />
      </div>
    </div>
  )
}

export default SubscriptionConfigurator
