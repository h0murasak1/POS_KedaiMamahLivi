import { forwardRef } from 'react'

const variants = {
  primary: 'bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-[0_6px_16px_-6px_rgba(234,88,12,0.55)] hover:shadow-[0_10px_22px_-8px_rgba(234,88,12,0.6)] border border-primary-700/10',
  secondary: 'bg-white hover:bg-primary-50 text-zinc-800 hover:text-primary-800 border border-zinc-200 hover:border-primary-300 shadow-2xs',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-[0_6px_16px_-6px_rgba(220,38,38,0.5)]',
  'danger-soft': 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_6px_16px_-6px_rgba(5,150,105,0.5)]',
  ghost: 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900',
  outline: 'border border-zinc-200 hover:border-primary-300 bg-white hover:bg-primary-50/60 text-zinc-700 hover:text-primary-800 shadow-2xs',
  soft: 'bg-primary-50 hover:bg-primary-100 text-primary-800 border border-primary-200/70',
  dark: 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-[0_6px_16px_-6px_rgba(24,24,27,0.5)]',
}

const sizes = {
  sm: 'px-3 min-h-9 text-xs rounded-xl font-semibold',
  md: 'px-4 min-h-11 text-sm rounded-xl font-bold',
  lg: 'px-6 min-h-12 text-base rounded-2xl font-bold',
  xl: 'px-8 min-h-14 text-lg rounded-2xl font-extrabold',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 select-none
        transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2
        active:scale-[0.97] cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none
        ${variants[variant] || variants.primary} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      {children !== undefined && children !== null && children !== false && <span>{children}</span>}
      {IconRight && !loading && <IconRight className="h-4 w-4 shrink-0" />}
    </button>
  )
})

Button.displayName = 'Button'
export default Button
