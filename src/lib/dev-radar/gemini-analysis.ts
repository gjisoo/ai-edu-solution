import 'server-only'

import type {
  ActivityEvent,
  AIInsight,
  CleanCodeEvaluation,
  CleanCodeCriterionKey,
  CodebaseProfile,
  ConceptGap,
  DevMetric,
  MarketFit,
  RepositorySummary,
  ReviewSuggestion,
} from '@/types/dev-radar'

export interface RepositoryAIEnhancement {
  model: string
  focusArea: string
  metrics: DevMetric
  cleanCodeEvaluation: CleanCodeEvaluation
  aiInsight: AIInsight
  reviewSuggestions: Array<Pick<ReviewSuggestion, 'title' | 'impact' | 'description'>>
  conceptGaps: Array<Pick<ConceptGap, 'title' | 'category' | 'severity' | 'summary' | 'recommendation'>>
  recommendedCourses: Array<{
    title: string
    platform: string
    level: string
    reason: string
    matchSkill: string
  }>
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
  codeSamples: Array<{
    path: string
    language: string
    snippet: string
    truncated: boolean
  }>
  codebaseProfile: CodebaseProfile
  contributorInsights: Array<{
    name: string
    handle: string | null
    totalContributions: number | null
    recentCommitCount: number
    focusArea: string
    codeQualityScore: number
    codeQualitySummary: string
    risk: string
    recommendation: string
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
const PROMPT_CODE_SAMPLE_MAX_ITEMS = 24
const PROMPT_CODE_SAMPLE_CHAR_BUDGET = 90000
const CLEAN_CODE_CRITERIA: Array<{
  key: CleanCodeCriterionKey
  label: string
  weight: number
}> = [
  { key: 'naming', label: '네이밍', weight: 0.2 },
  { key: 'singleResponsibility', label: '단일 책임', weight: 0.2 },
  { key: 'complexity', label: '복잡도', weight: 0.16 },
  { key: 'errorHandling', label: '에러 처리', weight: 0.15 },
  { key: 'validation', label: '입력 검증', weight: 0.14 },
  { key: 'modularity', label: '모듈화', weight: 0.15 },
]
const AI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'focusArea',
    'metrics',
    'cleanCodeEvaluation',
    'aiInsight',
    'reviewSuggestions',
    'conceptGaps',
    'recommendedCourses',
  ],
  properties: {
    focusArea: {
      type: 'string',
      description: 'The main Korean focus area for this repository analysis.',
    },
    metrics: {
      type: 'object',
      additionalProperties: false,
      required: ['readability', 'efficiency', 'security', 'architecture', 'consistency', 'modernity'],
      properties: {
        readability: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored readability from 0 to 100.',
        },
        efficiency: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored efficiency from 0 to 100.',
        },
        security: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored security from 0 to 100.',
        },
        architecture: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored architecture from 0 to 100.',
        },
        consistency: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored consistency from 0 to 100.',
        },
        modernity: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'AI-scored modernity from 0 to 100.',
        },
      },
    },
    cleanCodeEvaluation: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'criteria'],
      properties: {
        summary: {
          type: 'string',
          description: 'A concise Korean summary of the repository clean-code quality.',
        },
        criteria: {
          type: 'array',
          minItems: 6,
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'score', 'rationale'],
            properties: {
              key: {
                type: 'string',
                enum: CLEAN_CODE_CRITERIA.map((item) => item.key),
              },
              score: {
                type: 'number',
                minimum: 0,
                maximum: 100,
              },
              rationale: {
                type: 'string',
                description: 'A short Korean rationale grounded in sampled code evidence.',
              },
            },
          },
        },
      },
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
    recommendedCourses: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'platform', 'level', 'reason', 'matchSkill'],
        properties: {
          title: { type: 'string', description: 'Real-world IT course title (e.g. from Inflearn, Udemy, etc)' },
          platform: { type: 'string', description: 'e.g., 인프런, 패스트캠퍼스, 유데미, 공식문서' },
          level: { type: 'string', description: 'e.g., 입문, 중급, 실전' },
          reason: { type: 'string', description: 'Specific reason for recommending this course based on their gaps' },
          matchSkill: { type: 'string', description: 'The weak metric or skill this course covers' },
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
    'You are a strict, pragmatic Tech Lead evaluating a codebase for actual production-readiness and commercial market viability.',
    'Your tone must be extremely dry, objective, and unconditionally professional. Do NOT use polite fillers, encouraging remarks, or sugar-coated praise.',
    'Base every claim strictly on the repository evidence provided in the JSON payload. You have access to a massive volume of the full codebase.',
    'The repository has been fully scanned. codebaseProfile covers all code files; codeSamples are representative excerpts for textual evidence.',
    'Evaluate strictly: Can this code be deployed to a real-world B2B/B2C service immediately? Does it have market competitiveness?',
    'If the codebase lacks enterprise-grade robustness (e.g., proper error handling, tests, security, caching, concurrency control) or looks like a mere toy project, explicitly point it out as a critical production blocker.',
    'Do not invent files, practices, tests, deployment setups, or team processes unsupported by evidence.',
    'Keep every field concise, brutally factual, and suitable for direct dashboard display.',
    'Score readability, efficiency, security, architecture, consistency, and modernity on a harsh 0-100 scale. Penalize heavily for missing production standards.',
    'For cleanCodeEvaluation, judge code quality based strictly on real-world maintainability and scalability, not just theoretical cleanliness.',
    'Use objective evidence: identifier clarity, function boundaries, branching complexity, explicit error handling, validation, and robust module separation.',
    'You must return cleanCodeEvaluation.criteria for exactly these six keys: naming, singleResponsibility, complexity, errorHandling, validation, modularity.',
    'Use this rubric: naming evaluates semantic identifiers; singleResponsibility evaluates job boundaries; complexity evaluates control-flow burden; errorHandling evaluates explicit/safe failure handling; validation evaluates guard clauses; modularity evaluates separation of concerns.',
    'Analyze the gaps and weak areas of the codebase.',
    'Recommend exactly 3 real-world IT online courses (e.g., from 인프런, 패스트캠퍼스, 유데미, 프로그래머스) or official frameworks docs that can directly help the developer close their concept gaps or improve their weakest metric.',
    'Return this in recommendedCourses. Include the exact Korean title of the course, platform, level, reason for recommendation, and the specific matchSkill.',
    'Write every output string in natural, dry, professional Korean (건조한 사무적 어투).',
    'Return only valid JSON that matches the provided schema.',
    '',
    'Repository evidence JSON:',
    JSON.stringify(buildPromptPayload(input), null, 2),
  ].join('\\n')
}

