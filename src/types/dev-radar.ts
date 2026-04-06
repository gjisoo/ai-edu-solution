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

export interface DashboardAnalysis {
  githubId: string
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
