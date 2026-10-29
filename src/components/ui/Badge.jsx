const variants = {
  default: 'bg-gray-100 text-gray-700 border border-gray-200/60',
  primary: 'bg-primary-50 text-primary-700 border border-primary-200/80 font-bold',
  pink: 'bg-primary-100 text-primary-800 border border-primary-300/80 font-bold',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold',
  info: 'bg-sky-50 text-sky-700 border border-sky-200/60 font-semibold',
}

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide shadow-2xs ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
