'use client'

import { type FormEvent, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Bot,
  BriefcaseBusiness,
  ExternalLink,
  GitBranch,
  Loader2,
  Radar,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react'

import { parseGitHubRepositoryInput } from '@/lib/github/parse-repo-input'
import { cn } from '@/lib/utils'
import type { DashboardAnalysis } from '@/types/dev-radar'
import { MetricBreakdownGrid } from '@/components/dashboard/metric-breakdown-grid'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { RadarMetricChart } from '@/components/dashboard/radar-metric-chart'
import { StaticAnalysisCard } from '@/components/dashboard/static-analysis-card'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

type SummaryKey = 'cleanCodeScore' | 'dailyLines' | 'marketFitAverage' | 'conceptGapCount'

const summaryConfig: Array<{
  key: SummaryKey
  label: string
  unit: string
  icon: typeof Sparkles
}> = [
  {
    key: 'cleanCodeScore',
    label: '코드 품질 점수',
    unit: '점',
    icon: Sparkles,
  },
  {
    key: 'dailyLines',
    label: '추정 일일 LoC',
    unit: 'LoC',
    icon: Activity,
  },
  {
    key: 'marketFitAverage',
    label: '시장 적합도 평균',
    unit: '%',
    icon: BriefcaseBusiness,
  },
  {
    key: 'conceptGapCount',
    label: '보완 포인트',
    unit: '건',
    icon: ShieldAlert,
  },
] as const

export function DashboardShell() {
  const [repoInput, setRepoInput] = useState('')
  const [submittedRepo, setSubmittedRepo] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const headlineStats = analysis
    ? {
        cleanCodeScore: analysis.cleanCodeScore,
        dailyLines: analysis.dailyLines,
        marketFitAverage: Math.round(
          analysis.marketFits.reduce((sum, item) => sum + item.similarityScore, 0) /
            analysis.marketFits.length,
        ),
        conceptGapCount: analysis.conceptGaps.length,
      }
    : null

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const parsed = parseGitHubRepositoryInput(repoInput)

      setError(null)
      setSubmittedRepo(parsed.normalizedFullName)
      setIsLoading(true)

      const response = await fetch('/api/analyze-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: repoInput,
        }),
      })

      const payload = (await response.json()) as DashboardAnalysis | { error?: string }

      if (isApiError(payload)) {
        throw new Error(payload.error ?? '저장소 분석에 실패했습니다.')
      }

      if (!response.ok) {
        throw new Error('저장소 분석에 실패했습니다.')
      }

      setAnalysis(payload)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : '저장소 분석에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-30" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
        <header className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_60px_rgba(235,193,166,0.18)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#8c7df8] via-[#ffb2b2] to-[#7ed9c3] text-lg font-black text-white shadow-[0_16px_30px_rgba(140,125,248,0.28)]">
              DR
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#ff8ca6]">
                실시간 저장소 시그널
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-slate-800 sm:text-4xl">
                Dev-Radar 대시보드
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                GitHub 저장소 URL을 넣으면 실제 메타데이터, 루트 구조, 언어 비율, 최근 커밋
                이력을 바탕으로 실시간 엔지니어링 신호판으로 바꿔드립니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              GitHub 실시간 스캔
            </span>
            <span className="rounded-full border border-[#d9d4ff] bg-[#f3f0ff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
              공개 저장소 즉시 분석
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
              토큰 선택 사항
            </span>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/70 bg-white/76 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d6fff]">
                <GitBranch className="h-4 w-4" />
                분석 시작
              </div>
              <CardTitle className="font-display text-3xl text-slate-800">
                실제 GitHub 저장소 분석
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                입력 형식: 전체 GitHub URL, SSH URL, 또는 <code>owner/repo</code>. 공개
                저장소는 바로 분석되며, <code>GITHUB_TOKEN</code>을 설정하면 더 넉넉한 호출
                한도와 비공개 저장소 접근을 사용할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleAnalyze} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  type="url"
                  value={repoInput}
                  onChange={(event) => setRepoInput(event.target.value)}
                  placeholder="https://github.com/vercel/next.js"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-12 border-[#eadfdb] bg-white text-base text-slate-800 placeholder:text-slate-400"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 min-w-[156px] bg-[#7d6fff] text-white hover:bg-[#6f61f1]"
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      분석 중...
                    </span>
                  ) : (
                    '저장소 분석'
                  )}
                </Button>
              </form>

              <p className="text-xs leading-5 text-slate-500">
                예시: <code>https://github.com/junsuk1226/final</code> 또는{' '}
                <code>junsuk1226/final</code>
              </p>

              {error ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">지원 입력</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">URL / owner/repo</p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">분석 모드</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    {analysis?.engine.label ?? 'GitHub API + 규칙 기반 분석'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">주요 결과</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">저장소 상태 + AI 인사이트</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-[linear-gradient(135deg,rgba(255,247,242,0.98),rgba(243,247,255,0.98))] shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#59b8a0]">
                <Radar className="h-4 w-4" />
                시스템 상태
              </div>
              <CardTitle className="font-display text-3xl text-slate-800">
                실시간 스캔 상태와 현재 포커스
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                GitHub 저장소 데이터는 항상 실시간으로 가져옵니다.{' '}
                <code>GEMINI_API_KEY</code>가 설정되면 원시 저장소 신호 위에 AI 해석
                레이어도 함께 추가됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-500">현재 포커스</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.focusArea ?? '저장소를 입력하면 첫 실시간 신호를 생성합니다.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#d9d4ff] bg-[#f4efff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7d6fff]">마지막 업데이트</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.collectedAt ?? '첫 스캔 대기 중'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#eadfdb] bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">분석 엔진</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.engine.label ?? 'GitHub API + 규칙 기반 분석'}
                </p>
                <p className="mt-2 leading-6 text-slate-600">
                  {analysis?.engine.model
                    ? `AI 모델: ${analysis.engine.model}`
                    : 'GEMINI_API_KEY가 있으면 AI 보강이 자동으로 활성화됩니다.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#eadfdb] bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">최근 분석 저장소</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.repository.fullName ?? submittedRepo ?? '아직 분석한 저장소가 없습니다'}
                </p>
                <p className="mt-2 leading-6 text-slate-600">
                  {analysis?.repository.description ??
                    '다음 스캔에서는 GitHub에서 저장소 메타데이터, 언어 통계, 최근 커밋 활동을 가져옵니다.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {isLoading ? (
          <DashboardSkeleton />
        ) : analysis && headlineStats ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryConfig.map((item) => {
                const Icon = item.icon
                const value = headlineStats[item.key]

                return (
                  <Card
                    key={item.key}
                    className="border-white/70 bg-white/80 shadow-[0_18px_34px_rgba(235,193,166,0.12)]"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">{item.label}</p>
                        <div className="rounded-full bg-[#f4efff] p-2">
                          <Icon className="h-4 w-4 text-[#7d6fff]" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-end gap-2">
                        <strong className="text-3xl font-black tracking-tight text-slate-800">
                          {value}
                        </strong>
                        <span className="pb-1 text-sm text-slate-500">{item.unit}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </section>

            <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7d6fff]">
                        실시간 핵심 지표
                      </p>
                      <CardTitle className="mt-2 text-2xl text-slate-800">
                        카테고리별 저장소 품질 신호
                      </CardTitle>
                    </div>
                    <span className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7d6fff]">
                      실시간 업데이트
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <RadarMetricChart metrics={analysis.metrics} />
                  {analysis.metricBreakdown?.length ? (
                    <div className="space-y-4 border-t border-[#eadfdb] pt-5">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">실제 평가 근거</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          GitHub에서 실제로 감지한 문서, 스크립트, 워크플로 신호를 점수 옆에 함께 보여줍니다.
                        </p>
                      </div>
                      <MetricBreakdownGrid metricBreakdown={analysis.metricBreakdown} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#5f8ae8]">
                      <Sparkles className="h-4 w-4" />
                      Static Analysis
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      LLM 이전에 보는 코드 구조 신호
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-slate-600">
                      샘플 코드에서 네이밍, 함수 크기, 분기 복잡도, 입력 검증, 에러 처리 같은 신호를 먼저 계산합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StaticAnalysisCard staticAnalysis={analysis.staticAnalysis} />
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d6fff]">
                      <Sparkles className="h-4 w-4" />
                      AI 해석
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      {analysis.aiInsight?.headline ?? 'AI 보강을 활성화할 준비가 되었습니다'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    <p className="leading-6">
                      {analysis.aiInsight?.summary ??
                        'GEMINI_API_KEY를 추가한 뒤 다시 분석하면 실제 저장소 데이터를 기반으로 한 AI 요약, 포커스 재해석, AI 제안이 생성됩니다.'}
                    </p>
                    {analysis.aiInsight ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {analysis.aiInsight.strengths.map((strength) => (
                            <span
                              key={strength}
                              className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7163ea]"
                            >
                              {strength}
                            </span>
                          ))}
                        </div>
                        <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">추천 다음 단계</p>
                          <p className="mt-2 leading-6 text-slate-700">{analysis.aiInsight.nextStep}</p>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">현재 동작</p>
                        <p className="mt-2 leading-6 text-slate-700">
                          현재 대시보드는 실시간 GitHub 데이터와 규칙 기반 해석만 표시하고 있습니다.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c66ab4]">
                      <Bot className="h-4 w-4" />
                      {analysis.aiInsight ? 'AI 검토 제안' : '검토 제안'}
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      이 저장소에 가장 효과적인 개선 포인트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.reviewSuggestions.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-slate-800">{item.title}</strong>
                          <span className="rounded-full bg-[#fbe8f7] px-3 py-1 text-xs font-semibold text-[#c66ab4]">
                            {item.impact}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                      </article>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#59b8a0]">
                      <Activity className="h-4 w-4" />
                      실시간 활동 피드
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      GitHub에서 실제로 감지한 내용
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.activity.map((event) => (
                      <article key={event.id} className="grid grid-cols-[auto_1fr] gap-3">
                        <span className="mt-1 rounded-full bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7d6fff]">
                          {event.time}
                        </span>
                        <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                          <strong className="text-slate-800">{event.label}</strong>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</p>
                        </div>
                      </article>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="grid gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#5eb8bf]">
                      <BriefcaseBusiness className="h-4 w-4" />
                      시장 적합도 지표
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      이 저장소가 가장 잘 뒷받침하는 엔지니어링 포지션
                    </CardTitle>
                    <CardDescription className="text-slate-600">
                      이 점수는 AI가 임의로 추천한 진로가 아니라 저장소 구조, 스택 신호,
                      워크플로 파일, 최근 활동을 바탕으로 추정합니다.
                    </CardDescription>
                  </CardHeader>
                <CardContent className="space-y-4">
                  {analysis.marketFits.map((job) => (
                    <article
                      key={job.targetJob}
                      className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <strong className="text-slate-800">{job.targetJob}</strong>
                          <p className="mt-2 text-sm text-slate-600">
                            부족한 신호: {job.missingTech.join(', ')}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-600">
                          {job.similarityScore}%
                        </span>
                      </div>
                      <Progress
                        value={job.similarityScore}
                        className="mt-4"
                        indicatorClassName="bg-gradient-to-r from-[#7ed9c3] to-[#8c7df8]"
                      />
                    </article>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#e39d4f]">
                      <ShieldAlert className="h-4 w-4" />
                      보완 포인트
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      실시간 스캔으로 드러난 구체적 보완점
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {analysis.conceptGaps.map((gap, index) => (
                      <article key={gap.id} className="relative pl-8">
                        {index !== analysis.conceptGaps.length - 1 ? (
                          <span className="absolute left-[11px] top-8 h-[calc(100%+0.75rem)] w-px bg-[#eadfdb]" />
                        ) : null}
                        <span
                          className={cn(
                            'absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-white text-[10px] font-bold uppercase shadow-sm',
                            gap.severity === 'high' && 'border-red-200 text-red-400',
                            gap.severity === 'medium' && 'border-amber-200 text-amber-500',
                            gap.severity === 'low' && 'border-emerald-200 text-emerald-500',
                          )}
                        >
                          {formatSeverity(gap.severity)}
                        </span>
                        <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <strong className="text-slate-800">{gap.title}</strong>
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {gap.timestamp}
                            </span>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                            {gap.category}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-600">{gap.summary}</p>
                          <p className="mt-3 rounded-2xl bg-[#fff4ea] px-3 py-2 text-sm text-slate-600">
                            권장 조치: {gap.recommendation}
                          </p>
                        </div>
                      </article>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d6fff]">
                      <Sparkles className="h-4 w-4" />
                      저장소 스냅샷
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      실제 저장소 메타데이터 한눈에 보기
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">저장소</p>
                          <p className="mt-2 text-lg font-semibold text-slate-800">
                            {analysis.repository.fullName}
                          </p>
                        </div>
                        <a
                          href={analysis.repository.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-[#eadfdb] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          GitHub에서 열기
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="mt-3 leading-6 text-slate-600">
                        {analysis.repository.description ?? 'GitHub에 저장소 설명이 없습니다.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">브랜치</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {analysis.repository.defaultBranch}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">공개 범위</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {formatVisibility(analysis.repository.visibility)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">주 언어</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {analysis.repository.primaryLanguage ?? '알 수 없음'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">스타</p>
                        <p className="mt-2 flex items-center gap-2 font-semibold text-slate-800">
                          <Star className="h-4 w-4 text-amber-400" />
                          {formatNumber(analysis.repository.stars)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">포크</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {formatNumber(analysis.repository.forks)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">열린 이슈</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {formatNumber(analysis.repository.openIssues)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">주요 언어</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {analysis.repository.mainLanguages.map((language) => (
                          <span
                            key={language.name}
                            className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7163ea]"
                          >
                            {language.name} {language.share}%
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        ) : (
          <Card className="border-white/70 bg-white/82 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
            <CardContent className="p-8">
              <div className="max-w-3xl space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d6fff]">
                  첫 실시간 스캔
                </p>
                <h2 className="font-display text-3xl text-slate-800">
                  이제 실제 저장소를 분석할 준비가 되었습니다
                </h2>
                <p className="text-sm leading-7 text-slate-600 sm:text-base">
                  <code>vercel/next.js</code> 같은 공개 저장소나 직접 만든 저장소 URL로
                  시작해보세요. 현재 파이프라인은 GitHub 메타데이터, 루트 파일, 언어 비중,
                  최근 커밋을 실시간으로 분석합니다. <code>GEMINI_API_KEY</code>를
                  추가하면 그 위에 AI 해석 레이어까지 활성화됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatVisibility(value: string) {
  if (value === 'public') {
    return '공개'
  }

  if (value === 'private') {
    return '비공개'
  }

  return value
}

function formatSeverity(value: DashboardAnalysis['conceptGaps'][number]['severity']) {
  if (value === 'high') {
    return '높음'
  }

  if (value === 'medium') {
    return '중간'
  }

  return '낮음'
}

function isApiError(value: DashboardAnalysis | { error?: string }): value is { error?: string } {
  return 'error' in value
}