function buildPromptPayload(input: RepositoryAIInput) {
  const promptCodeSamples = buildPromptCodeSamples(input.codeSamples)

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
    codebaseProfile: input.codebaseProfile,
    contributors: input.contributorInsights.map((item) => ({
      name: item.name,
      handle: item.handle,
      totalContributions: item.totalContributions,
      recentCommitCount: item.recentCommitCount,
      focusArea: item.focusArea,
      codeQualityScore: item.codeQualityScore,
      codeQualitySummary: item.codeQualitySummary,
      risk: item.risk,
      recommendation: item.recommendation,
    })),
    recentCommits: input.recentCommits,
    codeSamples: promptCodeSamples,
    cleanCodeRubric: CLEAN_CODE_CRITERIA,
    heuristicDraft: {
      metrics: input.metrics,
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

function buildPromptCodeSamples(codeSamples: RepositoryAIInput['codeSamples']) {
  const selected: RepositoryAIInput['codeSamples'] = []
  let usedChars = 0

  for (const sample of codeSamples) {
    if (selected.length >= PROMPT_CODE_SAMPLE_MAX_ITEMS) {
      break
    }

    const remaining = PROMPT_CODE_SAMPLE_CHAR_BUDGET - usedChars

    if (remaining <= 240) {
      break
    }

    const needsTrim = sample.snippet.length > remaining
    const snippet = needsTrim ? sample.snippet.slice(0, remaining).trimEnd() : sample.snippet

    selected.push({
      ...sample,
      snippet,
      truncated: sample.truncated || needsTrim,
    })
    usedChars += snippet.length
  }

  return selected
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
  const parsed = tryParseAIEnhancementJson(rawText)

  if (!parsed) {
    return null
  }

  if (!isAIEnhancementShape(parsed)) {
    return null
  }

  return {
    model,
    focusArea: parsed.focusArea.trim(),
    metrics: normalizeMetrics(parsed.metrics),
    cleanCodeEvaluation: normalizeCleanCodeEvaluation(parsed.cleanCodeEvaluation),
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
    recommendedCourses: parsed.recommendedCourses.map((item) => ({
      title: item.title.trim(),
      platform: item.platform.trim(),
      level: item.level.trim(),
      reason: item.reason.trim(),
      matchSkill: item.matchSkill.trim(),
    })),
  }
}

function tryParseAIEnhancementJson(rawText: string): unknown | null {
  const candidates: string[] = []
  const trimmed = rawText.trim()

  if (trimmed) {
    candidates.push(trimmed)
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim())
  }

  const startIndex = rawText.indexOf('{')
  const endIndex = rawText.lastIndexOf('}')
  if (startIndex >= 0 && endIndex > startIndex) {
    candidates.push(rawText.slice(startIndex, endIndex + 1).trim())
  }

  const uniqueCandidates = Array.from(new Set(candidates))

  for (const candidate of uniqueCandidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Continue to next candidate.
    }
  }

  return null
}

