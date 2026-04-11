'use client'

import { type FormEvent, useMemo, useState } from 'react'
import {
  AlertCircle,
  BriefcaseBusiness,
  GitBranch,
  Loader2,
  Radar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { CleanCodeEvaluationCard } from '@/components/dashboard/clean-code-evaluation-card'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { DashboardTabButton } from '@/components/dashboard/dashboard-tab-button'
import { DetailModal } from '@/components/dashboard/detail-modal'
import { MetricBreakdownGrid } from '@/components/dashboard/metric-breakdown-grid'
import { RadarMetricChart } from '@/components/dashboard/radar-metric-chart'
import { SummaryActionCard } from '@/components/dashboard/summary-action-card'
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
import { parseGitHubRepositoryInput } from '@/lib/github/parse-repo-input'
import { cn } from '@/lib/utils'
import type { DashboardAnalysis, DevMetric, MetricKey } from '@/types/dev-radar'

type DashboardTab = 'overview' | 'clean-code' | 'market-fit' | 'gaps' | 'activity'
type DetailModalKey = 'repo' | 'metrics' | null

const dashboardTabs: Array<{ key: DashboardTab; label: string; description: string }> = [
  { key: 'overview', label: '요약', description: '내 역량 한눈에 보기' },
  { key: 'clean-code', label: '코드 품질 지수', description: '실무 관점의 코드 품질을 확인합니다.' },
  { key: 'market-fit', label: '직무/실무 적합도', description: '직무 요구사항 대비 내 현황을 봅니다.' },
  { key: 'gaps', label: '집중 성장 포인트', description: '우선적으로 보완할 핵심 역량을 파악합니다.' },
  { key: 'activity', label: '활동 로그', description: '최근 분석 흐름을 봅니다.' },
]

const marketFitLabels = ['프론트엔드 / 풀스택', '백엔드', '플랫폼 / DevOps']
const metricLabelMap: Record<MetricKey, string> = {
  readability: '가독성',
  efficiency: '효율성',
  security: '보안성',
  architecture: '구조 설계',
  consistency: '일관성',
  modernity: '현대성',
}

export function DashboardShell() {
  const [repoInput, setRepoInput] = useState('')
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [activeModal, setActiveModal] = useState<DetailModalKey>(null)
  const [isRetryingAI, setIsRetryingAI] = useState(false)

  const summaryStats = useMemo(() => {
    if (!analysis) {
      return null
    }

    const marketFitAverage = analysis.marketFits.length
      ? Math.round(analysis.marketFits.reduce((sum, item) => sum + item.similarityScore, 0) / analysis.marketFits.length)
      : 0

    return {
      cleanCodeScore: analysis.cleanCodeScore,
      marketFitAverage,
      conceptGapCount: analysis.conceptGaps.length,
      criteriaCount: analysis.cleanCodeEvaluation?.criteria.length ?? 6,
    }
  }, [analysis])

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const parsed = parseGitHubRepositoryInput(repoInput)

      setError(null)
      setIsLoading(true)
      setActiveTab('overview')

      const response = await fetch('/api/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoInput }),
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

  async function retryAIAnalysis() {
    if (!repoInput) return
    setIsRetryingAI(true)
    try {
      const response = await fetch('/api/analyze-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoInput }),
      })
      const payload = await response.json()
      if (response.ok && !('error' in payload)) {
        setAnalysis(payload as DashboardAnalysis)
      }
    } finally {
      setIsRetryingAI(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fff9f3_0%,#f9f7ff_48%,#f5fbf8_100%)]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 xl:px-8">
        <section className="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_60px_rgba(235,193,166,0.16)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfdb] bg-[#fff8f2] px-3 py-1 text-xs font-semibold text-[#7d6fff]">
                <Radar className="h-3.5 w-3.5" />
                내 역량 한눈에 보기
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                개발 역량 집중 분석 대시보드
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                핵심 역량 지표와 집중 성장 포인트를 먼저 짚어주며, 상세 내용은 탭과 팝업으로 깊이 있게 분석할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip label="GitHub 저장소 분석" tone="green" />
              <StatusChip label={analysis?.engine.mode === 'hybrid-ai' ? 'Gemini 정성 평가' : '기본 분석 모드'} tone={analysis?.engine.mode === 'hybrid-ai' ? 'violet' : 'slate'} />
              <StatusChip label="페이지 이동 없는 상세 보기" tone="rose" />
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
            <Button type="submit" disabled={isLoading} className="h-12 min-w-[160px] bg-[#7d6fff] text-white hover:bg-[#6f61f1]">
              {isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />분석 중</span> : '저장소 분석'}
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span>입력 예시: `owner/repo` 또는 GitHub URL</span>
            <span>공개 저장소는 바로 분석됩니다.</span>
            <span>GITHUB_TOKEN이 있으면 호출 한도가 더 안정적입니다.</span>
          </div>

          {error ? (
            <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            </div>
          ) : null}
        </section>

        {isLoading ? (
          <DashboardSkeleton />
        ) : analysis && summaryStats ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryActionCard
                icon={Sparkles}
                label="코드 품질 지수"
                value={summaryStats.cleanCodeScore}
                unit="점"
                hint="실무 투입 가능 척도"
                onClick={() => setActiveTab('clean-code')}
              />
              <SummaryActionCard
                icon={BriefcaseBusiness}
                label="직무/실무 적합도"
                value={summaryStats.marketFitAverage}
                unit="%"
                hint="직무별 평균 적합도"
                onClick={() => setActiveTab('market-fit')}
              />
              <SummaryActionCard
                icon={ShieldAlert}
                label="보완 필요 집중 역량"
                value={summaryStats.conceptGapCount}
                unit="개"
                hint="우선순위 확인"
                onClick={() => setActiveTab('gaps')}
              />
              <SummaryActionCard
                icon={GitBranch}
                label="핵심 개발 역량"
                value={summaryStats.criteriaCount}
                unit="개"
                hint="육각형 지표 항목"
                onClick={() => setActiveTab('clean-code')}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <Card className="border-white/70 bg-white/84">
                <CardHeader className="pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d6fff]">
                        한눈에 보기
                      </p>
                      <CardTitle className="mt-2 text-2xl text-slate-900">
                        {analysis.repository.fullName}
                      </CardTitle>
                      <CardDescription className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        {analysis.repository.description ?? '저장소 설명이 없어서 코드와 메타데이터 기반으로 분석했습니다.'}
                      </CardDescription>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => setActiveModal('repo')}>
                      저장소 상세
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <InfoPill label={formatVisibility(analysis.repository.visibility)} />
                    <InfoPill label={`주 언어 ${analysis.repository.primaryLanguage ?? '정보 없음'}`} />
                    <InfoPill label={`기본 브랜치 ${analysis.repository.defaultBranch}`} />
                    <InfoPill label={`최근 업데이트 ${formatDateLabel(analysis.repository.updatedAt)}`} />
                  </div>

                  <RadarMetricChart metrics={analysis.metrics} />

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="secondary" onClick={() => setActiveModal('metrics')}>
                      평가 근거 보기
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/84">
                <CardHeader className="pb-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#59b8a0]">
                    빠른 진단
                  </p>
                  <CardTitle className="mt-2 text-2xl text-slate-900">
                    우선 집중해야 할 성장 포인트
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <QuickInfoCard
                    title="핵심 포커스"
                    description={`${getFocusAreaLabel(analysis.metrics)} 역량부터 보완하면 가장 즉각적인 성장이 기대됩니다.`}
                    tone="violet"
                  />
                  <QuickInfoCard
                    title="분석 엔진"
                    description={formatEngineLabel(analysis)}
                    tone="green"
                  />
                  <QuickInfoCard
                    title="요약"
                    description={getInsightSummary(analysis)}
                    tone="slate"
                  />

                  <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">강점</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getInsightStrengths(analysis).map((strength) => (
                        <span key={strength} className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">다음 액션</p>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{getNextStep(analysis)}</p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {dashboardTabs.map((tab) => (
                  <DashboardTabButton
                    key={tab.key}
                    active={activeTab === tab.key}
                    label={tab.label}
                    description={tab.description}
                    onClick={() => setActiveTab(tab.key)}
                  />
                ))}
              </div>

              <Card className="border-white/70 bg-white/84">
                <CardContent className="p-5 sm:p-6">
                  {renderTabContent({ 
                    activeTab, 
                    analysis, 
                    onOpenModal: setActiveModal,
                    onRetryAI: retryAIAnalysis,
                    isRetryingAI
                  })}
                </CardContent>
              </Card>
            </section>
          </>
        ) : (
          <Card className="border-white/70 bg-white/84">
            <CardContent className="p-8">
              <div className="max-w-3xl space-y-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d6fff]">
                  시작 안내
                </p>
                <h2 className="text-3xl font-semibold text-slate-900">
                  저장소를 넣으면 요약 중심 화면으로 정리해드립니다
                </h2>
                <p className="text-sm leading-7 text-slate-600 sm:text-base">
                  결과를 한 번에 길게 펼치지 않고, 핵심 지표와 다음 액션만 먼저 보여준 뒤 세부 내용은 탭과 팝업으로 열어보는 구조입니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {analysis ? (
        <>
          <DetailModal
            open={activeModal === 'repo'}
            title="저장소 상세 정보"
            description="저장소 메타데이터와 주요 언어 정보를 한 번에 확인합니다."
            onClose={() => setActiveModal(null)}
          >
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-[24px] border border-[#eadfdb] bg-white/90 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">저장소 개요</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{analysis.repository.fullName}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {analysis.repository.description ?? '저장소 설명이 등록되어 있지 않습니다.'}
                </p>
                <a
                  href={analysis.repository.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 rounded-full border border-[#eadfdb] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  GitHub에서 보기
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <RepoStatCard label="공개 범위" value={formatVisibility(analysis.repository.visibility)} />
                <RepoStatCard label="기본 브랜치" value={analysis.repository.defaultBranch} />
                <RepoStatCard label="주 언어" value={analysis.repository.primaryLanguage ?? '정보 없음'} />
                <RepoStatCard label="최근 푸시" value={formatDateLabel(analysis.repository.lastPushAt)} />
                <RepoStatCard label="스타" value={formatNumber(analysis.repository.stars)} />
                <RepoStatCard label="포크" value={formatNumber(analysis.repository.forks)} />
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-[#eadfdb] bg-white/90 p-5 shadow-sm">
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
          </DetailModal>

          <DetailModal
            open={activeModal === 'metrics'}
            title="육각형 개발자 지표 세부 근거"
            description="각 역량 지수가 왜 이런 평가를 받았는지, 저장소 분석 근거를 함께 봅니다."
            onClose={() => setActiveModal(null)}
          >
            {analysis.metricBreakdown?.length ? (
              <MetricBreakdownGrid metricBreakdown={analysis.metricBreakdown} />
            ) : (
              <EmptyDetailMessage message="아직 평가 근거가 준비되지 않았습니다." />
            )}
          </DetailModal>

        </>
      ) : null}
    </main>
  )
}

function renderTabContent({
  activeTab,
  analysis,
  onOpenModal,
  onRetryAI,
  isRetryingAI,
}: {
  activeTab: DashboardTab
  analysis: DashboardAnalysis
  onOpenModal: (value: DetailModalKey) => void
  onRetryAI?: () => void
  isRetryingAI?: boolean
}) {
  if (activeTab === 'overview') {
    return (
      <div className="grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
        <div className="space-y-4">
          <SectionTitle title={getInsightHeadline(analysis)} description={getInsightSummary(analysis)} />
          <div className="grid gap-3">
            {getDisplayRecommendations(analysis).map((item) => (
              <article key={item.title} className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{item.title}</strong>
                  <span className="rounded-full bg-[#fbe8f7] px-3 py-1 text-xs font-semibold text-[#c66ab4]">{item.impact}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">저장소 상태</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InlineInfo label="분석 모드" value={formatEngineLabel(analysis)} />
              <InlineInfo label="최근 업데이트" value={analysis.collectedAt} />
              <InlineInfo label="포커스 영역" value={getFocusAreaLabel(analysis.metrics)} />
              <InlineInfo label="주 언어" value={analysis.repository.primaryLanguage ?? '정보 없음'} />
            </div>
          </div>

          <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">직무 적합도 요약</p>
                <p className="mt-2 text-sm text-slate-600">주요 직무에 내 역량이 얼마나 부합하는지 미리 봅니다.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => onOpenModal('metrics')}>
                근거 보기
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {analysis.marketFits.map((item, index) => (
                <div key={`${item.targetJob}-${index}`} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{marketFitLabels[index] ?? `직무 ${index + 1}`}</span>
                    <span className="font-semibold text-slate-900">{item.similarityScore}%</span>
                  </div>
                  <Progress value={item.similarityScore} className="h-2" indicatorClassName="bg-gradient-to-r from-[#7ed9c3] to-[#8c7df8]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activeTab === 'clean-code') {
    return (
      <CleanCodeEvaluationCard 
        cleanCodeEvaluation={analysis.cleanCodeEvaluation} 
        model={analysis.engine.model} 
        onRetry={onRetryAI}
        isRetrying={isRetryingAI}
      />
    )
  }

  if (activeTab === 'market-fit') {
    return (
      <div className="space-y-4">
        <SectionTitle title="직무별 실무 적합도" description="직무별로 필요한 기술 스택 대비 내 저장소의 코드를 분석하여 적합도를 안내합니다." />
        <div className="grid gap-4">
          {analysis.marketFits.map((item, index) => (
            <article key={`${item.targetJob}-${index}`} className="flex flex-col justify-between rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <strong className="text-lg font-bold text-slate-900">{marketFitLabels[index] ?? `직무 ${index + 1}`}</strong>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-600">추가 확보 권장 기술:</p>
                    {item.missingTech.length > 0 ? (
                      item.missingTech.map(tech => (
                        <span key={tech} className="inline-flex items-center rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600 ring-1 ring-inset ring-rose-500/20">
                          {tech}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">충분함</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-center rounded-full bg-emerald-50 px-4 py-1.5 font-bold text-emerald-600 shadow-sm ring-1 ring-inset ring-emerald-500/20">
                  {item.similarityScore}%
                </div>
              </div>
              <div className="mt-5">
                <Progress value={item.similarityScore} className="h-2.5 shadow-inner bg-slate-100" indicatorClassName="bg-gradient-to-r from-emerald-400 to-[#7d6fff]" />
              </div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  if (activeTab === 'gaps') {
    return (
      <div className="space-y-4">
        <SectionTitle title="우선 집중해야 할 갭(Gap)과 성장 포인트" description="내 목표에 도달하기 위해 가장 먼저 채워야 할 역량들을 중요도 순으로 정리했습니다." />
        <div className="grid gap-4">
          {getDisplayGaps(analysis).map((gap) => (
            <article key={gap.title} className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-slate-900">{gap.title}</strong>
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', gap.severity === 'high' && 'bg-rose-50 text-rose-600', gap.severity === 'medium' && 'bg-amber-50 text-amber-600', gap.severity === 'low' && 'bg-emerald-50 text-emerald-600')}>
                  {formatSeverity(gap.severity)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{gap.summary}</p>
              <div className="mt-3 rounded-2xl bg-[#fff4ea] px-3 py-2 text-sm text-slate-700">권장 조치: {gap.recommendation}</div>
            </article>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="최근 활동 로그" description="현재 페이지를 벗어나지 않고 최근 분석 이력만 간단히 확인합니다." />
      <div className="grid gap-3">
        {analysis.activity.map((event) => (
          <article key={event.id} className="grid gap-3 rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm sm:grid-cols-[96px_1fr]">
            <span className="inline-flex h-fit items-center justify-center rounded-full bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
              {event.time}
            </span>
            <div>
              <strong className="text-slate-900">{event.label}</strong>
              <p className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function InlineInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfdb] bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function RepoStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#eadfdb] bg-white/90 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function InfoPill({ label }: { label: string }) {
  return <span className="rounded-full border border-[#eadfdb] bg-white px-3 py-1 text-xs font-semibold text-slate-600">{label}</span>
}

function StatusChip({ label, tone }: { label: string; tone: 'green' | 'violet' | 'rose' | 'slate' }) {
  const className = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'violet'
      ? 'border-[#d9d4ff] bg-[#f4efff] text-[#7163ea]'
      : tone === 'rose'
        ? 'border-rose-200 bg-rose-50 text-rose-600'
        : 'border-slate-200 bg-slate-50 text-slate-600'

  return <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', className)}>{label}</span>
}

function QuickInfoCard({ title, description, tone }: { title: string; description: string; tone: 'violet' | 'green' | 'slate' }) {
  const toneClassName = tone === 'violet'
    ? 'border-[#d9d4ff] bg-[#f4efff]'
    : tone === 'green'
      ? 'border-emerald-200 bg-emerald-50/80'
      : 'border-[#eadfdb] bg-[#fffdfb]'

  return (
    <div className={cn('rounded-[24px] border p-4 shadow-sm', toneClassName)}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
    </div>
  )
}

function EmptyDetailMessage({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-[#eadfdb] bg-white/90 p-5 text-sm text-slate-600 shadow-sm">{message}</div>
}

function getInsightHeadline(analysis: DashboardAnalysis) {
  return analysis.aiInsight?.headline ?? '핵심 지표 요약'
}

function getInsightSummary(analysis: DashboardAnalysis) {
  return analysis.aiInsight?.summary ?? `${getFocusAreaLabel(analysis.metrics)}이 상대적으로 낮아서 먼저 보완하는 것이 좋습니다.`
}

function getInsightStrengths(analysis: DashboardAnalysis) {
  if (analysis.aiInsight?.strengths?.length) {
    return analysis.aiInsight.strengths
  }

  return rankMetrics(analysis.metrics, 'desc').slice(0, 3).map((entry) => metricLabelMap[entry.key])
}

function getNextStep(analysis: DashboardAnalysis) {
  return analysis.aiInsight?.nextStep ?? `${getFocusAreaLabel(analysis.metrics)}과 관련된 구조나 규칙을 우선 정리해보세요.`
}

function getDisplayRecommendations(analysis: DashboardAnalysis) {
  if (analysis.aiInsight) {
    return analysis.reviewSuggestions
  }

  const weakMetrics = rankMetrics(analysis.metrics, 'asc').slice(0, 3)
  const weakCriteria = analysis.cleanCodeEvaluation?.criteria.slice().sort((left, right) => left.score - right.score).slice(0, 2) ?? []

  return weakMetrics.map((entry, index) => ({
    title: index === 0 && weakCriteria[0] ? `${weakCriteria[0].label} 기준 보완` : `${metricLabelMap[entry.key]} 개선`,
    impact: metricLabelMap[entry.key],
    description: index === 0 && weakCriteria[0]
      ? weakCriteria[0].rationale
      : `${metricLabelMap[entry.key]} 점수가 낮아 관련 구조와 규칙을 먼저 정리하는 것이 좋습니다.`,
  }))
}

function getDisplayGaps(analysis: DashboardAnalysis): Array<{
  title: string
  severity: 'high' | 'medium' | 'low'
  summary: string
  recommendation: string
}> {
  if (analysis.aiInsight) {
    return analysis.conceptGaps.map((item) => ({
      title: item.title,
      severity: item.severity,
      summary: item.summary,
      recommendation: item.recommendation,
    }))
  }

  return rankMetrics(analysis.metrics, 'asc').slice(0, 3).map((entry, index) => ({
    title: `${metricLabelMap[entry.key]} 보완`,
    severity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
    summary: `${metricLabelMap[entry.key]} 점수가 다른 영역보다 낮아서 우선 확인이 필요합니다.`,
    recommendation: `${metricLabelMap[entry.key]}과 연결된 코드 구조나 규칙을 먼저 정리해보세요.`,
  }))
}

function rankMetrics(metrics: DevMetric, order: 'asc' | 'desc') {
  return (Object.entries(metrics) as Array<[MetricKey, number]>)
    .sort((left, right) => order === 'asc' ? left[1] - right[1] : right[1] - left[1])
    .map(([key, value]) => ({ key, value }))
}

function getFocusAreaLabel(metrics: DevMetric) {
  return metricLabelMap[rankMetrics(metrics, 'asc')[0]?.key ?? 'readability']
}

function formatEngineLabel(analysis: DashboardAnalysis) {
  if (analysis.engine.mode === 'hybrid-ai') {
    return analysis.engine.model ? `GitHub 분석 + ${analysis.engine.model}` : 'GitHub 분석 + Gemini'
  }

  return 'GitHub 메타데이터 기반 분석'
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

function formatSeverity(value: 'high' | 'medium' | 'low') {
  if (value === 'high') {
    return '높음'
  }

  if (value === 'medium') {
    return '중간'
  }

  return '낮음'
}

function formatDateLabel(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function isApiError(value: DashboardAnalysis | { error?: string }): value is { error?: string } {
  return 'error' in value
}
