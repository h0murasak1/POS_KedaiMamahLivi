import { Delete } from 'lucide-react'
import { playTap } from '@/lib/sound'

/** Touch-friendly numeric keypad. value is a digit string. */
export default function NumericKeypad({ value, onChange, maxLength = 9, testIdPrefix = 'keypad', showTripleZero = true, buttonClassName = 'h-12 sm:h-13' }) {
    const press = (key) => {
        playTap()
        if (key === 'back') return onChange(value.slice(0, -1))
        if (key === 'clear') return onChange('')
        const next = (value === '0' ? '' : value) + key
        if (next.replace(/^0+/, '').length > maxLength) return
        onChange(next.replace(/^0+(?=\d)/, ''))
    }

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', showTripleZero ? '000' : 'clear', '0', 'back']

    return (
        <div className="grid grid-cols-3 gap-2" data-testid={`${testIdPrefix}-grid`}>
            {keys.map((k) => (
                <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    data-testid={`${testIdPrefix}-key-${k}`}
                    className={`${buttonClassName} rounded-xl text-lg font-semibold font-mono select-none transition-[background-color,transform] duration-100 active:scale-95
            ${k === 'back' || k === 'clear'
                            ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-primary-200'
                            : 'bg-zinc-50 border border-zinc-200 text-zinc-900 hover:bg-white hover:border-primary-300 active:bg-primary-100'}`}
                >
                    {k === 'back' ? <Delete className="w-5 h-5 mx-auto" /> : k === 'clear' ? 'C' : k}
                </button>
            ))}
        </div>
    )
}
