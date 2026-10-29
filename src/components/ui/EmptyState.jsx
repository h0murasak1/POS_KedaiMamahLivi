export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center justify-center text-center px-4 rounded-3xl border border-dashed border-zinc-200 bg-white/60 animate-fade-in-up ${compact ? 'py-10' : 'py-16'}`}
    >
      {Icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-3xl bg-primary-200/50 blur-xl" />
          <div className="relative w-16 h-16 bg-gradient-to-br from-primary-50 to-primary-100 rounded-3xl flex items-center justify-center text-primary-600 border border-primary-200/60 rotate-[-6deg]">
            <Icon className="w-7 h-7 rotate-[6deg]" />
          </div>
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-zinc-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-zinc-500 max-w-sm mb-5 leading-relaxed">{description}</p>
      )}
      {action && action}
    </div>
  )
}
