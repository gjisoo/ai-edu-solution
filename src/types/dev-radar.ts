export interface DevMetric {
  readability: number
  efficiency: number
  security: number
  architecture: number
  consistency: number
  modernity: number
}

export type MetricKey = keyof DevMetric

export interface MetricSignal {
  label: string
  detail: string
  status: 'positive' | 'warning' | 'neutral'
}

export interface MetricBreakdown {
  metric: MetricKey
  label: string
  score: number
  summary: string
  signals: MetricSignal[]
}

export type CleanCodeCriterionKey =
  | 'naming'
  | 'singleResponsibility'
  | 'complexity'
  | 'errorHandling'
  | 'validation'
  | 'modularity'

export interface CleanCodeCriterion {
  key: CleanCodeCriterionKey
  label: string
  weight: number
  score: number
  rationale: string
}

export interface CleanCodeEvaluation {
  score: number
  formula: string
  summary: string
  criteria: CleanCodeCriterion[]
}

export interface MarketFit {
  targetJob: string
  similarityScore: number
  missingTech: string[]
}

export interface ConceptGap {
  id: string
  title: string
  category: string
  severity: 'high' | 'medium' | 'low'
  timestamp: string
  summary: string
  recommendation: string
}

export interface ReviewSuggestion {
  id: string
  title: string
  impact: string
  description: string
}

export interface ActivityEvent {
  id: string
  time: string
  label: string
  detail: string
}

export interface RepositoryLanguage {
  name: string
  share: number
}

export interface RepositorySummary {
  owner: string
  name: string
  fullName: string
  url: string
  description: string | null
  visibility: string
  defaultBranch: string
  primaryLanguage: string | null
  mainLanguages: RepositoryLanguage[]
  stars: number
  forks: number
  openIssues: number
  lastPushAt: string
  updatedAt: string
  topics: string[]
}

export interface CodebaseLanguageProfile {
  language: string
  files: number
  lines: number
}

export interface CodebaseProfile {
  totalCodeFiles: number
  totalCodeLines: number
  sampledCodeFiles: number
  sampledCodeChars: number
  sampleCoveragePercent: number
  topDirectories: Array<{
    path: string
    files: number
  }>
  languages: CodebaseLanguageProfile[]
}

export interface ContributorInsight {
  id: string
  name: string
  handle: string | null
  totalContributions: number | null
  recentCommitCount: number
  recentCommitAt: string | null
  focusArea: string
  codeQualityScore: number
  codeQualitySummary: string
  codeQualityBreakdown: {
    changeScope: number
    testDiscipline: number
    riskControl: number
    consistency: number
  }
  evidence: string[]
  strengths: string[]
  risk: string
  recommendation: string
}

export interface AnalysisEngine {
  mode: 'heuristic' | 'hybrid-ai'
  label: string
  model: string | null
}

export interface AIInsight {
  headline: string
  summary: string
  strengths: string[]
  nextStep: string
}

export interface DashboardAnalysis {
  githubId: string
  repository: RepositorySummary
  codebaseProfile: CodebaseProfile
  contributorInsights: ContributorInsight[]
  engine: AnalysisEngine
  aiInsight: AIInsight | null
  collectedAt: string
  dailyLines: number
  cleanCodeScore: number
  focusArea: string
  metrics: DevMetric
  marketFits: MarketFit[]
  conceptGaps: ConceptGap[]
  reviewSuggestions: ReviewSuggestion[]
  activity: ActivityEvent[]
  metricBreakdown?: MetricBreakdown[]
  cleanCodeEvaluation?: CleanCodeEvaluation | null
}
