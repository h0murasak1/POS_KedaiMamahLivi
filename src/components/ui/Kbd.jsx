export default function Kbd({ children, className = '' }) {
    return (
        <kbd
            className={`hidden lg:inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-md border border-zinc-200 bg-white text-[10px] font-mono font-semibold text-zinc-500 shadow-[0_1px_0_rgba(24,24,27,0.08)] ${className}`}
        >
            {children}
        </kbd>
    )
}
