const variants = {
  default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  primary: 'bg-primary-50 text-primary-800 border-primary-200',
  pink: 'bg-primary-100 text-primary-900 border-primary-300',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}

const dots = {
  default: 'bg-zinc-400',
  primary: 'bg-primary-500',
  pink: 'bg-primary-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
}

export default function Badge({ children, variant = 'default', dot = false, className = '', ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${variants[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dots[variant]}`} />}
      {children}
    </span>
  )
}
