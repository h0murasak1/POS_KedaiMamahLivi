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
        bg-white rounded-2xl border border-zinc-200/70 shadow-[0_1px_2px_rgba(24,24,27,0.04)]
        ${hover ? 'hover:border-primary-200 hover:shadow-[0_12px_28px_-14px_rgba(234,88,12,0.28)] transition-[border-color,box-shadow,transform] duration-200' : ''}
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
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`font-heading text-base sm:text-lg font-bold text-zinc-900 tracking-tight ${className}`}>
      {children}
    </h3>
  )
}
