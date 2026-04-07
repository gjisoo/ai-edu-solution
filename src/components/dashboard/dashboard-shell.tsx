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

type SummaryKey = 'cleanCodeScore' | 'dailyLines' | 'marketFitAverage' | 'conceptGapCount'

const summaryConfig: Array<{
  key: SummaryKey
  label: string
  unit: string
  icon: typeof Sparkles
}> = [
  {
    key: 'cleanCodeScore',
    label: 'Clean Code Score',
    unit: 'pts',
    icon: Sparkles,
  },
  {
    key: 'dailyLines',
    label: 'Est. Daily LoC',
    unit: 'LoC',
    icon: Activity,
  },
  {
    key: 'marketFitAverage',
    label: 'Market Fit Avg',
    unit: '%',
    icon: BriefcaseBusiness,
  },
  {
    key: 'conceptGapCount',
    label: 'Concept Gaps',
    unit: 'items',
    icon: ShieldAlert,
  },
] as const

export function DashboardShell() {
  const [repoInput, setRepoInput] = useState('https://github.com/vercel/next.js')
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
        throw new Error(payload.error ?? 'Repository analysis failed.')
      }

      if (!response.ok) {
        throw new Error('Repository analysis failed.')
      }

      setAnalysis(payload)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Repository analysis failed.')
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
                Live Repository Signal
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-slate-800 sm:text-4xl">
                Dev-Radar Dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Paste a GitHub repository URL and we will turn real repo metadata, root structure,
                language mix, and recent commit history into a live engineering signal board.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              GitHub Live Scan
            </span>
            <span className="rounded-full border border-[#d9d4ff] bg-[#f3f0ff] px-3 py-1 text-xs font-semibold text-[#7163ea]">
              Public Repo Ready
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
              Token Optional
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
                Analyze a real GitHub repository
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                Supported inputs: full GitHub URL, SSH URL, or <code>owner/repo</code>. Public
                repositories work immediately, and <code>GITHUB_TOKEN</code> unlocks better rate
                limits plus private repo access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={handleAnalyze} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={repoInput}
                  onChange={(event) => setRepoInput(event.target.value)}
                  placeholder="https://github.com/vercel/next.js"
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
                      Scanning...
                    </span>
                  ) : (
                    'Analyze Repo'
                  )}
                </Button>
              </form>

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
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Accepted Input</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">URL / owner/repo</p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Analysis Mode</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    GitHub API + heuristics
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Primary Output</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    Repo health + market fit
                  </p>
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
                Live scan status and current focus
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                This MVP is now grounded in live GitHub repository data. Narrative insights are
                still heuristic-based, which keeps the flow fast while we prepare the AI layer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-500">Current Focus</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.focusArea ?? 'Paste a repository to generate the first live signal.'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#d9d4ff] bg-[#f4efff] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7d6fff]">Last Updated</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.collectedAt ?? 'Waiting for first scan'}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#eadfdb] bg-white/85 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Latest Repository</p>
                <p className="mt-2 text-lg font-semibold text-slate-800">
                  {analysis?.repository.fullName ?? submittedRepo ?? 'No repository analyzed yet'}
                </p>
                <p className="mt-2 leading-6 text-slate-600">
                  {analysis?.repository.description ??
                    'The next scan will pull repository metadata, language stats, and recent commit activity from GitHub.'}
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
                        Live Hexagon Metric
                      </p>
                      <CardTitle className="mt-2 text-2xl text-slate-800">
                        Repository quality signal by category
                      </CardTitle>
                    </div>
                    <span className="rounded-full border border-[#d9d4ff] bg-[#f4efff] px-3 py-1 text-xs font-semibold text-[#7d6fff]">
                      live update
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
                      Review Suggestions
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      Highest-leverage improvements for this repo
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
                      What we actually detected from GitHub
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
                    Which engineering tracks this repo supports best
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    These scores are inferred from repo structure, stack signals, workflow files,
                    and recent activity rather than AI-generated career advice.
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
                            Missing signal: {job.missingTech.join(', ')}
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
                      Gap Tracker
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      Concrete gaps surfaced by the live scan
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
                            Recommendation: {gap.recommendation}
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
                      Repository Snapshot
                    </div>
                    <CardTitle className="text-2xl text-slate-800">
                      Real repository metadata at a glance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-slate-600">
                    <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Repository</p>
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
                          Open on GitHub
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="mt-3 leading-6 text-slate-600">
                        {analysis.repository.description ?? 'No repository description was provided on GitHub.'}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Branch</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {analysis.repository.defaultBranch}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Visibility</p>
                        <p className="mt-2 font-semibold capitalize text-slate-800">
                          {analysis.repository.visibility}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Primary Language</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {analysis.repository.primaryLanguage ?? 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Stars</p>
                        <p className="mt-2 flex items-center gap-2 font-semibold text-slate-800">
                          <Star className="h-4 w-4 text-amber-400" />
                          {formatNumber(analysis.repository.stars)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Forks</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {formatNumber(analysis.repository.forks)}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Open Issues</p>
                        <p className="mt-2 font-semibold text-slate-800">
                          {formatNumber(analysis.repository.openIssues)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#eadfdb] bg-[#fffdfb] p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Top Languages</p>
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
                  First Live Scan
                </p>
                <h2 className="font-display text-3xl text-slate-800">
                  The dashboard is ready for a real repository
                </h2>
                <p className="text-sm leading-7 text-slate-600 sm:text-base">
                  Start with a public repo such as <code>vercel/next.js</code> or your own
                  repository URL. The current pipeline analyzes live GitHub metadata, root files,
                  language share, and recent commits. AI-generated narrative explanations can be
                  layered in next.
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
  return new Intl.NumberFormat('en-US', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function isApiError(value: DashboardAnalysis | { error?: string }): value is { error?: string } {
  return 'error' in value
}
