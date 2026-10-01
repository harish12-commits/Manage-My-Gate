import React, { memo } from 'react'

/**
 * LifecycleStepper — Dumb visual component displaying the CRM Inquiry lifecycle.
 *
 * Phase 1 Steps:
 * 1. New Inquiry (NEW_INQUIRY)
 * 2. Qualified (QUALIFIED)
 * 3. Demo Scheduled (DEMO_SCHEDULED)
 * 4. Demo Completed (DEMO_COMPLETED)
 */
export const LifecycleStepper = memo(({ status = 'NEW_INQUIRY' }) => {
  const steps = [
    {
      key: 'NEW_INQUIRY',
      label: 'New Inquiry',
      icon: 'fa-solid fa-file-invoice',
      statuses: ['NEW_INQUIRY', 'NEW'],
    },
    {
      key: 'QUALIFIED',
      label: 'Qualified',
      icon: 'fa-solid fa-user-check',
      statuses: ['QUALIFIED'],
    },
    {
      key: 'DEMO_SCHEDULED',
      label: 'Demo Scheduled',
      icon: 'fa-solid fa-calendar-check',
      statuses: ['DEMO_SCHEDULED'],
    },
    {
      key: 'DEMO_COMPLETED',
      label: 'Demo Completed',
      icon: 'fa-solid fa-circle-check',
      statuses: ['DEMO_COMPLETED'],
    },
  ]

  const getActiveStepIndex = (currentStatus) => {
    switch (currentStatus?.toUpperCase()) {
      case 'NEW_INQUIRY':
      case 'NEW':
        return 0
      case 'QUALIFIED':
        return 1
      case 'DEMO_SCHEDULED':
        return 2
      case 'DEMO_COMPLETED':
        return 3
      default:
        return 0
    }
  }

  const activeIndex = getActiveStepIndex(status)

  return (
    <div className="crm-stepper-card">
      <div className="crm-stepper">
        <div className="crm-stepper-line" />
        {steps.map((step, index) => {
          const isCompleted = activeIndex > index
          const isActive = activeIndex === index

          let stateClass = ''
          if (isCompleted) stateClass = 'crm-step--completed'
          if (isActive) stateClass = 'crm-step--active'

          return (
            <div key={step.key} className={`crm-step ${stateClass}`}>
              <div className="crm-step__icon-wrap">
                {isCompleted ? <i className="fa-solid fa-check" /> : <i className={step.icon} />}
              </div>
              <span className="crm-step__label">{step.label}</span>
              <span className="crm-step__sub">
                {isCompleted ? 'Done' : isActive ? 'Active' : `Step ${index + 1}`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

LifecycleStepper.displayName = 'LifecycleStepper'

export default LifecycleStepper
