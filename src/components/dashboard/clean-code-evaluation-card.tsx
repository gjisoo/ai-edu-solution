'use client'

import { Bot, Loader2, RefreshCw, Sigma, TrendingDown, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { CleanCodeEvaluation, ContributorInsight } from '@/types/dev-radar'

export function CleanCodeEvaluationCard({
  cleanCodeEvaluation,
  contributorInsights,
  model,
  onRetry,
  isRetrying = false,
}: {
  cleanCodeEvaluation: CleanCodeEvaluation | null | undefined
  contributorInsights?: ContributorInsight[]
  model: string | null | undefined
  onRetry?: () => void
  isRetrying?: boolean
}) {
  if (!cleanCodeEvaluation) {
    return (
      <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Gemini 실무 역량 종합 평가
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-800">
              AI 분석 데이터 없음 (또는 지연)
            </p>
          </div>
          <div className="rounded-full bg-[#f4efff] p-2">
            <Bot className="h-5 w-5 text-[#7d6fff]" />
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">
          시간 초과나 저장소 크기 문제로 인해 AI 상세 분석이 완료되지 못했습니다.<br/>
          아래 버튼을 눌러 이 부분에 대한 데이터만 다시 수집을 시도해볼 수 있습니다.
        </p>
        {onRetry && (
          <Button 
            onClick={onRetry} 
            disabled={isRetrying} 
            className="mt-6 h-11 bg-[#7d6fff] px-6 text-white hover:bg-[#6f61f1] shadow-sm rounded-xl"
          >
            {isRetrying ? (
              <span className="inline-flex items-center gap-2 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" /> 다시 수집하는 중...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 font-medium">
                <RefreshCw className="h-4 w-4" /> AI 평가만 다시 시도
              </span>
            )}
          </Button>
        )}
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
    <div className="flex flex-col gap-6">
      {/* Top Banner (Score) */}
      <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-gradient-to-br from-white/90 to-white/50 p-6 shadow-[0_24px_60px_rgba(235,193,166,0.16)] backdrop-blur-xl md:p-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between lg:items-center">
          
          <div className="flex flex-1 flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f4efff] px-3 py-1 shadow-sm">
              <Bot className="h-4 w-4 text-[#7d6fff]" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7163ea]">
                Gemini 실무 역량 종합 평가
              </p>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              실무 투입 가능 지수
            </h2>
            <p className="mt-2 max-w-xl text-base leading-7 text-slate-600">
              {cleanCodeEvaluation.summary}
            </p>

          </div>

          <div className="flex shrink-0 items-center justify-center">
            <div
              className="relative flex h-48 w-48 items-center justify-center rounded-full shadow-xl"
              style={{
                background: `conic-gradient(#8c7df8 ${cleanCodeEvaluation.score * 3.6}deg, #7ed9c3 ${cleanCodeEvaluation.score * 3.6}deg, #f1ece6 0deg)`,
              }}
            >
              <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_4px_12px_rgba(0,0,0,0.05)]">
                <strong className="text-5xl font-black tracking-tighter text-slate-900">
                  {cleanCodeEvaluation.score}
                </strong>
                <span className="mt-1 text-sm font-bold uppercase tracking-widest text-slate-400">
                  Score
                </span>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <MiniStat
            icon={TrendingUp}
            label="가장 뛰어난 강점 역량"
            value={`${strongest.label} ${strongest.score}점`}
            tone="green"
          />
          <MiniStat
            icon={TrendingDown}
            label="우선 보완 필요 역량"
            value={`${weakest.label} ${weakest.score}점`}
            tone="rose"
          />
        </div>
      </div>

      {/* Bottom Grid (Criteria) */}
      <div className="rounded-[32px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-md md:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#59b8a0]">
            핵심 역량별 그래프
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-2xl font-bold text-slate-900">
              실무 기준 6대 역량 요소 분석
            </h3>
            <p className="text-sm font-medium text-slate-500">
              이력서와 포트폴리오의 강점으로 적극 활용해 보세요.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {cleanCodeEvaluation.criteria.map((criterion) => (
            <div
              key={criterion.key}
              className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d9d4ff] hover:shadow-[0_20px_40px_-12px_rgba(113,99,234,0.15)]"
            >
              {/* Subtle top inner glow for premium feel */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#f4efff] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xl font-bold text-slate-900 transition-colors group-hover:text-[#7d6fff]">
                      {criterion.label}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                        가중치
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        {Math.round(criterion.weight * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  <div
                    className={cn(
                      'flex shrink-0 flex-col items-center justify-center rounded-2xl border px-4 py-2 font-black shadow-sm transition-colors',
                      criterion.score >= 80 && 'border-emerald-100 bg-emerald-50 text-emerald-600 group-hover:border-emerald-200 group-hover:bg-emerald-100',
                      criterion.score >= 60 &&
                        criterion.score < 80 &&
                        'border-amber-100 bg-amber-50 text-amber-600 group-hover:border-amber-200 group-hover:bg-amber-100',
                      criterion.score < 60 && 'border-rose-100 bg-rose-50 text-rose-600 group-hover:border-rose-200 group-hover:bg-rose-100',
                    )}
                  >
                    <span className="text-2xl tracking-tight leading-none">{criterion.score}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">점</span>
                  </div>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000 ease-out',
                      criterion.score >= 80 &&
                        'bg-gradient-to-r from-emerald-400 to-emerald-300',
                      criterion.score >= 60 &&
                        criterion.score < 80 &&
                        'bg-gradient-to-r from-amber-400 to-amber-300',
                      criterion.score < 60 &&
                        'bg-gradient-to-r from-rose-400 to-rose-300',
                    )}
                    style={{ width: `${criterion.score}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50/80 p-5 group-hover:bg-[#fcfaff] transition-colors duration-300">
                <p className="text-[15px] leading-[1.8] text-slate-700 font-medium">
                  {criterion.rationale}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {contributorInsights && contributorInsights.length > 1 && (
        <div className="rounded-[32px] border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-md md:p-8">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7163ea]">
              협업 기여자 분석
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-2xl font-bold text-slate-900">
                기여자별 코드 품질 집중 분석
              </h3>
              <p className="text-sm font-medium text-slate-500">
                여러 명이 함께 작성한 저장소입니다. 각 기여자별 성과를 확인해 보세요.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {contributorInsights.map((contributor) => (
              <article key={contributor.id} className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#d9d4ff] hover:shadow-[0_20px_40px_-12px_rgba(113,99,234,0.15)]">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#f4efff] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <strong className="text-xl font-bold text-slate-900 transition-colors group-hover:text-[#7d6fff]">
                      {contributor.handle ? `@${contributor.handle}` : contributor.name}
                    </strong>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
                        {contributor.focusArea}
                      </span>
                    </div>
                  </div>
                  <div className={cn('flex shrink-0 flex-col items-center justify-center rounded-2xl border px-4 py-2 font-black shadow-sm transition-colors', getQualityScoreSecondaryClassName(contributor.codeQualityScore))}>
                    <span className="text-2xl tracking-tight leading-none">{contributor.codeQualityScore}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">코드 품질 점수</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InlineInfo label="최근 커밋" value={`${contributor.recentCommitCount}건`} />
                  <InlineInfo label="누적 기여" value={formatContributionCount(contributor.totalContributions)} />
                  <InlineInfo label="최근 활동" value={formatDateLabel(contributor.recentCommitAt ?? '')} />
                </div>

                <div className="mt-5 rounded-2xl border border-[#eadfdb] bg-slate-50/50 px-5 py-5 group-hover:bg-[#fcfaff] transition-colors duration-300">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400 font-bold">코드 품질 요약</p>
                  <p className="mt-3 text-[15px] leading-[1.8] text-slate-700 font-medium">{contributor.codeQualitySummary}</p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>네이밍</span>
                        <span>{contributor.codeQualityBreakdown.naming}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.naming} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-emerald-400 to-[#10b981]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>단일 책임</span>
                        <span>{contributor.codeQualityBreakdown.singleResponsibility}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.singleResponsibility} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-blue-400 to-[#3b82f6]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>복잡도</span>
                        <span>{contributor.codeQualityBreakdown.complexity}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.complexity} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-amber-400 to-[#f59e0b]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>에러 처리</span>
                        <span>{contributor.codeQualityBreakdown.errorHandling}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.errorHandling} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-rose-400 to-[#f43f5e]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>입력 검증</span>
                        <span>{contributor.codeQualityBreakdown.validation}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.validation} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-fuchsia-400 to-[#d946ef]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-600">
                        <span>모듈화</span>
                        <span>{contributor.codeQualityBreakdown.modularity}점</span>
                      </div>
                      <Progress value={contributor.codeQualityBreakdown.modularity} className="mt-2 h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-cyan-400 to-[#06b6d4]" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid sm:grid-cols-2 gap-5">
                  <div className="rounded-2xl border border-[#eadfdb] bg-white px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-emerald-600 font-bold">강점 (Strengths)</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {contributor.strengths.map((strength) => (
                        <span key={strength} className="rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#eadfdb] bg-white px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-amber-600 font-bold">리스크 요인</p>
                    <p className="mt-3 text-[14px] leading-[1.7] text-slate-700 font-medium">{contributor.risk}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-[#fff4ea] px-5 py-4 text-[14px] font-medium leading-[1.7] text-amber-900 border border-amber-100">
                  <span className="font-bold text-amber-600 mr-2">권장 액션:</span>{contributor.recommendation}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
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

function InlineInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#eadfdb] bg-white px-4 py-4 transition-colors hover:border-[#d9d4ff]">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-base font-bold text-slate-800">{value}</p>
    </div>
  )
}

function getQualityScoreSecondaryClassName(score: number) {
  if (score >= 80) return 'border-emerald-100 bg-emerald-50 text-emerald-600 group-hover:border-emerald-200 group-hover:bg-emerald-100'
  if (score >= 65) return 'border-amber-100 bg-amber-50 text-amber-600 group-hover:border-amber-200 group-hover:bg-amber-100'
  return 'border-rose-100 bg-rose-50 text-rose-600 group-hover:border-rose-200 group-hover:bg-rose-100'
}

function formatContributionCount(value: number | null) {
  if (typeof value !== 'number') return '정보 없음'
  const formatted = new Intl.NumberFormat('ko-KR', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
  return `${formatted}회`
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

