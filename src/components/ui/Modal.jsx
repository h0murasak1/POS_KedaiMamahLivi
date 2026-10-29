import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'md', 
  showClose = true 
}) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
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
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className={`bg-white rounded-3xl shadow-2xl border border-pink-100 w-full ${sizes[size]} max-h-[92vh] flex flex-col overflow-hidden`}>
        {title && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-pink-100/70 bg-gradient-to-r from-pink-50/50 via-white to-pink-50/30">
            <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4.5 bg-primary-500 rounded-full" />
              <span>{title}</span>
            </h2>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors active:scale-90"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto p-4 sm:p-6 flex-1">
          {children}
        </div>
        {footer && (
          <div className="p-3 sm:px-6 sm:py-3.5 border-t border-pink-100/70 bg-pink-50/30 rounded-b-3xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
