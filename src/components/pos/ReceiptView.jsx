import { formatRupiah, paymentMethodLabels } from '@/lib/utils'
import { CheckCircle2, CloudOff } from 'lucide-react'

/** Thermal-receipt styled view. Wrapped in .receipt-print so window.print() prints only this. */
export default function ReceiptView({ order, items = [], settings = {}, showSync = true }) {
    if (!order) return null
    const created = order.created_at_local ? new Date(order.created_at_local) : new Date()

    return (
        <div
            className="receipt-print bg-white rounded-2xl border border-zinc-200 shadow-[0_10px_30px_-18px_rgba(24,24,27,0.4)] px-5 py-5 font-mono text-[12.5px] text-zinc-800"
            data-testid="receipt-view"
        >
            <div className="text-center">
                <p className="font-heading text-base font-bold text-zinc-900 tracking-tight" data-testid="receipt-store-name">
                    {settings.store_name || 'Kedai Mamah Livi'}
                </p>
                {settings.store_address && <p className="text-[11px] text-zinc-500 mt-0.5">{settings.store_address}</p>}
                {settings.store_phone && <p className="text-[11px] text-zinc-500">{settings.store_phone}</p>}
            </div>

            <div className="border-t border-dashed border-zinc-300 my-3" />

            <div className="space-y-0.5 text-[11px] text-zinc-500">
                <div className="flex justify-between gap-2"><span>No</span><span className="text-zinc-800 font-semibold truncate" data-testid="receipt-order-number">{order.order_number}</span></div>
                <div className="flex justify-between gap-2"><span>Waktu</span><span className="text-zinc-800">{created.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
                <div className="flex justify-between gap-2"><span>Kasir</span><span className="text-zinc-800">{order.cashier_name || 'Kasir'}</span></div>
            </div>

            <div className="border-t border-dashed border-zinc-300 my-3" />

            <div className="space-y-2">
                {items.map((item) => (
                    <div key={item.id} className="leading-snug">
                        <p className="text-zinc-900 font-semibold">
                            {item.product_name}
                            {item.variant_name && <span className="text-zinc-500 font-normal"> · {item.variant_name}</span>}
                        </p>
                        <div className="flex justify-between text-zinc-500">
                            <span>{item.quantity} × {formatRupiah((item.unit_price || 0) + (item.variant_price_addition || 0))}</span>
                            <span className="text-zinc-900">{formatRupiah(item.subtotal)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="border-t border-dashed border-zinc-300 my-3" />

            <div className="space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(order.subtotal || 0)}</span></div>
                {order.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-700"><span>Diskon</span><span>-{formatRupiah(order.discount_amount)}</span></div>
                )}
                <div className="flex justify-between text-[15px] font-bold text-zinc-900 pt-1">
                    <span>TOTAL</span><span data-testid="receipt-total">{formatRupiah(order.total_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-zinc-500"><span>Bayar</span><span>{paymentMethodLabels[order.payment_method] || order.payment_method}</span></div>
                {order.payment_method === 'cash' && order.cash_received != null && (
                    <>
                        <div className="flex justify-between text-zinc-500"><span>Tunai</span><span>{formatRupiah(order.cash_received)}</span></div>
                        <div className="flex justify-between text-zinc-900 font-semibold"><span>Kembalian</span><span>{formatRupiah(order.change_amount || 0)}</span></div>
                    </>
                )}
            </div>

            <div className="border-t border-dashed border-zinc-300 my-3" />

            <p className="text-center text-[11px] text-zinc-500">{settings.receipt_footer || 'Terima kasih telah berbelanja!'}</p>

            {showSync && (
                <div className="no-print mt-3 flex justify-center">
                    {order.sync_status === 'synced' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tersinkron ke server
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-sans font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <CloudOff className="w-3.5 h-3.5" /> Tersimpan lokal, menunggu sinkron
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}

/** Plain-text receipt for WhatsApp sharing */
export function receiptToText(order, items = [], settings = {}) {
    const lines = [
        `*${settings.store_name || 'Kedai Mamah Livi'}*`,
        `No: ${order.order_number}`,
        `${new Date(order.created_at_local).toLocaleString('id-ID')}`,
        '----------------------',
        ...items.map((i) => `${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ''} x${i.quantity}  ${formatRupiah(i.subtotal)}`),
        '----------------------',
        order.discount_amount > 0 ? `Diskon: -${formatRupiah(order.discount_amount)}` : null,
        `*TOTAL: ${formatRupiah(order.total_amount)}*`,
        `Bayar: ${paymentMethodLabels[order.payment_method] || order.payment_method}`,
        '',
        settings.receipt_footer || 'Terima kasih telah berbelanja!',
    ].filter((l) => l !== null)
    return lines.join('\n')
}
