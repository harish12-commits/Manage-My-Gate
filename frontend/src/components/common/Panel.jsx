import React from 'react'

export const PanelHeader = ({ children, className = '' }) => {
  return (
    <div
      className={`border-b border-slate-200 px-5 py-4 flex flex-wrap gap-2 justify-between items-center ${className}`}
    >
      {children}
    </div>
  )
}

const Panel = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden ${className}`}
    >
      {children}
    </div>
  )
}

export default Panel
