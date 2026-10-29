import { forwardRef } from 'react'

export const fieldClass = `w-full px-4 min-h-11 py-2.5 text-[15px] border border-zinc-200 rounded-xl
  bg-zinc-50/70 text-zinc-900 placeholder:text-zinc-400
  transition-[border-color,box-shadow,background-color] duration-150
  hover:border-zinc-300
  focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/15
  disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed`

export function FieldLabel({ children, hint }) {
  return (
    <label className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-[0.08em] mb-1.5">
      <span>{children}</span>
      {hint && <span className="normal-case tracking-normal font-medium text-zinc-400">{hint}</span>}
    </label>
  )
}

const Input = forwardRef(({
  label,
  hint,
  error,
  className = '',
  type = 'text',
  icon: Icon,
  prefix,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        {prefix && !Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-semibold pointer-events-none">
            {prefix}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`${fieldClass} ${Icon ? 'pl-10' : ''} ${prefix && !Icon ? 'pl-11' : ''}
            ${error ? 'border-red-400 focus:ring-red-500/15 focus:border-red-500' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-red-600 animate-fade-in-up">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
