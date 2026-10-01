import React from 'react'
import Card from './Card'

const KpiCard = ({ label, value, trend, trendDirection = 'neutral', className = '' }) => {
  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-500'
      : trendDirection === 'down'
        ? 'text-red-500'
        : 'text-slate-500'

  return (
    <Card className={`p-5 flex flex-col ${className}`}>
      <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">{label}</span>
      <span className="text-2xl font-bold mt-2 text-slate-900">{value}</span>
      {trend && <span className={`text-[11px] mt-1.5 font-medium ${trendColor}`}>{trend}</span>}
    </Card>
  )
}

export default KpiCard
