export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 bg-primary-50 ring-8 ring-pink-50/60 rounded-2xl flex items-center justify-center mb-4 text-primary-500 shadow-xs">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      )}
      {action && action}
    </div>
  )
}

