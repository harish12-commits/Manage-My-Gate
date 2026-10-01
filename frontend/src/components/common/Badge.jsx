import React from 'react'

const colors = {
  green: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
}

const Badge = ({ color = 'blue', children, className = '' }) => {
  const baseClasses =
    'rounded-full text-[11px] font-bold px-2.5 py-1 inline-flex items-center gap-1.5'
  const colorClasses = colors[color] || colors.blue

  return <span className={`${baseClasses} ${colorClasses} ${className}`}>{children}</span>
}

export default Badge
