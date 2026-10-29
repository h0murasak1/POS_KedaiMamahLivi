import { forwardRef } from 'react'

const variants = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-md shadow-primary-200/50 active:shadow-sm border border-primary-600/20',
  secondary: 'bg-pink-50/80 hover:bg-pink-100/90 text-primary-700 border border-pink-200/60 shadow-2xs',
  danger: 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white shadow-md shadow-rose-200/50 active:shadow-sm',
  success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-200/50 active:shadow-sm',
  ghost: 'hover:bg-primary-50 text-gray-700 hover:text-primary-700',
  outline: 'border border-pink-200 hover:border-primary-400 bg-white hover:bg-primary-50/50 text-gray-700 hover:text-primary-700 shadow-2xs',
  soft: 'bg-white hover:bg-primary-50 text-primary-700 border border-primary-200 shadow-xs',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-xl font-semibold',
  md: 'px-4 py-2.5 text-sm rounded-xl font-bold',
  lg: 'px-6 py-3 text-base rounded-2xl font-bold',
  xl: 'px-8 py-3.5 text-lg rounded-2xl font-extrabold',
}

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  disabled = false,
  loading = false,
  icon: Icon,
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-150 focus:outline-none focus:ring-2 
        focus:ring-primary-400 focus:ring-offset-2 active:scale-[0.97]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  )
})

Button.displayName = 'Button'
export default Button
