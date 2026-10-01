import React from 'react'

const Card = ({ children, className = '' }) => {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  )
}

export default Card
