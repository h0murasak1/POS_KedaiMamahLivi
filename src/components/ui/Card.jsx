export default function Card({ 
  children, 
  className = '', 
  padding = true, 
  hover = true,
  ...props 
}) {
  return (
    <div
      className={`
        bg-white rounded-2xl border border-pink-100/80 shadow-xs 
        ${hover ? 'hover:border-primary-200/90 hover:shadow-md hover:shadow-primary-100/30 transition-all duration-200' : ''}
        ${padding ? 'p-5 sm:p-6' : ''} 
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`mb-4 flex items-center justify-between ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-base sm:text-lg font-bold text-gray-900 tracking-tight ${className}`}>
      {children}
    </h3>
  )
}
