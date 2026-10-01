import React, { memo } from 'react'

const BookingStepper = memo(({ currentStep }) => {
  const steps = [
    { id: 'date', label: '1. Date' },
    { id: 'time', label: '2. Time' },
    { id: 'review', label: '3. Review' },
  ]

  const getStepIndex = (stepId) => {
    if (stepId === 'submitting' || stepId === 'success') return 3
    const index = steps.findIndex((s) => s.id === stepId)
    return index >= 0 ? index : 0
  }

  const currentIndex = getStepIndex(currentStep)

  return (
    <div
      className="d-flex justify-content-between align-items-center mb-4 position-relative"
      aria-label="Booking Progress"
    >
      <div
        className="position-absolute w-100"
        style={{
          height: '2px',
          backgroundColor: '#e2e8f0',
          zIndex: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      ></div>
      <div
        className="position-absolute"
        style={{
          height: '2px',
          backgroundColor: '#321fdb',
          zIndex: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: `${(currentIndex / (steps.length - 1)) * 100}%`,
          transition: 'width 0.3s ease',
        }}
      ></div>

      {steps.map((step, index) => {
        const isActive = index === currentIndex
        const isCompleted = index < currentIndex

        return (
          <div
            key={step.id}
            className="d-flex flex-column align-items-center position-relative"
            style={{ zIndex: 1 }}
          >
            <div
              className={`rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm mb-2`}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: isActive || isCompleted ? '#321fdb' : '#fff',
                color: isActive || isCompleted ? '#fff' : '#768192',
                border: `2px solid ${isActive || isCompleted ? '#321fdb' : '#dee2e6'}`,
                transition:
                  'color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease, opacity 0.3s ease, width 0.3s ease, height 0.3s ease, max-height 0.3s ease',
              }}
              aria-current={isActive ? 'step' : undefined}
            >
              {isCompleted ? <i className="fa-solid fa-check"></i> : index + 1}
            </div>
            <span className={`small fw-semibold ${isActive ? 'text-primary' : 'text-muted'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
})

export default BookingStepper
