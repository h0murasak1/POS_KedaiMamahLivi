import { forwardRef } from 'react'

const Input = forwardRef(({ 
  label, 
  error, 
  className = '', 
  type = 'text',
  icon: Icon,
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`
            w-full px-3.5 py-2.5 text-sm sm:text-base border border-pink-200/80 rounded-xl
            bg-white text-gray-900 placeholder:text-gray-400
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-500
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-rose-400 focus:ring-rose-400/50 focus:border-rose-500' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-semibold text-rose-600 animate-fade-in-up">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