function isAIEnhancementShape(value: unknown): value is {
  focusArea: string
  metrics: DevMetric
  cleanCodeEvaluation: {
    summary: string
    criteria: Array<{
      key: CleanCodeCriterionKey
      score: number
      rationale: string
    }>
  }
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
  recommendedCourses: Array<{
    title: string
    platform: string
    level: string
    reason: string
    matchSkill: string
  }>
} {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.focusArea !== 'string' ||
    !isDevMetric(value.metrics) ||
    !isCleanCodeEvaluationShape(value.cleanCodeEvaluation) ||
    !isRecord(value.aiInsight) ||
    typeof value.aiInsight.headline !== 'string' ||
    typeof value.aiInsight.summary !== 'string' ||
    !Array.isArray(value.aiInsight.strengths) ||
    value.aiInsight.strengths.some((item) => typeof item !== 'string') ||
    typeof value.aiInsight.nextStep !== 'string' ||
    !Array.isArray(value.reviewSuggestions) ||
    value.reviewSuggestions.length < 1 ||
    !Array.isArray(value.conceptGaps) ||
    value.conceptGaps.length < 1 ||
    !Array.isArray(value.recommendedCourses) ||
    value.recommendedCourses.length < 1
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
  const coursesAreValid = value.recommendedCourses.every(
    (item) =>
      isRecord(item) &&
      typeof item.title === 'string' &&
      typeof item.platform === 'string' &&
      typeof item.level === 'string' &&
      typeof item.reason === 'string' &&
      typeof item.matchSkill === 'string',
  )

  return suggestionsAreValid && gapsAreValid && coursesAreValid
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDevMetric(value: unknown): value is DevMetric {
  if (!isRecord(value)) {
    return false
  }

  return (
    isMetricValue(value.readability) &&
    isMetricValue(value.efficiency) &&
    isMetricValue(value.security) &&
    isMetricValue(value.architecture) &&
    isMetricValue(value.consistency) &&
    isMetricValue(value.modernity)
  )
}

function isCleanCodeEvaluationShape(
  value: unknown,
): value is {
  summary: string
  criteria: Array<{
    key: CleanCodeCriterionKey
    score: number
    rationale: string
  }>
} {
  if (!isRecord(value) || typeof value.summary !== 'string' || !Array.isArray(value.criteria)) {
    return false
  }

  return value.criteria.every(
    (item) =>
      isRecord(item) &&
      isCleanCodeCriterionKey(item.key) &&
      isMetricValue(item.score) &&
      typeof item.rationale === 'string',
  )
}

function isMetricValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCleanCodeCriterionKey(
  value: unknown,
): value is CleanCodeCriterionKey {
  return CLEAN_CODE_CRITERIA.some((item) => item.key === value)
}

function isSeverity(value: unknown): value is ConceptGap['severity'] {
  return value === 'high' || value === 'medium' || value === 'low'
}

function normalizeMetrics(metrics: DevMetric): DevMetric {
  return {
    readability: clampMetric(metrics.readability),
    efficiency: clampMetric(metrics.efficiency),
    security: clampMetric(metrics.security),
    architecture: clampMetric(metrics.architecture),
    consistency: clampMetric(metrics.consistency),
    modernity: clampMetric(metrics.modernity),
  }
}

function normalizeCleanCodeEvaluation(input: {
  summary: string
  criteria: Array<{
    key: CleanCodeCriterionKey
    score: number
    rationale: string
  }>
}): CleanCodeEvaluation {
  const criteria = CLEAN_CODE_CRITERIA.map((criterion) => {
    const matched = input.criteria.find((item) => item.key === criterion.key)

    return {
      ...criterion,
      score: clampMetric(matched?.score ?? 0),
      rationale: matched?.rationale.trim() || '코드 샘플 근거가 부족합니다.',
    }
  })

  return {
    score: clampMetric(
      criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0),
    ),
    formula: 'Score_clean = Σ w_i × c_i',
    summary: input.summary.trim(),
    criteria,
  }
}

function clampMetric(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
