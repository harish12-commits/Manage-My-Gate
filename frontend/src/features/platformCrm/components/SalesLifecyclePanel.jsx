import React from 'react'
import { StagePipeline } from './StagePipeline.jsx'
import { ActivityTimeline } from './ActivityTimeline.jsx'

export const SalesLifecyclePanel = ({ activeEnquiry, stageHistory, activities }) => {
  return (
    <div>
      <StagePipeline activeEnquiry={activeEnquiry} stageHistory={stageHistory} />
      <div className="mt-8 pt-6 border-t">
        <h4 className="text-md font-semibold text-gray-800 mb-2">Activity Timeline</h4>
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  )
}
