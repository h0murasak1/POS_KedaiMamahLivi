import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { fieldClass, FieldLabel } from './Input'

const Select = forwardRef(({ label, error, options = [], className = '', placeholder, children, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <select
          ref={ref}
          className={`${fieldClass} appearance-none pr-10 cursor-pointer ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'
export default Select
