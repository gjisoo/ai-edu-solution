export interface DevMetric {
  readability: number
  efficiency: number
  security: number
  architecture: number
  consistency: number
  modernity: number
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

export interface DashboardAnalysis {
  githubId: string
  repository: RepositorySummary
  collectedAt: string
  dailyLines: number
  cleanCodeScore: number
  focusArea: string
  metrics: DevMetric
  marketFits: MarketFit[]
  conceptGaps: ConceptGap[]
  reviewSuggestions: ReviewSuggestion[]
  activity: ActivityEvent[]
}
