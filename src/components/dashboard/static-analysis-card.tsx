'use client'

import { AlertTriangle, SearchCode } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { StaticCodeAnalysis } from '@/types/dev-radar'

export function StaticAnalysisCard({
  staticAnalysis,
}: {
  staticAnalysis: StaticCodeAnalysis | null | undefined
}) {
  if (!staticAnalysis) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              정적 분석
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              평균 {staticAnalysis.averageScore}점
            </p>
          </div>
          <div className="rounded-full bg-[#f4efff] p-2">
            <SearchCode className="h-4 w-4 text-[#7d6fff]" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {staticAnalysis.coverageSummary}
        </p>
      </div>

      <div className="space-y-3">
        {staticAnalysis.rules.map((rule) => (
          <div
            key={rule.key}
            className="rounded-[20px] border border-[#eadfdb] bg-white/90 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{rule.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  가중치 {Math.round(rule.weight * 100)}%
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-semibold',
                  rule.score >= 80 && 'bg-emerald-50 text-emerald-600',
                  rule.score >= 60 &&
                    rule.score < 80 &&
                    'bg-amber-50 text-amber-600',
                  rule.score < 60 && 'bg-rose-50 text-rose-600',
                )}
              >
                {rule.score}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-2 rounded-full',
                  rule.score >= 80 && 'bg-emerald-400',
                  rule.score >= 60 &&
                    rule.score < 80 &&
                    'bg-amber-400',
                  rule.score < 60 && 'bg-rose-400',
                )}
                style={{ width: `${rule.score}%` }}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {rule.evidence}
            </p>
          </div>
        ))}
      </div>

      {staticAnalysis.findings.length > 0 ? (
        <div className="rounded-[24px] border border-[#f3d9cc] bg-[#fff8f2] p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#d17b3f]">
            <AlertTriangle className="h-4 w-4" />
            정적 분석 결과
          </div>
          <div className="mt-3 space-y-3">
            {staticAnalysis.findings.map((finding) => (
              <div
                key={finding.id}
                className="rounded-2xl border border-[#eadfdb] bg-white/90 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {finding.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {finding.path}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold uppercase',
                      finding.severity === 'high' &&
                        'bg-rose-50 text-rose-600',
                      finding.severity === 'medium' &&
                        'bg-amber-50 text-amber-600',
                      finding.severity === 'low' &&
                        'bg-emerald-50 text-emerald-600',
                    )}
                  >
                    {formatSeverityLabel(finding.severity)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {finding.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatSeverityLabel(
  severity: StaticCodeAnalysis['findings'][number]['severity'],
) {
  if (severity === 'high') {
    return '높음'
  }

  if (severity === 'medium') {
    return '중간'
  }

  return '낮음'
}
