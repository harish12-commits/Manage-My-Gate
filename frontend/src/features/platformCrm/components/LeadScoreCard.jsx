import React from 'react'

export const LeadScoreCard = ({ insights }) => {
  if (!insights) return null

  const score = insights.leadScore || 0

  // Determine color based on score
  let colorClass = 'text-green-600'
  let bgClass = 'bg-green-100'
  let strokeClass = 'stroke-green-600'

  if (score < 40) {
    colorClass = 'text-red-600'
    bgClass = 'bg-red-100'
    strokeClass = 'stroke-red-600'
  } else if (score < 70) {
    colorClass = 'text-yellow-600'
    bgClass = 'bg-yellow-100'
    strokeClass = 'stroke-yellow-600'
  }

  // Calculate SVG circle properties for the gauge
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="flex items-center space-x-4 mb-6">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <svg className="transform -rotate-90 w-24 h-24">
          <circle
            cx="48"
            cy="48"
            r="30"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="48"
            cy="48"
            r="30"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${strokeClass} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${colorClass}`}>{score}</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-800">AI Lead Quality</p>
        <p className="text-xs text-gray-500">
          Conversion Probability:{' '}
          <span className="font-bold text-gray-800">{insights.conversionProbability}</span>
        </p>
        <p className="text-xs text-gray-500">
          Est. Value:{' '}
          <span className="font-bold text-green-700">
            ${insights.revenueEstimate?.annual || 0}/yr
          </span>
        </p>
      </div>
    </div>
  )
}
