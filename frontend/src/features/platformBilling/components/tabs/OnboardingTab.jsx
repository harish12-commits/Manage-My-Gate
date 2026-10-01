import React, { useState } from 'react'

const steps = [
  { label: 'Organization workspace created', icon: '1' },
  { label: 'Import sample community data', icon: '2' },
  { label: 'Configure trial modules', icon: '3' },
  { label: 'Go Live', icon: '4' },
]

const OnboardingTab = ({ currentStepIndex = 1 }) => {
  const [simulatedStepIndex, setSimulatedStepIndex] = useState(currentStepIndex)

  const handleAdvance = () => {
    if (simulatedStepIndex < steps.length) {
      setSimulatedStepIndex((prev) => prev + 1)
    }
  }

  return (
    <div className="panel-body grid2">
      <div className="panel shadow-none">
        <div className="panel-head">
          <h2>Trial Onboarding Wizard</h2>
          <span className="badge blue">15-DAY TRIAL</span>
        </div>
        <div className="panel-body">
          <div className="step-list">
            {steps.map((step, idx) => {
              let statusClass = ''
              if (idx < simulatedStepIndex) statusClass = 'done'
              else if (idx === simulatedStepIndex) statusClass = 'current'

              return (
                <div key={idx} className={`step ${statusClass}`}>
                  <div className="step-icon">{idx < simulatedStepIndex ? '✓' : step.icon}</div>
                  {step.label}
                </div>
              )
            })}
          </div>
          <div className="mt-4 d-flex justify-between align-center">
            <div className="mini-note">Wizard guides user through essential configurations.</div>
            <button
              className="btn small"
              onClick={handleAdvance}
              disabled={simulatedStepIndex >= steps.length}
            >
              {simulatedStepIndex >= steps.length ? 'Completed' : 'Simulate Progress ➔'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingTab
