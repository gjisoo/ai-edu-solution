import 'server-only'

import OpenAI from 'openai'

import type {
  ActivityEvent,
  AIInsight,
  ConceptGap,
  DevMetric,
  MarketFit,
  RepositorySummary,
  ReviewSuggestion,
} from '@/types/dev-radar'

type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export interface RepositoryAIEnhancement {
  model: string
  focusArea: string
  aiInsight: AIInsight
  reviewSuggestions: Array<Pick<ReviewSuggestion, 'title' | 'impact' | 'description'>>
  conceptGaps: Array<Pick<ConceptGap, 'title' | 'category' | 'severity' | 'summary' | 'recommendation'>>
}

type RepositoryAIInput = {
  repository: RepositorySummary
  metrics: DevMetric
  marketFits: MarketFit[]
  reviewSuggestions: ReviewSuggestion[]
  conceptGaps: ConceptGap[]
  activity: ActivityEvent[]
  repositorySignals: {
    frameworks: string[]
    daysSinceLastPush: number
    hasReadme: boolean
    hasDocsDir: boolean
    hasTests: boolean
    hasCi: boolean
    hasDocker: boolean
    hasTypedLanguage: boolean
    hasSecurityFile: boolean
    meaningfulCommitRatio: number
    uniqueAuthors: number
  }
  recentCommits: Array<{
    sha: string
    message: string
    author: string | null
    date: string | null
  }>
}

const OPENAI_DEFAULT_MODEL = 'gpt-5.4-mini'
const OPENAI_DEFAULT_REASONING: ReasoningEffort = 'low'
const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['focusArea', 'aiInsight', 'reviewSuggestions', 'conceptGaps'],
  properties: {
    focusArea: {
      type: 'string',
      minLength: 12,
      maxLength: 140,
    },
    aiInsight: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'summary', 'strengths', 'nextStep'],
      properties: {
        headline: {
          type: 'string',
          minLength: 8,
          maxLength: 90,
        },
        summary: {
          type: 'string',
          minLength: 40,
          maxLength: 320,
        },
        strengths: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'string',
            minLength: 8,
            maxLength: 80,
          },
        },
        nextStep: {
          type: 'string',
          minLength: 18,
          maxLength: 160,
        },
      },
    },
    reviewSuggestions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'impact', 'description'],
        properties: {
          title: {
            type: 'string',
            minLength: 8,
            maxLength: 80,
          },
          impact: {
            type: 'string',
            minLength: 8,
            maxLength: 50,
          },
          description: {
            type: 'string',
            minLength: 30,
            maxLength: 240,
          },
        },
      },
    },
    conceptGaps: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'severity', 'summary', 'recommendation'],
        properties: {
          title: {
            type: 'string',
            minLength: 8,
            maxLength: 80,
          },
          category: {
            type: 'string',
            minLength: 6,
            maxLength: 40,
          },
          severity: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          summary: {
            type: 'string',
            minLength: 30,
            maxLength: 220,
          },
          recommendation: {
            type: 'string',
            minLength: 18,
            maxLength: 180,
          },
        },
      },
    },
  },
} as const

export async function generateRepositoryAIEnhancement(
  input: RepositoryAIInput,
): Promise<RepositoryAIEnhancement | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  const model = process.env.OPENAI_MODEL?.trim() || OPENAI_DEFAULT_MODEL
  const reasoningEffort = parseReasoningEffort(process.env.OPENAI_REASONING_EFFORT)
  const client = new OpenAI({ apiKey })

  try {
    const response = await client.responses.create({
      model,
      reasoning: {
        effort: reasoningEffort,
      },
      instructions: [
        'You are Dev-Radar, an engineering portfolio analyst.',
        'Base every claim strictly on the repository evidence provided by the user input.',
        'Do not invent files, practices, tests, or deployment setup that are not supported by the evidence.',
        'Keep every field concise, concrete, and suitable for direct dashboard display.',
        'When evidence is limited, acknowledge that the signal is thin instead of overstating confidence.',
        'Write every output string in natural Korean.',
        'Return valid JSON matching the schema.',
      ].join(' '),
      input: JSON.stringify(buildPromptPayload(input), null, 2),
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'dev_radar_ai_enhancement',
          strict: true,
          schema: AI_SCHEMA,
        },
      },
    })

    if (!response.output_text) {
      return null
    }

    return parseAIEnhancement(response.output_text, model)
  } catch (error) {
    console.error('[dev-radar] OpenAI enhancement failed', error)
    return null
  }
}

