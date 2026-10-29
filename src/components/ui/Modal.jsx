import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Responsive modal: bottom-sheet on phones, centered dialog on tablet/desktop.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = 'md',
  showClose = true,
  testId = 'modal',
}) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-full sm:mx-4',
  }

  return (
    <div
      ref={overlayRef}
      data-testid={testId}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-zinc-950/50 backdrop-blur-[3px] sm:p-4 animate-fade-in"
      onMouseDown={(e) => e.target === overlayRef.current && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bg-white w-full ${sizes[size]} max-h-[92dvh] flex flex-col overflow-hidden
          rounded-t-[28px] sm:rounded-3xl shadow-[0_30px_80px_-20px_rgba(24,24,27,0.45)]
          border border-zinc-100 animate-sheet-up sm:animate-scale-in`}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-zinc-200" />
        </div>
        {title && (
          <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-2 sm:pt-5 pb-4 border-b border-zinc-100 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              {Icon && (
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-zinc-900 tracking-tight leading-snug truncate" data-testid={`${testId}-title`}>
                  {title}
                </h2>
                {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {showClose && (
              <button
                onClick={onClose}
                data-testid={`${testId}-close-button`}
                className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition-colors active:scale-90"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 flex-1 overscroll-contain">
          {children}
        </div>
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-zinc-100 bg-zinc-50/70 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
