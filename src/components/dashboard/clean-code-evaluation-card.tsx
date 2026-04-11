'use client'

import { Bot, Sigma, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CleanCodeEvaluation } from '@/types/dev-radar'

export function CleanCodeEvaluationCard({
  cleanCodeEvaluation,
  model,
}: {
  cleanCodeEvaluation: CleanCodeEvaluation | null | undefined
  model: string | null | undefined
}) {
  if (!cleanCodeEvaluation) {
    return (
      <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Gemini 정성 평가
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              아직 계산되지 않음
            </p>
          </div>
          <div className="rounded-full bg-[#f4efff] p-2">
            <Bot className="h-4 w-4 text-[#7d6fff]" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Gemini가 코드 샘플과 정적 분석 근거를 함께 읽고 네이밍, 단일 책임,
          복잡도, 에러 처리, 입력 검증, 모듈화를 항목별로 점수화합니다.
        </p>
      </div>
    )
  }

  const strongest = cleanCodeEvaluation.criteria.reduce((best, current) =>
    current.score > best.score ? current : best,
  )
  const weakest = cleanCodeEvaluation.criteria.reduce((worst, current) =>
    current.score < worst.score ? current : worst,
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Gemini 정성 평가
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              클린 코드 점수
            </p>
          </div>
          <div className="rounded-full bg-[#f4efff] p-2">
            <Bot className="h-4 w-4 text-[#7d6fff]" />
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <div
            className="relative flex h-36 w-36 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#8c7df8 ${cleanCodeEvaluation.score * 3.6}deg, #7ed9c3 ${cleanCodeEvaluation.score * 3.6}deg, #ece8f8 0deg)`,
            }}
          >
            <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <strong className="text-3xl font-black tracking-tight text-slate-900">
                {cleanCodeEvaluation.score}
              </strong>
              <span className="mt-1 text-xs font-semibold text-slate-500">
                / 100
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
            <Sigma className="h-3.5 w-3.5" />
            {cleanCodeEvaluation.formula}
          </span>
          {model ? (
            <span className="rounded-full bg-[#f4efff] px-2.5 py-1 text-[#7163ea]">
              {model}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {cleanCodeEvaluation.summary}
        </p>

        <div className="mt-4 grid gap-3">
          <MiniStat
            icon={TrendingUp}
            label="가장 강한 항목"
            value={`${strongest.label} ${strongest.score}점`}
            tone="green"
          />
          <MiniStat
            icon={TrendingDown}
            label="먼저 볼 항목"
            value={`${weakest.label} ${weakest.score}점`}
            tone="rose"
          />
        </div>
      </div>

      <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              항목별 그래프
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-800">
              6개 기준 비교
            </p>
          </div>
          <p className="text-sm text-slate-500">점수가 낮을수록 먼저 보완</p>
        </div>

        <div className="mt-5 space-y-4">
          {cleanCodeEvaluation.criteria.map((criterion) => (
            <div
              key={criterion.key}
              className="rounded-[20px] border border-[#ece7e2] bg-white/90 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {criterion.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    가중치 {Math.round(criterion.weight * 100)}%
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-semibold',
                    criterion.score >= 80 && 'bg-emerald-50 text-emerald-600',
                    criterion.score >= 60 &&
                      criterion.score < 80 &&
                      'bg-amber-50 text-amber-600',
                    criterion.score < 60 && 'bg-rose-50 text-rose-600',
                  )}
                >
                  {criterion.score}점
                </span>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f1ece6]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    criterion.score >= 80 &&
                      'bg-gradient-to-r from-emerald-400 to-emerald-300',
                    criterion.score >= 60 &&
                      criterion.score < 80 &&
                      'bg-gradient-to-r from-amber-400 to-yellow-300',
                    criterion.score < 60 &&
                      'bg-gradient-to-r from-rose-400 to-orange-300',
                  )}
                  style={{ width: `${criterion.score}%` }}
                />
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {criterion.rationale}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  tone: 'green' | 'rose'
}) {
  const toneClassName =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700'
      : 'border-rose-200 bg-rose-50/80 text-rose-600'

  return (
    <div
      className={cn(
        'rounded-[18px] border px-3 py-3',
        toneClassName,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}
