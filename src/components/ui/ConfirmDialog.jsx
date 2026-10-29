import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

/** Friendly replacement for window.confirm() */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Yakin?',
    description,
    confirmLabel = 'Ya, Lanjutkan',
    cancelLabel = 'Batal',
    variant = 'danger',
    loading = false,
}) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false} testId="confirm-dialog">
            <div className="text-center pt-2">
                <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'}`}>
                    <AlertTriangle className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">{title}</h3>
                {description && <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{description}</p>}
                <div className="grid grid-cols-2 gap-2.5 mt-6">
                    <Button variant="secondary" onClick={onClose} disabled={loading} data-testid="confirm-dialog-cancel-button">
                        {cancelLabel}
                    </Button>
                    <Button variant={variant} onClick={onConfirm} loading={loading} data-testid="confirm-dialog-confirm-button">
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
