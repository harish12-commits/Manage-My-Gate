import React from 'react'

const STAGES = [
  'New',
  'Contacted',
  'Demo Scheduled',
  'Demo Completed',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Onboarding',
]

export const StagePipeline = ({ activeEnquiry, stageHistory }) => {
  const currentStageIndex = STAGES.indexOf(activeEnquiry?.status)

  // Calculate total time in pipeline
  const getStageDuration = (stageName) => {
    const history = stageHistory?.find((h) => h.stage === stageName)
    if (!history) return null

    if (history.duration > 0) {
      const days = Math.floor(history.duration / (1000 * 60 * 60 * 24))
      const hours = Math.floor((history.duration / (1000 * 60 * 60)) % 24)
      return days > 0 ? `${days}d ${hours}h` : `${hours}h`
    }

    // If still in stage
    if (!history.exitedAt) {
      const diff = new Date().getTime() - new Date(history.enteredAt).getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      return `${days}d (current)`
    }
    return null
  }

  return (
    <div className="mb-8">
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
          <div
            style={{ width: `${(Math.max(currentStageIndex, 0) / (STAGES.length - 1)) * 100}%` }}
            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
          ></div>
        </div>

        {/* Stage Markers */}
        <div className="flex justify-between w-full">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentStageIndex
            const isCurrent = index === currentStageIndex
            const history = stageHistory?.find((h) => h.stage === stage)
            const duration = getStageDuration(stage)

            return (
              <div
                key={stage}
                className="flex flex-col items-center relative group"
                style={{ width: `${100 / STAGES.length}%` }}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 mb-1 z-10 bg-white
                  ${
                    isCompleted
                      ? 'border-indigo-600 bg-indigo-600'
                      : isCurrent
                        ? 'border-indigo-600 shadow-[0_0_0_3px_rgba(79,70,229,0.2)]'
                        : 'border-gray-300'
                  }`}
                ></div>
                <div
                  className={`text-xs text-center px-1 font-medium ${isCurrent ? 'text-indigo-700 font-bold' : 'text-gray-500'}`}
                >
                  {stage}
                </div>

                {/* Tooltip */}
                {history && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-10 w-48 p-2 bg-gray-800 text-white text-xs rounded z-20 pointer-events-none">
                    <p>Entered: {new Date(history.enteredAt).toLocaleDateString()}</p>
                    {history.exitedAt && (
                      <p>Exited: {new Date(history.exitedAt).toLocaleDateString()}</p>
                    )}
                    {duration && <p>Time in stage: {duration}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