function buildPromptPayload(input: RepositoryAIInput) {
  return {
    repository: {
      fullName: input.repository.fullName,
      description: input.repository.description,
      visibility: input.repository.visibility,
      defaultBranch: input.repository.defaultBranch,
      primaryLanguage: input.repository.primaryLanguage,
      mainLanguages: input.repository.mainLanguages,
      stars: input.repository.stars,
      forks: input.repository.forks,
      openIssues: input.repository.openIssues,
      topics: input.repository.topics,
      updatedAt: input.repository.updatedAt,
      lastPushAt: input.repository.lastPushAt,
    },
    metrics: input.metrics,
    marketFits: input.marketFits,
    repositorySignals: input.repositorySignals,
    recentCommits: input.recentCommits,
    heuristicDraft: {
      focusArea: deriveDraftFocusArea(input.metrics),
      reviewSuggestions: input.reviewSuggestions.map(({ title, impact, description }) => ({
        title,
        impact,
        description,
      })),
      conceptGaps: input.conceptGaps.map(({ title, category, severity, summary, recommendation }) => ({
        title,
        category,
        severity,
        summary,
        recommendation,
      })),
      activity: input.activity,
    },
  }
}

function deriveDraftFocusArea(metrics: DevMetric) {
  const entries = Object.entries(metrics) as Array<[keyof DevMetric, number]>
  const [weakestKey] = entries.reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest))

  const labels: Record<keyof DevMetric, string> = {
    readability: '가독성',
    efficiency: '효율성',
    security: '보안',
    architecture: '아키텍처',
    consistency: '일관성',
    modernity: '현대성',
  }

  return labels[weakestKey]
}

function parseAIEnhancement(rawText: string, model: string): RepositoryAIEnhancement | null {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawText)
  } catch {
    return null
  }

  if (!isAIEnhancementShape(parsed)) {
    return null
  }

  return {
    model,
    focusArea: parsed.focusArea.trim(),
    aiInsight: {
      headline: parsed.aiInsight.headline.trim(),
      summary: parsed.aiInsight.summary.trim(),
      strengths: parsed.aiInsight.strengths.map((item) => item.trim()),
      nextStep: parsed.aiInsight.nextStep.trim(),
    },
    reviewSuggestions: parsed.reviewSuggestions.map((item) => ({
      title: item.title.trim(),
      impact: item.impact.trim(),
      description: item.description.trim(),
    })),
    conceptGaps: parsed.conceptGaps.map((item) => ({
      title: item.title.trim(),
      category: item.category.trim(),
      severity: item.severity,
      summary: item.summary.trim(),
      recommendation: item.recommendation.trim(),
    })),
  }
}

function isAIEnhancementShape(value: unknown): value is {
  focusArea: string
  aiInsight: {
    headline: string
    summary: string
    strengths: string[]
    nextStep: string
  }
  reviewSuggestions: Array<{
    title: string
    impact: string
    description: string
  }>
  conceptGaps: Array<{
    title: string
    category: string
    severity: ConceptGap['severity']
    summary: string
    recommendation: string
  }>
} {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.focusArea !== 'string' ||
    !isRecord(value.aiInsight) ||
    typeof value.aiInsight.headline !== 'string' ||
    typeof value.aiInsight.summary !== 'string' ||
    !Array.isArray(value.aiInsight.strengths) ||
    value.aiInsight.strengths.some((item) => typeof item !== 'string') ||
    typeof value.aiInsight.nextStep !== 'string' ||
    !Array.isArray(value.reviewSuggestions) ||
    value.reviewSuggestions.length !== 3 ||
    !Array.isArray(value.conceptGaps) ||
    value.conceptGaps.length !== 3
  ) {
    return false
  }

  const suggestionsAreValid = value.reviewSuggestions.every(
    (item) =>
      isRecord(item) &&
      typeof item.title === 'string' &&
      typeof item.impact === 'string' &&
      typeof item.description === 'string',
  )
  const gapsAreValid = value.conceptGaps.every(
    (item) =>
      isRecord(item) &&
      typeof item.title === 'string' &&
      typeof item.category === 'string' &&
      isSeverity(item.severity) &&
      typeof item.summary === 'string' &&
      typeof item.recommendation === 'string',
  )

  return suggestionsAreValid && gapsAreValid
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSeverity(value: unknown): value is ConceptGap['severity'] {
  return value === 'high' || value === 'medium' || value === 'low'
}

function parseReasoningEffort(value: string | undefined): ReasoningEffort {
  if (
    value === 'none' ||
    value === 'minimal' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'xhigh'
  ) {
    return value
  }

  return OPENAI_DEFAULT_REASONING
}
