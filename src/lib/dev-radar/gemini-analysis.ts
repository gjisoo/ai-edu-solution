import 'server-only'

import type {
  ActivityEvent,
  AIInsight,
  ConceptGap,
  DevMetric,
  MarketFit,
  RepositorySummary,
  ReviewSuggestion,
} from '@/types/dev-radar'

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

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    finishReason?: string
  }>
  promptFeedback?: {
    blockReason?: string
  }
}

type GeminiErrorResponse = {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'
const GEMINI_RETRYABLE_STATUS_CODES = new Set([429, 500, 503])
const GEMINI_MAX_ATTEMPTS = 3
const GEMINI_MAX_GENERATION_ATTEMPTS = 2
const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['focusArea', 'aiInsight', 'reviewSuggestions', 'conceptGaps'],
  properties: {
    focusArea: {
      type: 'string',
      description: 'The main Korean focus area for this repository analysis.',
    },
    aiInsight: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'summary', 'strengths', 'nextStep'],
      properties: {
        headline: {
          type: 'string',
          description: 'A concise Korean headline.',
        },
        summary: {
          type: 'string',
          description: 'A short Korean summary grounded only in evidence.',
        },
        strengths: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'string',
            description: 'A short Korean strength statement.',
          },
        },
        nextStep: {
          type: 'string',
          description: 'A concrete Korean next step.',
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
            description: 'A Korean title for the review suggestion.',
          },
          impact: {
            type: 'string',
            description: 'A short Korean impact label.',
          },
          description: {
            type: 'string',
            description: 'A concise Korean explanation.',
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
            description: 'A Korean title for the detected concept gap.',
          },
          category: {
            type: 'string',
            description: 'A Korean category label.',
          },
          severity: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          summary: {
            type: 'string',
            description: 'A concise Korean evidence-backed summary.',
          },
          recommendation: {
            type: 'string',
            description: 'A Korean recommendation for closing the gap.',
          },
        },
      },
    },
  },
} as const

export async function generateRepositoryAIEnhancement(
  input: RepositoryAIInput,
): Promise<RepositoryAIEnhancement | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()

  if (!apiKey) {
    return null
  }

  const model = process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL

  try {
    const prompt = buildGeminiPrompt(input)

    for (let attempt = 1; attempt <= GEMINI_MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const response = await requestGeminiWithRetry({
        apiKey,
        model,
        prompt,
      })

      if (!response.ok) {
        throw new Error(await readGeminiError(response))
      }

      const payload = (await response.json()) as GeminiGenerateContentResponse
      const outputText = extractGeminiText(payload)

      if (!outputText) {
        if (attempt < GEMINI_MAX_GENERATION_ATTEMPTS) {
          await sleep(attempt * 1000)
          continue
        }

        return null
      }

      const parsed = parseAIEnhancement(outputText, model)

      if (parsed) {
        return parsed
      }

      if (attempt < GEMINI_MAX_GENERATION_ATTEMPTS) {
        await sleep(attempt * 1000)
      }
    }

    return null
  } catch (error) {
    console.error('[dev-radar] Gemini enhancement failed', error)
    return null
  }
}

async function requestGeminiWithRetry(input: {
  apiKey: string
  model: string
  prompt: string
}) {
  let lastResponse: Response | null = null

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(input.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: input.prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: AI_SCHEMA,
          temperature: 0.2,
        },
      }),
    })

    if (response.ok || !GEMINI_RETRYABLE_STATUS_CODES.has(response.status) || attempt === GEMINI_MAX_ATTEMPTS) {
      return response
    }

    lastResponse = response
    await sleep(attempt * 1200)
  }

  return lastResponse ?? new Response(null, { status: 503, statusText: 'Gemini retry exhausted' })
}

async function readGeminiError(response: Response) {
  try {
    const body = (await response.json()) as GeminiErrorResponse

    if (body.error?.message) {
      return body.error.message
    }
  } catch {
    // Ignore JSON parse failures and fall back to the HTTP status text.
  }

  return `Gemini request failed with ${response.status} ${response.statusText}`
}

function extractGeminiText(payload: GeminiGenerateContentResponse) {
  const parts = payload.candidates?.[0]?.content?.parts

  if (!parts?.length) {
    if (payload.promptFeedback?.blockReason) {
      console.warn('[dev-radar] Gemini prompt blocked', payload.promptFeedback.blockReason)
    }

    return null
  }

  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}

function buildGeminiPrompt(input: RepositoryAIInput) {
  return [
    'You are Dev-Radar, an engineering portfolio analyst.',
    'Base every claim strictly on the repository evidence provided in the JSON payload.',
    'Do not invent files, practices, tests, deployment setup, or team process that are not supported by evidence.',
    'Keep every field concise, concrete, and suitable for direct dashboard display.',
    'When evidence is limited, acknowledge thin signal instead of overstating confidence.',
    'Write every output string in natural Korean.',
    'Return only valid JSON that matches the provided schema.',
    '',
    'Repository evidence JSON:',
    JSON.stringify(buildPromptPayload(input), null, 2),
  ].join('\n')
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
