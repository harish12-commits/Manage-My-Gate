import React from 'react'
import { LeadScoreCard } from './LeadScoreCard.jsx'

export const AIInsightsPanel = ({ insights }) => {
  if (!insights) return null

  return (
    <div className="bg-white p-5 rounded-lg border shadow-sm border-t-4 border-t-purple-600">
      <div className="flex items-center space-x-2 mb-4 border-b pb-2">
        <svg
          className="w-5 h-5 text-purple-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          ></path>
        </svg>
        <h3 className="text-lg font-bold text-gray-800">AI Intelligence</h3>
      </div>

      <LeadScoreCard insights={insights} />

      {/* AI Observations */}
      <div className="mb-6">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Key Observations
        </h4>
        <ul className="space-y-2">
          {insights.aiInsights?.map((insight, idx) => (
            <li key={idx} className="flex items-start">
              <svg
                className="w-4 h-4 text-purple-500 mr-2 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              <span className="text-sm text-gray-700">{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended Actions */}
      <div className="mb-6">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Recommended Actions
        </h4>
        <div className="space-y-2">
          {insights.recommendations?.map((rec, idx) => (
            <button
              key={idx}
              className="w-full text-left px-3 py-2 bg-purple-50 text-purple-700 text-sm font-medium rounded border border-purple-100 hover:bg-purple-100 transition-colors flex items-center justify-between"
            >
              <span>{rec}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                ></path>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Risk Indicators */}
      <div>
        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            ></path>
          </svg>
          Risk Indicators
        </h4>
        <div className="bg-red-50 p-3 rounded border border-red-100 space-y-2">
          <p className="text-sm text-red-800 flex items-start">
            <span className="mr-2 text-red-500">•</span> No follow-up in 7 days
          </p>
          <p className="text-sm text-red-800 flex items-start">
            <span className="mr-2 text-red-500">•</span> Demo pending scheduling
          </p>
        </div>
      </div>
    </div>
  )
}
