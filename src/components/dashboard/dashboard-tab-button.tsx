'use client'

import { cn } from '@/lib/utils'

export function DashboardTabButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[20px] border px-4 py-3 text-left transition-colors',
        active
          ? 'border-[#d9d4ff] bg-[#f4efff] text-slate-900'
          : 'border-[#eadfdb] bg-white/80 text-slate-600 hover:bg-white',
      )}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs">{description}</p>
    </button>
  )
}
