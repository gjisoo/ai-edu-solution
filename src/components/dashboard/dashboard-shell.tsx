'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Activity,
  Bot,
  BriefcaseBusiness,
  GitBranch,
  Radar,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'

import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { RadarMetricChart } from '@/components/dashboard/radar-metric-chart'
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
import { createDashboardAnalysis } from '@/lib/dev-radar/mock-data'
import { cn } from '@/lib/utils'

const summaryConfig = [
  {
    key: 'cleanCodeScore',
    label: '클린 코드 점수',
    unit: '점',
    icon: Sparkles,
  },
  {
    key: 'dailyLines',
    label: '일일 코드량',
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
    label: '개념 결손 포착',
    unit: '건',
    icon: ShieldAlert,
  },
] as const

export function DashboardShell() {
  const [githubId, setGithubId] = useState('dev-radar-demo')
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState(() => createDashboardAnalysis('dev-radar-demo'))
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const headlineStats = useMemo(
    () => ({
      cleanCodeScore: analysis.cleanCodeScore,
      dailyLines: analysis.dailyLines,
      marketFitAverage: Math.round(
        analysis.marketFits.reduce((sum, item) => sum + item.similarityScore, 0) /
          analysis.marketFits.length,
      ),
      conceptGapCount: analysis.conceptGaps.length,
    }),
    [analysis],
  )

  function handleAnalyze() {
    const normalized = githubId.trim().replace(/^@/, '')
    if (!normalized) {
      return
    }

    setSubmittedId(normalized)
    setIsLoading(true)

    window.setTimeout(() => {
      startTransition(() => {
        setAnalysis(createDashboardAnalysis(normalized))
        setIsLoading(false)
      })
    }, 1200)
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
                Real-time growth tracking
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-slate-800 sm:text-4xl">
                Dev-Radar Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                IDE와 GitHub 활동을 바탕으로 코드 품질, 개념 결손, 채용 시장 적합도를
                실시간으로 시각화하는 고정밀 개발 역량 관제 화면입니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              IDE Live Sync
            </span>
            <span className="rounded-full border border-[#d9d4ff] bg-[#f3f0ff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
              GitHub Connected
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
              JD Matching Active
            </span>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/70 bg-white/76 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#7d6fff]">
                <GitBranch className="h-4 w-4" />
                Analysis Trigger
              </div>
              <CardTitle className="font-display text-3xl text-slate-800">
                GitHub ID를 입력하면 Dev-Radar가 즉시 역량 지도를 생성합니다
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                공모전 MVP에서는 GitHub ID를 입력하면 실시간 분석 UX를 시연하고, 이후
                클린 코드 점수, 6각형 역량 지표, Market-Fit Index가 순차적으로 활성화되는
                흐름을 보여줍니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={githubId}
                  onChange={(event) => setGithubId(event.target.value)}
                  placeholder="예: radar-student-01"
                  className="h-12 border-[#eadfdb] bg-white text-base text-slate-800 placeholder:text-slate-400"
                />
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isPending || isLoading}
                  className="h-12 min-w-[148px] bg-[#7d6fff] text-white hover:bg-[#6f61f1]"
                >
                  {isPending || isLoading ? '분석 중...' : '분석 시작'}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Input Source</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">VS Code + GitHub</p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">AI Layer</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">LLM + RAG + Static Analysis</p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Primary Output</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">Hexagon Metric + Market Fit</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-[linear-gradient(135deg,rgba(255,247,242,0.98),rgba(243,247,255,0.98))] shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#59b8a0]">
                <Radar className="h-4 w-4" />
                System Status
              </div>
              <CardTitle className="font-display text-3xl text-slate-800">
                성장 안개를 걷어내는 정량형 관제
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                잔디 수가 아닌 코드 질, 설계 감각, 오류 패턴, 채용 시장 적합도를 함께
                묶어서 보여주는 것이 Dev-Radar의 핵심 가치입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-500">Current Focus</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{analysis.focusArea}</p>
              </div>
              <div className="rounded-[24px] border border-[#d9d4ff] bg-[#f4efff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7d6fff]">Last Updated</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">{analysis.collectedAt}</p>
              </div>
              <p className="rounded-[24px] border border-[#eadfdb] bg-white/85 p-4 leading-6 text-slate-600">
                {submittedId
                  ? `@${submittedId} 프로필을 기준으로 최신 대시보드를 생성했습니다.`
                  : '데모 계정을 기준으로 초기 대시보드를 미리 로드해두었습니다.'}
              </p>
            </CardContent>
          </Card>
        </section>

        {isLoading || isPending ? (
          <DashboardSkeleton />
        ) : (
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
                        Live Hexagon Metric
                      </p>
                      <CardTitle className="mt-2 text-2xl text-slate-800">
                        6각형 역량 지표가 실시간으로 갱신됩니다
                      </CardTitle>
                    </div>
                    <span className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7d6fff]">
                      animated update
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <RadarMetricChart metrics={analysis.metrics} />
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <Card className="border-white/70 bg-white/80 shadow-[0_24px_56px_rgba(235,193,166,0.16)]">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c66ab4]">
                      <Bot className="h-4 w-4" />
                      AI Peer Review
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      커밋 전에 받은 실무 관점 개선 제안
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
                      Live Activity Feed
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      IDE와 GitHub에서 들어오는 학습 이벤트 로그
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
                    Market-Fit Index
                  </div>
                  <CardTitle className="text-2xl text-slate-800">
                    채용 공고와 현재 기술 스택의 유사도 비교
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    JD 임베딩과 프로젝트 스택 비교를 기반으로 적합도를 계산하고, 아직 부족한
                    기술 요소를 함께 제시합니다.
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
                            부족 기술: {job.missingTech.join(', ')}
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
                      ConceptGap Tracker
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      오류와 오답 패턴으로 추적한 개념 결손 타임라인
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
                            gap.severity === 'high' &&
                              'border-red-200 text-red-400',
                            gap.severity === 'medium' &&
                              'border-amber-200 text-amber-500',
                            gap.severity === 'low' &&
                              'border-emerald-200 text-emerald-500',
                          )}
                        >
                          {gap.severity}
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
                            추천 학습: {gap.recommendation}
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
                      MVP Roadmap
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      공모전 시연 이후 확장 계획
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3 text-sm leading-6 text-slate-600">
                      <li className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        1단계: VS Code 확장에서 Python/JS 대상 클린 코드 점수와 일일 코드량 시각화
                      </li>
                      <li className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        2단계: GitHub 전체 저장소 분석과 채용 공고 매칭 엔진 탑재
                      </li>
                      <li className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        3단계: ATS 연동 및 Dev-Radar 인증서 기반 공식 채용 지표 제안
                      </li>
                    </ol>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
