import React from 'react'

const variants = {
  primary: 'bg-blue-500 text-white shadow-[0_4px_14px_rgba(0,132,255,0.28)] hover:bg-blue-600',
  success:
    'bg-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.28)] hover:bg-emerald-600',
  danger: 'bg-red-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.28)] hover:bg-red-600',
  outline: 'bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50',
}

const sizes = {
  small: 'px-3 py-1.5 text-xs',
  default: 'px-4 py-2 text-sm',
}

const Button = ({ variant = 'primary', size = 'default', children, className = '', ...props }) => {
  const baseClasses =
    'inline-flex justify-center items-center font-medium rounded-lg transition-all duration-200 hover:-translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none cursor-pointer'
  const variantClasses = variants[variant] || variants.primary
  const sizeClasses = sizes[size] || sizes.default

  return (
    <button className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default Button
