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

export interface StaticAnalysisRuleScore {
  key:
    | 'naming'
    | 'singleResponsibility'
    | 'complexity'
    | 'errorHandling'
    | 'validation'
    | 'modularity'
  label: string
  score: number
  weight: number
  evidence: string
}

export interface StaticAnalysisFinding {
  id: string
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
  path: string
}

export interface StaticCodeAnalysis {
  analyzer: string
  sampledFiles: number
  analyzableFiles: number
  averageScore: number
  coverageSummary: string
  rules: StaticAnalysisRuleScore[]
  findings: StaticAnalysisFinding[]
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
  staticAnalysis?: StaticCodeAnalysis | null
}
