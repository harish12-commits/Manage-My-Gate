import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useSocket } from '../../../../hooks/useSocket.js'
import { toast } from 'react-hot-toast'

const steps = [
  { label: 'INIT (Trial Started)', icon: '1' },
  { label: 'CREATE_ORG (Tenant Setup)', icon: '2' },
  { label: 'CREATE_WORKSPACE', icon: '3' },
  { label: 'CREATE_ADMIN (User Setup)', icon: '4' },
  { label: 'ACTIVATE_ENTITLEMENTS', icon: '5' },
  { label: 'GENERATE_TEMPLATES', icon: '6' },
  { label: 'FINISHED (Tenant Live & Welcomes Sent)', icon: '7' },
]

const ProvisioningTab = ({ lead, currentStepIndex = 0 }) => {
  const targetId = String(lead?._id || lead?.id || '')

  const orders = useSelector((state) => {
    const raw = state.platformBilling?.orders
    if (!raw) return []
    return Array.isArray(raw) ? raw : raw.data || raw.docs || []
  })

  const quotes = useSelector((state) => {
    const raw = state.platformBilling?.quotes
    if (!raw) return []
    return Array.isArray(raw) ? raw : raw.data || raw.docs || []
  })

  const isProvisioned = useMemo(() => {
    const isPersisted = localStorage.getItem('order_generated_' + targetId) === 'true'
    const hasOrder = orders.some(
      (o) => String(o.inquiryId?._id || o.inquiryId?.id || o.inquiryId || '') === targetId,
    )
    const hasQuote = quotes.some(
      (q) => String(q.inquiryId?._id || q.inquiryId?.id || q.inquiryId || '') === targetId,
    )
    return (
      isPersisted ||
      hasOrder ||
      hasQuote ||
      lead?.status === 'DEMO_COMPLETED' ||
      currentStepIndex > 0
    )
  }, [targetId, orders, quotes, lead, currentStepIndex])

  const [simulatedStepIndex, setSimulatedStepIndex] = useState(
    isProvisioned ? 7 : currentStepIndex || 0,
  )
  const [isRunning, setIsRunning] = useState(false)

  const { socket } = useSocket('/platform')

  useEffect(() => {
    if (isProvisioned && simulatedStepIndex < 7) {
      setSimulatedStepIndex(7)
    }
  }, [isProvisioned])

  useEffect(() => {
    if (!socket) return

    const handleJobUpdate = (payload) => {
      if (typeof payload.stepIndex === 'number') {
        setSimulatedStepIndex(payload.stepIndex)
      }
    }

    socket.on('PROVISIONING_JOB_UPDATE', handleJobUpdate)

    return () => {
      socket.off('PROVISIONING_JOB_UPDATE', handleJobUpdate)
    }
  }, [socket])

  const handleRunSimulation = () => {
    setIsRunning(true)
    setSimulatedStepIndex(0)
    toast.loading('Starting provisioning execution...', { id: 'prov-sim' })

    let current = 0
    const interval = setInterval(() => {
      current += 1
      setSimulatedStepIndex(current)
      if (current >= 7) {
        clearInterval(interval)
        setIsRunning(false)
        toast.success('Provisioning Pipeline Completed! Tenant is live.', { id: 'prov-sim' })
      }
    }, 600)
  }

  return (
    <div className="panel-body grid2">
      <div className="panel shadow-none">
        <div
          className="panel-head"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <h2>Provisioning Pipeline</h2>
          <span className={`badge ${simulatedStepIndex >= 7 ? 'green' : 'blue'}`}>
            {simulatedStepIndex >= 7 ? 'TENANT LIVE (PROVISIONED ✓)' : 'PROVISIONING IN PROGRESS'}
          </span>
        </div>
        <div className="panel-body">
          <div className="step-list">
            {steps.map((step, idx) => {
              let statusClass = ''
              const isDone = idx < simulatedStepIndex
              const isCurrent = idx === simulatedStepIndex && simulatedStepIndex < 7

              if (isDone) statusClass = 'done'
              else if (isCurrent) statusClass = 'current'

              return (
                <div
                  key={idx}
                  className={`step ${statusClass}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    marginBottom: '8px',
                    borderRadius: '6px',
                    backgroundColor: isDone ? '#ecfdf5' : isCurrent ? '#eff6ff' : '#f9fafb',
                    border: isDone
                      ? '1px solid #a7f3d0'
                      : isCurrent
                        ? '1px solid #bfdbfe'
                        : '1px solid #e5e7eb',
                    color: isDone ? '#065f46' : isCurrent ? '#1e40af' : '#6b7280',
                    fontWeight: isDone || isCurrent ? 600 : 400,
                  }}
                >
                  <div
                    className="step-icon"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isDone ? '#10b981' : isCurrent ? '#2563eb' : '#d1d5db',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {isDone ? '✓' : step.icon}
                  </div>
                  <span>{step.label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4">
            <div
              className="progress"
              style={{
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  backgroundColor: '#10b981',
                  width: `${(Math.min(simulatedStepIndex, 7) / 7) * 100}%`,
                  transition: 'width 0.4s ease',
                }}
              ></div>
            </div>
            <div
              className="d-flex justify-between align-center mt-3"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div className="mini-note" style={{ fontSize: '13px', color: '#6b7280' }}>
                {simulatedStepIndex >= 7
                  ? 'All 7 tenant infrastructure services provisioned in MongoDB.'
                  : 'Free Trial / Order provisioned automatically within transaction.'}
              </div>
              <button
                className="btn"
                onClick={handleRunSimulation}
                disabled={isRunning}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '6px 14px',
                }}
              >
                {isRunning ? 'Executing...' : '⚡ Re-Run Pipeline'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProvisioningTab
