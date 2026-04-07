import type {
  ActivityEvent,
  ConceptGap,
  DashboardAnalysis,
  DevMetric,
  MarketFit,
  RepositorySummary,
  ReviewSuggestion,
} from '@/types/dev-radar'

function hashString(value: string) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createRepository(fullName: string): RepositorySummary {
  const [owner, name] = fullName.split('/')

  return {
    owner,
    name,
    fullName,
    url: `https://github.com/${fullName}`,
    description: 'Demo repository summary used before the live GitHub analysis is connected.',
    visibility: 'public',
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    mainLanguages: [
      { name: 'TypeScript', share: 62 },
      { name: 'CSS', share: 18 },
      { name: 'MDX', share: 12 },
    ],
    stars: 128,
    forks: 24,
    openIssues: 7,
    lastPushAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topics: ['dashboard', 'analytics', 'nextjs'],
  }
}

function createMetrics(seed: number): DevMetric {
  return {
    readability: clamp(72 + (seed % 17), 0, 100),
    efficiency: clamp(64 + (seed % 21), 0, 100),
    security: clamp(58 + (seed % 19), 0, 100),
    architecture: clamp(66 + (seed % 18), 0, 100),
    consistency: clamp(74 + (seed % 16), 0, 100),
    modernity: clamp(61 + (seed % 23), 0, 100),
  }
}

function createMarketFits(seed: number): MarketFit[] {
  return [
    {
      targetJob: 'Backend Engineer',
      similarityScore: clamp(70 + (seed % 19), 0, 100),
      missingTech: ['CI pipeline', 'Docker', 'observability'],
    },
    {
      targetJob: 'Fullstack Engineer',
      similarityScore: clamp(62 + (seed % 17), 0, 100),
      missingTech: ['design docs', 'E2E tests', 'accessibility'],
    },
    {
      targetJob: 'Platform Engineer',
      similarityScore: clamp(48 + (seed % 15), 0, 100),
      missingTech: ['CI/CD', 'Observability', 'Kubernetes'],
    },
  ]
}

function createReviewSuggestions(seed: number): ReviewSuggestion[] {
  return [
    {
      id: `review-${seed}-1`,
      title: 'Separate core logic from integration code',
      impact: 'Readability + architecture',
      description:
        'Keeping domain logic separate from network and file access makes testing easier and raises the architectural clarity score.',
    },
    {
      id: `review-${seed}-2`,
      title: 'Harden error handling paths',
      impact: 'Security + stability',
      description:
        'Async boundaries should surface a consistent failure mode so that API handlers and background jobs stay easier to reason about.',
    },
    {
      id: `review-${seed}-3`,
      title: 'Keep commit scope tighter',
      impact: 'Reviewability + consistency',
      description:
        'Smaller commits make intent easier to trace and improve review speed for collaborators joining the codebase later.',
    },
  ]
}

function createConceptGaps(seed: number): ConceptGap[] {
  return [
    {
      id: `gap-${seed}-1`,
      title: 'Async error propagation',
      category: 'build error',
      severity: 'high',
      timestamp: 'Apr 7, 11:14 AM',
      summary:
        'Mixed promise chains and async or await flows can hide failures and make production bugs harder to trace back to a specific boundary.',
      recommendation: 'Review promise handling strategy and standardize error wrapping around async boundaries.',
    },
    {
      id: `gap-${seed}-2`,
      title: 'Data structure selection',
      category: 'algorithm pattern',
      severity: 'medium',
      timestamp: 'Apr 6, 06:20 PM',
      summary:
        'A solution may work correctly but still undersell engineering depth if the tradeoffs behind array, map, and set choices are not visible.',
      recommendation: 'Practice comparing time complexity and collection semantics before locking in an implementation.',
    },
    {
      id: `gap-${seed}-3`,
      title: 'Test double strategy',
      category: 'review feedback',
      severity: 'low',
      timestamp: 'Apr 3, 09:05 AM',
      summary:
        'Tests pass, but the line between mocks, stubs, and spies is still thin enough that future contributors could struggle to extend the suite cleanly.',
      recommendation: 'Document when to use mocks, stubs, and spies so future tests stay predictable.',
    },
  ]
}

function createActivity(seed: number, githubId: string): ActivityEvent[] {
  return [
    {
      id: `event-${seed}-1`,
      time: '09:42',
      label: 'Demo scan completed',
      detail: `A seeded demo profile for ${githubId} was generated with static repository and commit signals.`,
    },
    {
      id: `event-${seed}-2`,
      time: '12:08',
      label: 'Commit hygiene snapshot',
      detail:
        'Recent commit messages were seeded to look reasonably descriptive so the demo can showcase review and collaboration signals.',
    },
    {
      id: `event-${seed}-3`,
      time: '14:31',
      label: 'Market-fit profile refreshed',
      detail:
        'Role-fit cards were recalculated so the dashboard can show how the same repository reads across different hiring tracks.',
    },
  ]
}

export function createDashboardAnalysis(githubId: string): DashboardAnalysis {
  const seed = hashString(githubId)
  const metrics = createMetrics(seed)
  const normalizedRepository = githubId.includes('/') ? githubId : `demo/${githubId}`

  return {
    githubId: normalizedRepository,
    repository: createRepository(normalizedRepository),
    collectedAt: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date()),
    dailyLines: 420 + (seed % 260),
    cleanCodeScore: Math.round(
      (metrics.readability +
        metrics.architecture +
        metrics.consistency +
        metrics.modernity +
        metrics.security +
        metrics.efficiency) /
        6,
    ),
    focusArea:
      metrics.security < 70
        ? 'Harden security review and failure handling'
        : 'Raise the architecture and automation signal',
    metrics,
    marketFits: createMarketFits(seed),
    conceptGaps: createConceptGaps(seed),
    reviewSuggestions: createReviewSuggestions(seed),
    activity: createActivity(seed, normalizedRepository),
  }
}
