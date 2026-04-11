'use client'

import { Sparkles } from 'lucide-react'

export function SummaryActionCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  onClick,
}: {
  icon: typeof Sparkles
  label: string
  value: number
  unit: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[24px] border border-white/70 bg-white/84 p-5 text-left shadow-[0_18px_34px_rgba(235,193,166,0.12)] transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="rounded-full bg-[#f4efff] p-2">
          <Icon className="h-4 w-4 text-[#7d6fff]" />
        </div>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <strong className="text-3xl font-black tracking-tight text-slate-900">
          {value}
        </strong>
        <span className="pb-1 text-sm text-slate-500">{unit}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{hint}</p>
    </button>
  )
}
