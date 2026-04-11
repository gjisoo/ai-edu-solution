'use client'

import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { MetricBreakdown } from '@/types/dev-radar'

export function MetricBreakdownGrid({
  metricBreakdown,
}: {
  metricBreakdown: MetricBreakdown[]
}) {
  if (metricBreakdown.length === 0) {
    return null
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metricBreakdown.map((item) => (
        <article
          key={item.metric}
          className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">평가 근거</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-800">{item.label}</h3>
            </div>
            <span className="rounded-full bg-[#f4efff] px-3 py-1 text-sm font-semibold text-[#7163ea]">
              {item.score}점
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>

          <div className="mt-4 flex flex-col gap-2">
            {item.signals.map((signal) => (
              <div
                key={`${item.metric}-${signal.label}`}
                className={cn(
                  'flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm',
                  signal.status === 'positive' && 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
                  signal.status === 'warning' && 'border-amber-100 bg-amber-50/80 text-amber-700',
                  signal.status === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-600',
                )}
              >
                <SignalStatusIcon status={signal.status} />
                <div>
                  <p className="font-semibold">{signal.label}</p>
                  <p className="mt-1 leading-5">{signal.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

function SignalStatusIcon({
  status,
}: {
  status: MetricBreakdown['signals'][number]['status']
}) {
  const className = 'mt-0.5 h-4 w-4 shrink-0'

  if (status === 'positive') {
    return <CheckCircle2 className={className} />
  }

  if (status === 'warning') {
    return <AlertTriangle className={className} />
  }

  return <CircleDashed className={className} />
}
