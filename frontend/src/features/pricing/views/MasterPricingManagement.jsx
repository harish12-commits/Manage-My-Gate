import React, { useState } from 'react'
import PricingFormModal from '../components/PricingFormModal'
import { useMasterPricing } from '../hooks/useMasterPricing'
import Badge from '../../../components/common/Badge'
import { GST_RATE } from '../../../config/taxConfig.js'

const MasterPricingManagement = () => {
  const {
    items,
    loading,
    error,
    isModalOpen,
    editingItem,
    openModal,
    closeModal,
    handleSubmit,
    handleDisable,
    handleDelete,
  } = useMasterPricing()
  const [activeTab, setActiveTab] = useState('BASE_PLANS')

  const filteredItems = items.filter((item) => {
    if (activeTab === 'BASE_PLANS') {
      return item.type === 'BASE_PLAN' || !item.type // fallback for un-typed if any
    }
    if (activeTab === 'FEATURES') {
      return item.type === 'UNIT_ADDON' || item.type === 'FEATURE_ADDON'
    }
    return true
  })

  console.log('MasterPricingManagement rendered, isModalOpen:', isModalOpen)

  return (
    <section
      id="page-pricing"
      className="page"
      style={{ padding: '30px', backgroundColor: '#F8FAFC', minHeight: '100vh' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '40px',
        }}
      >
        <div>
          <h1
            style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 8px 0', color: '#0F172A' }}
          >
            Master Pricing Catalog
          </h1>
          <div style={{ fontSize: '15px', color: '#64748B' }}>
            Global pricing tiers, default free trial durations, and add-ons.
          </div>
        </div>
        <button
          className="btn primary"
          style={{
            borderRadius: '50px',
            padding: '10px 24px',
            fontWeight: '600',
            fontSize: '14px',
            backgroundColor: '#007BFF',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0, 123, 255, 0.2)',
          }}
          onClick={() => {
            openModal(activeTab === 'FEATURES' ? { type: 'UNIT_ADDON' } : null)
          }}
        >
          {activeTab === 'FEATURES' ? '+ Create Add-on' : '+ Create Tier'}
        </button>
      </div>

      {error && <div className="alert error mb-4">{error}</div>}

      <div
        style={{
          display: 'flex',
          gap: '30px',
          borderBottom: '2px solid #E2E8F0',
          marginBottom: '30px',
        }}
      >
        <button
          onClick={() => setActiveTab('BASE_PLANS')}
          style={{
            padding: '12px 0',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom:
              activeTab === 'BASE_PLANS' ? '2px solid #007BFF' : '2px solid transparent',
            fontWeight: activeTab === 'BASE_PLANS' ? '700' : '500',
            color: activeTab === 'BASE_PLANS' ? '#007BFF' : '#64748B',
            marginBottom: '-2px',
            fontSize: '15px',
          }}
        >
          Master Pricing
        </button>
        <button
          onClick={() => setActiveTab('FEATURES')}
          style={{
            padding: '12px 0',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: activeTab === 'FEATURES' ? '2px solid #007BFF' : '2px solid transparent',
            fontWeight: activeTab === 'FEATURES' ? '700' : '500',
            color: activeTab === 'FEATURES' ? '#007BFF' : '#64748B',
            marginBottom: '-2px',
            fontSize: '15px',
          }}
        >
          Features Pricing
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
          gap: '24px',
        }}
      >
        {loading ? (
          <div>Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div>No pricing configurations found for this category.</div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item._id}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div
                style={{
                  padding: '24px',
                  borderBottom: '1px solid #F1F5F9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    {item.name || 'Unnamed Tier'}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                    {item.planCode ? `Code: ${item.planCode}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      fontWeight: '700',
                      padding: '6px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                    }}
                  >
                    {item.type ? item.type.replace('_', ' ') : 'BASE PLAN'}
                  </span>
                  <span
                    style={{
                      fontWeight: '700',
                      padding: '6px 10px',
                      fontSize: '11px',
                      borderRadius: '6px',
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                    }}
                  >
                    {item.pricingModel || 'FLAT'}
                  </span>
                  <span
                    style={{
                      fontWeight: '700',
                      padding: '6px 14px',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      borderRadius: '50px',
                      backgroundColor: item.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2',
                      color: item.status === 'ACTIVE' ? '#065F46' : '#991B1B',
                    }}
                  >
                    {item.status || 'UNKNOWN'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '24px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '24px',
                    marginBottom: '24px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '6px' }}>
                      Base Price
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '4px',
                        marginBottom: '16px',
                      }}
                    >
                      <span style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
                        {new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: 'INR',
                          maximumFractionDigits: 0,
                        }).format(item.basePrice || 0)}
                      </span>
                      <span style={{ color: '#64748B', fontSize: '14px', fontWeight: '500' }}>
                        / {item.billingInterval === 'ANNUAL' ? 'year' : 'month'}
                      </span>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <span
                        style={{
                          display: 'block',
                          color: '#64748B',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Per Unit Rate
                      </span>
                      <span style={{ color: '#0F172A', fontWeight: '600', fontSize: '15px' }}>
                        {item.unitPrice > 0
                          ? new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 0,
                            }).format(item.unitPrice) + ' / unit'
                          : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          display: 'block',
                          color: '#64748B',
                          fontSize: '12px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          marginBottom: '4px',
                        }}
                      >
                        Setup Fee
                      </span>
                      <span style={{ color: '#0F172A', fontWeight: '600', fontSize: '15px' }}>
                        {item.setupFee > 0
                          ? new Intl.NumberFormat('en-IN', {
                              style: 'currency',
                              currency: 'INR',
                              maximumFractionDigits: 0,
                            }).format(item.setupFee)
                          : 'Free'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '6px' }}>
                      Max Agent Discount
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                      {item.maxAgentDiscountPercent || 0}%
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                  <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '10px' }}>
                    Free Trial Duration
                  </div>
                  {item.freeTrialDuration > 0 ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        padding: '8px 16px',
                        borderRadius: '50px',
                        fontSize: '14px',
                        fontWeight: '700',
                      }}
                    >
                      <span style={{ marginRight: '8px', fontSize: '16px' }}>🎁</span>{' '}
                      {item.freeTrialDuration} Days Free Trial
                    </div>
                  ) : (
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>
                      No Free Trial
                    </div>
                  )}
                </div>

                {item.features && item.features.length > 0 && (
                  <div style={{ marginBottom: '30px' }}>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '10px' }}>
                      Included Features
                    </div>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                      {item.features.map((feature, index) => (
                        <li
                          key={index}
                          style={{
                            fontSize: '14px',
                            color: '#334155',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{ color: '#10B981', marginRight: '10px', fontWeight: 'bold' }}
                          >
                            ✓
                          </span>{' '}
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    style={{
                      fontWeight: '600',
                      color: '#0F172A',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    onClick={() => {
                      openModal(item)
                    }}
                  >
                    Edit Plan
                  </button>
                  <button
                    style={{
                      fontWeight: '600',
                      color: '#EF4444',
                      border: '1px solid #FEE2E2',
                      backgroundColor: '#FEF2F2',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    onClick={() => handleDisable(item)}
                  >
                    {item.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    style={{
                      fontWeight: '600',
                      color: '#fff',
                      border: 'none',
                      backgroundColor: '#EF4444',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to delete this pricing tier? This action cannot be undone.',
                        )
                      ) {
                        handleDelete(item._id)
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <PricingFormModal
          isOpen={isModalOpen}
          onClose={closeModal}
          initialData={editingItem}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  )
}

export default MasterPricingManagement
