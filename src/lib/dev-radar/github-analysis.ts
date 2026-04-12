import 'server-only'

import zlib from 'zlib'
import tar from 'tar-stream'

import { generateRepositoryAIEnhancement } from '@/lib/dev-radar/gemini-analysis'
import { parseGitHubRepositoryInput } from '@/lib/github/parse-repo-input'
import type {
  ActivityEvent,
  AIInsight,
  CleanCodeCriterionKey,
  CleanCodeEvaluation,
  CodebaseProfile,
  ConceptGap,
  ContributorInsight,
  DashboardAnalysis,
  DevMetric,
  MarketFit,
  MetricBreakdown,
  RepositoryLanguage,
  ReviewSuggestion,
} from '@/types/dev-radar'

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const MAX_COMMITS = 20
const ROOT_FILES_TO_FETCH = new Set([
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
])
const GENERIC_COMMIT_MESSAGES = new Set([
  'fix',
  'update',
  'changes',
  'wip',
  'work in progress',
  'init',
  'initial commit',
  'temp',
  'tmp',
  'misc',
  'edit',
])
const SOURCE_DIRECTORY_PRIORITY = [
  'src',
  'app',
  'components',
  'lib',
  'pages',
  'packages',
  'server',
  'client',
  'backend',
  'frontend',
  'api',
  'services',
] as const
const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  '.github',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'build',
  'vendor',
  'node_modules',
  'public',
  'assets',
  'static',
  'storybook-static',
])
const CODE_FILE_LANGUAGES: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TSX',
  '.js': 'JavaScript',
  '.jsx': 'JSX',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
}
const MAX_CODE_SAMPLE_LINES = 180
const MAX_CODE_SAMPLE_CHARS = 4200
const MAX_CODE_SAMPLES = 48
const MAX_SAMPLES_PER_DIRECTORY = 6
const MAX_SAMPLES_PER_LANGUAGE = 10
const MAX_TOTAL_SAMPLE_CHARS = 150000
const MAX_WORKFLOW_FILES = 8
const WORKFLOW_FILE_PATTERN = /\.(ya?ml)$/i
const MAX_CONTRIBUTOR_COUNT = 8
const MAX_COMMIT_DETAIL_COMMITS = MAX_COMMITS
const MAX_COMMIT_FILES_FOR_QUALITY = 80
const HEURISTIC_CLEAN_CODE_CRITERIA: Array<{
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

type GitHubRepositoryResponse = {
  name: string
  full_name: string
  html_url: string
  description: string | null
  private: boolean
  visibility?: string
  default_branch: string
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
  updated_at: string
  created_at: string
  size: number
  topics?: string[]
}

type GitHubCommitResponse = {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    } | null
  }
  author: {
    login: string
  } | null
}

type GitHubContributorResponse = {
  login?: string
  contributions?: number
  type?: string
}

type GitHubCommitDetailResponse = {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    } | null
  }
  author: {
    login: string
  } | null
  files?: Array<{
    filename: string
    status?: string
    additions?: number
    deletions?: number
    changes?: number
    patch?: string
  }>
}

type RecentCommitDetail = {
  sha: string
  message: string
  authorName: string
  authorHandle: string | null
  date: string | null
  files: Array<{
    path: string
    additions: number
    deletions: number
    changes: number
    patch: string | null
  }>
}




type PackageManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  scripts?: Record<string, string>
}

type RepositoryCodeSample = {
  path: string
  language: string
  snippet: string
  truncated: boolean
}

type PackageScripts = {
  build: string | null
  test: string | null
  lint: string | null
  typecheck: string | null
}

type WorkflowSignal = {
  path: string
  name: string
  hasBuild: boolean
  hasTest: boolean
  hasLint: boolean
  hasTypecheck: boolean
  hasSecurity: boolean
  hasDeploy: boolean
}

class GitHubAnalysisError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'GitHubAnalysisError'
    this.status = status
  }
}

export async function analyzeGitHubRepository(input: string): Promise<DashboardAnalysis> {
  const parsed = parseGitHubRepositoryInput(input)
  const repositoryPath = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`
  const repository = await fetchGitHubJson<GitHubRepositoryResponse>(repositoryPath)

  const [languages, commits, contributors, { rootFileContents, workflowSignals, codeSamples, rootContents, codebaseProfile }] = await Promise.all([
    fetchGitHubJson<Record<string, number>>(`${repositoryPath}/languages`),
    fetchGitHubJson<GitHubCommitResponse[]>(
      `${repositoryPath}/commits?per_page=${MAX_COMMITS}&sha=${encodeURIComponent(repository.default_branch)}`,
      { fallbackValue: [] },
    ),
    fetchGitHubJson<GitHubContributorResponse[]>(
      `${repositoryPath}/contributors?per_page=${MAX_CONTRIBUTOR_COUNT}`,
      { fallbackValue: [] },
    ),
    downloadAndExtractTarball(repositoryPath, repository.default_branch),
  ])
  const recentCommitDetails = await fetchRecentCommitDetails(repositoryPath, commits)
  const packageManifest = parsePackageManifest(rootFileContents['package.json'] ?? null)
  const packageScripts = extractPackageScripts(packageManifest)
  const frameworks = detectFrameworks({
    languages,
    packageManifest,
    fileContents: rootFileContents,
  })
  const repositorySignals = buildRepositorySignals({
    repository,
    languages,
    commits,
    rootContents,
    frameworks,
    packageManifest,
    packageScripts,
    workflowSignals,
    codeSampleCount: codeSamples.length,
  })
  const metrics = buildMetrics(repositorySignals)
  const metricBreakdown = buildMetricBreakdown(metrics, repositorySignals)
  const marketFits = buildMarketFits(repositorySignals)
  const reviewSuggestions = buildReviewSuggestions(repositorySignals)
  const conceptGaps = buildConceptGaps(repositorySignals)
  const activity = buildActivity(repositorySignals)
  const collectedAtDate = new Date()
  const collectedAt = formatDateTime(collectedAtDate)
  const contributorInsights = buildContributorInsights({
    contributors,
    commits,
    recentCommitDetails,
    collectedAt: collectedAtDate.toISOString(),
  })
  const fallbackCleanCodeEvaluation = buildHeuristicCleanCodeEvaluation(metrics, repositorySignals)
  const fallbackAIInsight = buildHeuristicAIInsight({
    metrics,
    reviewSuggestions,
    conceptGaps,
  })
  const heuristicAnalysis: DashboardAnalysis = {
    githubId: parsed.normalizedFullName,
    repository: {
      owner: parsed.owner,
      name: repository.name,
      fullName: repository.full_name,
      url: repository.html_url,
      description: repository.description,
      visibility: repository.private ? 'private' : repository.visibility ?? 'public',
      defaultBranch: repository.default_branch,
      primaryLanguage: repositorySignals.mainLanguages[0]?.name ?? repository.language,
      mainLanguages: repositorySignals.mainLanguages,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openIssues: repository.open_issues_count,
      lastPushAt: repository.pushed_at,
      updatedAt: repository.updated_at,
      topics: repository.topics ?? [],
    },
    codebaseProfile,
    contributorInsights,
    engine: {
      mode: 'heuristic',
      label: 'GitHub API + 규칙 기반 분석',
      model: null,
    },
    aiInsight: fallbackAIInsight,
    collectedAt,
    dailyLines: estimateDailyLines(repository.size, commits.length, repositorySignals.daysSinceLastPush),
    cleanCodeScore: fallbackCleanCodeEvaluation.score,
    focusArea: describeWeakestMetric(metrics),
    metrics,
    metricBreakdown,
    cleanCodeEvaluation: fallbackCleanCodeEvaluation,
    marketFits,
    conceptGaps,
    reviewSuggestions,
    activity,
  }

  const aiEnhancement = await generateRepositoryAIEnhancement({
    repository: heuristicAnalysis.repository,
    metrics,
    marketFits,
    reviewSuggestions,
    conceptGaps,
    activity,
    repositorySignals: {
      frameworks: repositorySignals.frameworks,
      daysSinceLastPush: repositorySignals.daysSinceLastPush,
      hasReadme: repositorySignals.hasReadme,
      hasDocsDir: repositorySignals.hasDocsDir,
      hasTests: repositorySignals.hasTests,
      hasCi: repositorySignals.hasCi,
      hasDocker: repositorySignals.hasDocker,
      hasTypedLanguage: repositorySignals.hasTypedLanguage,
      hasSecurityFile: repositorySignals.hasSecurityFile,
      meaningfulCommitRatio: repositorySignals.meaningfulCommitRatio,
      uniqueAuthors: repositorySignals.uniqueAuthors,
    },
    recentCommits: commits.slice(0, 5).map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: firstLine(commit.commit.message),
      author: commit.author?.login ?? commit.commit.author?.name ?? null,
      date: commit.commit.author?.date ?? null,
    })),
    codeSamples,
    codebaseProfile,
    contributorInsights: contributorInsights.map((item) => ({
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
  })

  if (!aiEnhancement) {
    return heuristicAnalysis
  }

  return {
    ...heuristicAnalysis,
    engine: {
      mode: 'hybrid-ai',
      label: 'GitHub API + Gemini 코드 평가',
      model: aiEnhancement.model,
    },
    cleanCodeScore: aiEnhancement.cleanCodeEvaluation.score,
    aiInsight: aiEnhancement.aiInsight,
    focusArea: aiEnhancement.focusArea,
    metrics: aiEnhancement.metrics,
    metricBreakdown: buildMetricBreakdown(
      aiEnhancement.metrics,
      repositorySignals,
    ),
    cleanCodeEvaluation: aiEnhancement.cleanCodeEvaluation,
    reviewSuggestions: aiEnhancement.reviewSuggestions.map((item, index) => ({
      id: `ai-review-${index + 1}`,
      title: item.title,
      impact: item.impact,
      description: item.description,
    })),
    conceptGaps: aiEnhancement.conceptGaps.map((item, index) => ({
      id: `ai-gap-${index + 1}`,
      title: item.title,
      category: item.category,
      severity: item.severity,
      timestamp: heuristicAnalysis.collectedAt,
      summary: item.summary,
      recommendation: item.recommendation,
    })),
  }
}







function buildWorkflowSignal(path: string, text: string | null): WorkflowSignal | null {
  if (!text) {
    return null
  }

  const normalized = text.replace(/\r\n?/g, '\n')
  const lower = normalized.toLowerCase()

  return {
    path,
    name: extractWorkflowName(normalized) ?? path.split('/').pop() ?? path,
    hasBuild: /\b(build|compile|bundle|package)\b/.test(lower),
    hasTest: /\b(test|jest|vitest|pytest|playwright|cypress)\b/.test(lower),
    hasLint: /\b(lint|eslint|stylelint|biome|ruff)\b/.test(lower),
    hasTypecheck: /\b(typecheck|type-check|tsc\b|mypy\b|pyright\b)\b/.test(lower),
    hasSecurity: /\b(codeql|snyk|trivy|dependabot|audit|osv)\b/.test(lower),
    hasDeploy: /\b(deploy|release|publish|docker buildx|vercel|netlify)\b/.test(lower),
  }
}

function buildRepositoryCodeSample(path: string, text: string | null): RepositoryCodeSample | null {
  if (!text) {
    return null
  }

  const normalized = text.replace(/\r\n?/g, '\n').trim()

  if (!normalized) {
    return null
  }

  const lines = normalized.split('\n')
  const snippetLines: string[] = []
  let currentLength = 0
  let index = 0

  while (index < lines.length && snippetLines.length < MAX_CODE_SAMPLE_LINES) {
    const nextLine = lines[index]
    const nextLength = currentLength + nextLine.length + 1

    if (nextLength > MAX_CODE_SAMPLE_CHARS) {
      break
    }

    snippetLines.push(nextLine)
    currentLength = nextLength
    index += 1
  }

  const snippet = snippetLines.join('\n').trim()

  if (snippet.length < 80) {
    return null
  }

  return {
    path,
    language: detectCodeLanguage(path),
    snippet,
    truncated: index < lines.length,
  }
}

async function fetchGitHubJson<T>(
  path: string,
  options: {
    fallbackValue?: T
  } = {},
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: buildGitHubHeaders(),
    cache: 'no-store',
  })

  if (!response.ok) {
    if (options.fallbackValue !== undefined && (response.status === 404 || response.status === 409)) {
      return options.fallbackValue
    }

    throw await createGitHubError(response)
  }

  return response.json() as Promise<T>
}

async function fetchRecentCommitDetails(repositoryPath: string, commits: GitHubCommitResponse[]) {
  const targets = commits.slice(0, MAX_COMMIT_DETAIL_COMMITS)

  if (targets.length === 0) {
    return []
  }

  const settled = await Promise.allSettled(
    targets.map(async (commit): Promise<RecentCommitDetail> => {
      const payload = await fetchGitHubJson<GitHubCommitDetailResponse>(
        `${repositoryPath}/commits/${encodeURIComponent(commit.sha)}`,
      )

      const files = (payload.files ?? [])
        .slice(0, MAX_COMMIT_FILES_FOR_QUALITY)
        .map((file) => ({
          path: file.filename,
          additions: file.additions ?? 0,
          deletions: file.deletions ?? 0,
          changes: file.changes ?? (file.additions ?? 0) + (file.deletions ?? 0),
          patch: typeof file.patch === 'string' ? file.patch : null,
        }))
        .filter((file) => file.path.trim().length > 0)

      return {
        sha: payload.sha,
        message: firstLine(payload.commit.message),
        authorName: payload.commit.author?.name?.trim() || payload.author?.login || '알 수 없는 기여자',
        authorHandle: payload.author?.login ?? null,
        date: payload.commit.author?.date ?? null,
        files,
      }
    }),
  )

  return settled
    .filter((result): result is PromiseFulfilledResult<RecentCommitDetail> => result.status === 'fulfilled')
    .map((result) => result.value)
}

function buildGitHubHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dev-radar-mvp',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  return headers
}

function encodeGitHubPath(filePath: string) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

async function createGitHubError(response: Response) {
  const body = await readErrorBody(response)
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining')

  if (response.status === 404) {
    return new GitHubAnalysisError(
      '저장소를 찾을 수 없습니다. 공개 저장소인지 확인하거나 비공개 저장소라면 GITHUB_TOKEN을 설정해주세요.',
      404,
    )
  }

  if (response.status === 403 && rateLimitRemaining === '0') {
    return new GitHubAnalysisError(
      'GitHub API 호출 한도에 도달했습니다. 잠시 후 다시 시도하거나 GITHUB_TOKEN을 설정해주세요.',
      429,
    )
  }

  if (response.status === 403) {
    return new GitHubAnalysisError(
      'GitHub API 접근이 거부되었습니다. 토큰 권한과 저장소 공개 범위를 확인해주세요.',
      403,
    )
  }

  return new GitHubAnalysisError(body ? `GitHub API 오류: ${body}` : 'GitHub API에서 데이터를 불러오지 못했습니다.', response.status)
}

async function readErrorBody(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string }
    return payload.message ?? null
  } catch {
    return null
  }
}

function parsePackageManifest(text: string | null): PackageManifest | null {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as PackageManifest
  } catch {
    return null
  }
}

function extractPackageScripts(packageManifest: PackageManifest | null): PackageScripts {
  const scripts = packageManifest?.scripts ?? {}

  return {
    build: pickPackageScript(scripts, ['build']),
    test: pickPackageScript(scripts, ['test', 'test:ci']),
    lint: pickPackageScript(scripts, ['lint', 'check:lint']),
    typecheck: pickPackageScript(scripts, ['typecheck', 'type-check', 'check-types', 'check:type']),
  }
}

function pickPackageScript(
  scripts: Record<string, string>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    if (typeof scripts[candidate] === 'string' && scripts[candidate].trim()) {
      return scripts[candidate]
    }
  }

  return null
}

function extractWorkflowName(text: string) {
  const match = text.match(/^\s*name\s*:\s*(.+)$/m)

  if (!match?.[1]) {
    return null
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

function shouldTraverseDirectory(name: string) {
  return !EXCLUDED_DIRECTORY_NAMES.has(name.toLowerCase())
}



function isCodeSampleCandidate(path: string) {
  const normalizedPath = path.toLowerCase()
  const extension = getPathExtension(normalizedPath)

  if (!extension || !(extension in CODE_FILE_LANGUAGES)) {
    return false
  }

  if (
    normalizedPath.includes('/node_modules/') ||
    normalizedPath.includes('/dist/') ||
    normalizedPath.includes('/build/') ||
    normalizedPath.includes('/coverage/')
  ) {
    return false
  }

  return true
}

function detectCodeLanguage(path: string) {
  return CODE_FILE_LANGUAGES[getPathExtension(path.toLowerCase())] ?? 'Code'
}

function countCodeLines(text: string) {
  if (!text.trim()) {
    return 0
  }

  return text.replace(/\r\n?/g, '\n').split('\n').length
}

function getDirectoryBucket(path: string) {
  const segments = path.split('/').filter(Boolean)
  return segments.length <= 1 ? '(root)' : segments[0]
}

function incrementNumberMap(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function incrementLanguageHistogram(
  map: Map<string, { files: number; lines: number }>,
  language: string,
  lineCount: number,
) {
  const current = map.get(language)

  if (!current) {
    map.set(language, { files: 1, lines: lineCount })
    return
  }

  map.set(language, {
    files: current.files + 1,
    lines: current.lines + lineCount,
  })
}

function getPathExtension(path: string) {
  const fileName = path.split('/').pop() ?? path
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex === -1) {
    return ''
  }

  return fileName.slice(dotIndex)
}

function detectFrameworks({
  languages,
  packageManifest,
  fileContents,
}: {
  languages: Record<string, number>
  packageManifest: PackageManifest | null
  fileContents: Record<string, string>
}) {
  const detected = new Set<string>()
  const dependencies = {
    ...packageManifest?.dependencies,
    ...packageManifest?.devDependencies,
  }
  const dependencyNames = new Set(Object.keys(dependencies))
  const pyproject = fileContents['pyproject.toml']?.toLowerCase() ?? ''
  const requirements = fileContents['requirements.txt']?.toLowerCase() ?? ''
  const goMod = fileContents['go.mod']?.toLowerCase() ?? ''
  const cargoToml = fileContents['cargo.toml']?.toLowerCase() ?? ''

  if (dependencyNames.has('next')) {
    detected.add('Next.js')
  }
  if (dependencyNames.has('react')) {
    detected.add('React')
  }
  if (dependencyNames.has('vite')) {
    detected.add('Vite')
  }
  if (dependencyNames.has('express')) {
    detected.add('Express')
  }
  if (dependencyNames.has('@nestjs/core')) {
    detected.add('NestJS')
  }
  if (dependencyNames.has('fastify')) {
    detected.add('Fastify')
  }
  if (dependencyNames.has('jest')) {
    detected.add('Jest')
  }
  if (dependencyNames.has('vitest')) {
    detected.add('Vitest')
  }
  if (dependencyNames.has('@playwright/test')) {
    detected.add('Playwright')
  }
  if (dependencyNames.has('cypress')) {
    detected.add('Cypress')
  }
  if (dependencyNames.has('eslint') || dependencyNames.has('@biomejs/biome')) {
    detected.add('Linting')
  }

  if (pyproject.includes('fastapi') || requirements.includes('fastapi')) {
    detected.add('FastAPI')
  }
  if (pyproject.includes('django') || requirements.includes('django')) {
    detected.add('Django')
  }
  if (pyproject.includes('flask') || requirements.includes('flask')) {
    detected.add('Flask')
  }
  if (pyproject.includes('pytest') || requirements.includes('pytest')) {
    detected.add('Pytest')
  }

  if (goMod.includes('gin-gonic/gin')) {
    detected.add('Gin')
  }
  if (goMod.includes('gofiber/fiber')) {
    detected.add('Fiber')
  }
  if (cargoToml.includes('axum')) {
    detected.add('Axum')
  }
  if (cargoToml.includes('tokio')) {
    detected.add('Tokio')
  }

  if (Object.keys(languages).includes('TypeScript')) {
    detected.add('TypeScript')
  }
  if (Object.keys(languages).includes('Python')) {
    detected.add('Python')
  }
  if (Object.keys(languages).includes('Go')) {
    detected.add('Go')
  }
  if (Object.keys(languages).includes('Rust')) {
    detected.add('Rust')
  }

  return Array.from(detected)
}

function buildRepositorySignals({
  repository,
  languages,
  commits,
  rootContents,
  frameworks,
  packageManifest,
  packageScripts,
  workflowSignals,
  codeSampleCount,
}: {
  repository: GitHubRepositoryResponse
  languages: Record<string, number>
  commits: GitHubCommitResponse[]
  rootContents: { name: string; type: 'dir' | 'file' }[]
  frameworks: string[]
  packageManifest: PackageManifest | null
  packageScripts: PackageScripts
  workflowSignals: WorkflowSignal[]
  codeSampleCount: number
}) {
  const now = Date.now()
  const rootNames = new Set(rootContents.map((item) => item.name.toLowerCase()))
  const languageEntries = Object.entries(languages).sort((left, right) => right[1] - left[1])
  const totalLanguageBytes = languageEntries.reduce((sum, [, value]) => sum + value, 0)
  const mainLanguages: RepositoryLanguage[] = languageEntries.slice(0, 4).map(([name, bytes]) => ({
    name,
    share: totalLanguageBytes > 0 ? Math.max(1, Math.round((bytes / totalLanguageBytes) * 100)) : 0,
  }))
  const dependencies = {
    ...packageManifest?.dependencies,
    ...packageManifest?.devDependencies,
  }
  const dependencyNames = new Set(Object.keys(dependencies))
  const latestCommit = commits[0] ?? null
  const daysSinceLastPush = Math.max(
    0,
    Math.floor((now - new Date(repository.pushed_at).getTime()) / (1000 * 60 * 60 * 24)),
  )
  const genericCommitCount = commits.filter((commit) => {
    const firstLine = commit.commit.message.split('\n')[0]?.trim().toLowerCase() ?? ''
    return firstLine.length < 12 || GENERIC_COMMIT_MESSAGES.has(firstLine)
  }).length
  const meaningfulCommitRatio =
    commits.length === 0 ? 0 : (commits.length - genericCommitCount) / commits.length
  const uniqueAuthors = new Set(
    commits
      .map((commit) => commit.author?.login ?? commit.commit.author?.email ?? commit.commit.author?.name)
      .filter(Boolean),
  ).size
  const workflowNames = workflowSignals.map((workflow) => workflow.name)
  const readmePath =
    rootContents.find((item) => item.type === 'file' && item.name.toLowerCase().startsWith('readme'))?.name ?? null
  const hasReadme = Array.from(rootNames).some((name) => name.startsWith('readme'))
  const hasDocsDir = rootNames.has('docs')
  const hasContributing = rootNames.has('contributing.md') || rootNames.has('contributing')
  const hasSourceDir = rootNames.has('src') || rootNames.has('app') || rootNames.has('packages')
  const hasBuildScript = Boolean(packageScripts.build)
  const hasTestScript = Boolean(packageScripts.test)
  const hasLintScript = Boolean(packageScripts.lint)
  const hasTypecheckScript = Boolean(packageScripts.typecheck)
  const hasWorkflowBuild = workflowSignals.some((workflow) => workflow.hasBuild)
  const hasWorkflowTest = workflowSignals.some((workflow) => workflow.hasTest)
  const hasWorkflowLint = workflowSignals.some((workflow) => workflow.hasLint)
  const hasWorkflowTypecheck = workflowSignals.some((workflow) => workflow.hasTypecheck)
  const hasWorkflowSecurity = workflowSignals.some((workflow) => workflow.hasSecurity)
  const hasWorkflowDeploy = workflowSignals.some((workflow) => workflow.hasDeploy)
  const hasTests =
    rootNames.has('test') ||
    rootNames.has('tests') ||
    rootNames.has('__tests__') ||
    rootNames.has('cypress') ||
    rootNames.has('e2e') ||
    hasTestScript ||
    hasWorkflowTest ||
    frameworks.some((framework) =>
      ['Jest', 'Vitest', 'Pytest', 'Playwright', 'Cypress'].includes(framework),
    )
  const hasCi =
    workflowSignals.length > 0 ||
    rootNames.has('.github') ||
    rootNames.has('.circleci') ||
    rootNames.has('.gitlab-ci.yml') ||
    rootNames.has('azure-pipelines.yml')
  const hasDocker =
    rootNames.has('dockerfile') ||
    rootNames.has('docker-compose.yml') ||
    rootNames.has('docker-compose.yaml')
  const hasInfra =
    hasDocker ||
    rootNames.has('terraform') ||
    rootNames.has('helm') ||
    rootNames.has('pulumi') ||
    rootNames.has('k8s') ||
    rootNames.has('.github')
  const hasLint =
    rootNames.has('.eslintrc') ||
    rootNames.has('.eslintrc.js') ||
    rootNames.has('.eslintrc.cjs') ||
    rootNames.has('eslint.config.js') ||
    rootNames.has('eslint.config.mjs') ||
    hasLintScript ||
    hasWorkflowLint ||
    dependencyNames.has('eslint') ||
    dependencyNames.has('@biomejs/biome') ||
    dependencyNames.has('ruff')
  const hasLockfile =
    rootNames.has('package-lock.json') ||
    rootNames.has('pnpm-lock.yaml') ||
    rootNames.has('yarn.lock') ||
    rootNames.has('poetry.lock') ||
    rootNames.has('cargo.lock') ||
    rootNames.has('go.sum')
  const hasSecurityFile = rootNames.has('security.md') || rootNames.has('.snyk')
  const hasTypedLanguage =
    rootNames.has('tsconfig.json') ||
    mainLanguages.some((language) =>
      ['TypeScript', 'Rust', 'Go', 'Java', 'Kotlin', 'C#'].includes(language.name),
    )
  const hasFrontendStack =
    frameworks.some((framework) => ['Next.js', 'React', 'Vite'].includes(framework)) ||
    mainLanguages.some((language) => ['TypeScript', 'JavaScript'].includes(language.name))
  const hasBackendStack =
    frameworks.some((framework) =>
      ['Express', 'NestJS', 'Fastify', 'FastAPI', 'Django', 'Flask', 'Gin', 'Fiber', 'Axum'].includes(
        framework,
      ),
    ) ||
    mainLanguages.some((language) =>
      ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust'].includes(language.name),
    )
  const stackLabels =
    frameworks.length > 0
      ? frameworks.filter((framework) => !['Linting', 'TypeScript', 'Python', 'Go', 'Rust'].includes(framework))
      : []

  return {
    repository,
    commits,
    latestCommit,
    mainLanguages,
    frameworks,
    stackLabels,
    workflowNames,
    readmePath,
    hasReadme,
    hasDocsDir,
    hasContributing,
    hasSourceDir,
    hasTests,
    hasCi,
    hasDocker,
    hasInfra,
    hasLint,
    hasBuildScript,
    hasTestScript,
    hasLintScript,
    hasTypecheckScript,
    hasWorkflowBuild,
    hasWorkflowTest,
    hasWorkflowLint,
    hasWorkflowTypecheck,
    hasWorkflowSecurity,
    hasWorkflowDeploy,
    workflowCount: workflowSignals.length,
    codeSampleCount,
    hasLockfile,
    hasSecurityFile,
    hasTypedLanguage,
    hasFrontendStack,
    hasBackendStack,
    meaningfulCommitRatio,
    uniqueAuthors,
    daysSinceLastPush,
  }
}

function buildMetrics(
  signals: ReturnType<typeof buildRepositorySignals>,
): DevMetric {
  return {
    readability: clamp(
      38 +
        (signals.hasReadme ? 15 : 0) +
        (signals.repository.description ? 8 : 0) +
        Math.min(signals.repository.topics?.length ?? 0, 4) * 3 +
        (signals.hasDocsDir ? 8 : 0) +
        (signals.hasContributing ? 6 : 0) +
        Math.round(signals.meaningfulCommitRatio * 15) +
        (signals.codeSampleCount >= 2 ? 4 : 0),
      0,
      100,
    ),
    efficiency: clamp(
      34 +
        Math.min(signals.commits.length, 12) * 2 +
        (signals.hasBuildScript ? 8 : 0) +
        (signals.hasTestScript ? 8 : 0) +
        (signals.hasLintScript ? 4 : 0) +
        (signals.hasCi ? 8 : 0) +
        (signals.hasWorkflowBuild ? 7 : 0) +
        (signals.hasWorkflowTest ? 7 : 0) +
        (signals.hasWorkflowLint ? 4 : 0) +
        activityBonus(signals.daysSinceLastPush),
      0,
      100,
    ),
    security: clamp(
      33 +
        (signals.hasCi ? 8 : 0) +
        (signals.hasWorkflowSecurity ? 12 : 0) +
        (signals.hasLockfile ? 10 : 0) +
        (signals.hasTests ? 6 : 0) +
        (signals.hasSecurityFile ? 12 : 0) +
        (signals.hasDocker ? 4 : 0) +
        (signals.hasTypecheckScript ? 5 : 0),
      0,
      100,
    ),
    architecture: clamp(
      40 +
        (signals.hasSourceDir ? 10 : 0) +
        (signals.hasInfra ? 10 : 0) +
        (signals.hasDocker ? 8 : 0) +
        (signals.stackLabels.length > 1 ? 10 : 0) +
        (signals.mainLanguages.length > 1 ? 6 : 0) +
        (signals.repository.size > 900 ? 8 : 0) +
        (signals.hasBuildScript ? 4 : 0) +
        (signals.codeSampleCount >= 3 ? 4 : 0),
      0,
      100,
    ),
    consistency: clamp(
      40 +
        (signals.hasLint ? 10 : 0) +
        (signals.hasTestScript ? 6 : 0) +
        (signals.hasTests ? 6 : 0) +
        (signals.hasCi ? 8 : 0) +
        (signals.hasWorkflowLint ? 6 : 0) +
        (signals.hasWorkflowTypecheck ? 6 : 0) +
        Math.round(signals.meaningfulCommitRatio * 12) +
        (signals.hasTypedLanguage ? 8 : 0),
      0,
      100,
    ),
    modernity: clamp(
      34 +
        (signals.hasTypedLanguage ? 14 : 0) +
        activityBonus(signals.daysSinceLastPush) +
        modernStackBonus(signals.frameworks) +
        (signals.hasCi ? 6 : 0) +
        (signals.hasDocker ? 6 : 0) +
        (signals.hasWorkflowDeploy ? 8 : 0) +
        (signals.hasTypecheckScript ? 4 : 0),
      0,
      100,
    ),
  }
}

function buildMetricBreakdown(
  metrics: DevMetric,
  signals: ReturnType<typeof buildRepositorySignals>,
): MetricBreakdown[] {
  return [
    {
      metric: 'readability',
      label: '가독성',
      score: metrics.readability,
      summary: summarizeMetric('readability', metrics.readability),
      signals: [
        createMetricSignal(
          signals.hasReadme ? 'positive' : 'warning',
          'README',
          signals.hasReadme
            ? `${signals.readmePath ?? 'README'} 진입 문서를 감지했습니다.`
            : '저장소 첫 진입 문서가 없어 맥락 파악 비용이 큽니다.',
        ),
        createMetricSignal(
          signals.hasDocsDir || signals.hasContributing ? 'positive' : 'neutral',
          '문서 범위',
          signals.hasDocsDir || signals.hasContributing
            ? 'docs 또는 기여 문서가 있어 협업 맥락을 설명합니다.'
            : '추가 문서 신호가 얇아 의도 전달은 README에 크게 의존합니다.',
        ),
        createMetricSignal(
          signals.meaningfulCommitRatio >= 0.7 ? 'positive' : signals.meaningfulCommitRatio >= 0.45 ? 'neutral' : 'warning',
          '커밋 메시지',
          `설명형 커밋 비율 ${Math.round(signals.meaningfulCommitRatio * 100)}%를 반영했습니다.`,
        ),
      ],
    },
    {
      metric: 'efficiency',
      label: '효율성',
      score: metrics.efficiency,
      summary: summarizeMetric('efficiency', metrics.efficiency),
      signals: [
        createMetricSignal(
          signals.hasBuildScript ? 'positive' : 'warning',
          '빌드 스크립트',
          signals.hasBuildScript ? '실행 가능한 build 스크립트를 확인했습니다.' : 'build 스크립트가 없어 재현 가능한 검증 경로가 약합니다.',
        ),
        createMetricSignal(
          signals.hasWorkflowBuild || signals.hasWorkflowTest ? 'positive' : 'warning',
          '자동화 워크플로',
          signals.hasWorkflowBuild || signals.hasWorkflowTest
            ? `${signals.workflowCount}개의 워크플로에서 빌드 또는 테스트 자동화를 감지했습니다.`
            : '빌드·테스트 자동화 워크플로가 보이지 않습니다.',
        ),
        createMetricSignal(
          signals.daysSinceLastPush <= 14 ? 'positive' : signals.daysSinceLastPush <= 45 ? 'neutral' : 'warning',
          '최근 활동',
          `${signals.daysSinceLastPush}일 전 마지막 푸시를 반영했습니다.`,
        ),
      ],
    },
    {
      metric: 'security',
      label: '보안성',
      score: metrics.security,
      summary: summarizeMetric('security', metrics.security),
      signals: [
        createMetricSignal(
          signals.hasLockfile ? 'positive' : 'warning',
          '버전 고정',
          signals.hasLockfile ? '잠금 파일이 있어 의존성 재현성이 높습니다.' : '잠금 파일이 없어 의존성 드리프트 위험이 있습니다.',
        ),
        createMetricSignal(
          signals.hasWorkflowSecurity || signals.hasSecurityFile ? 'positive' : 'warning',
          '보안 신호',
          signals.hasWorkflowSecurity || signals.hasSecurityFile
            ? '보안 문서 또는 스캔 워크플로를 감지했습니다.'
            : '보안 정책이나 스캔 자동화가 아직 얇습니다.',
        ),
        createMetricSignal(
          signals.hasTypecheckScript ? 'positive' : 'neutral',
          '검증 강도',
          signals.hasTypecheckScript
            ? '타입 검증 스크립트가 있어 런타임 전 조기 차단 신호가 있습니다.'
            : '정적 검증 스크립트 신호는 제한적입니다.',
        ),
      ],
    },
    {
      metric: 'architecture',
      label: '아키텍처',
      score: metrics.architecture,
      summary: summarizeMetric('architecture', metrics.architecture),
      signals: [
        createMetricSignal(
          signals.hasSourceDir ? 'positive' : 'warning',
          '소스 구조',
          signals.hasSourceDir ? 'src, app, packages 같은 소스 디렉터리 구조를 확인했습니다.' : '소스 구조가 루트에 많이 섞여 있을 가능성이 있습니다.',
        ),
        createMetricSignal(
          signals.stackLabels.length > 1 || signals.mainLanguages.length > 1 ? 'positive' : 'neutral',
          '스택 구성',
          signals.stackLabels.length > 0
            ? `${signals.stackLabels.join(', ')} 조합을 감지했습니다.`
            : '프레임워크 신호가 적어 구조적 역할 분담을 판단하기 어렵습니다.',
        ),
        createMetricSignal(
          signals.hasDocker || signals.hasInfra ? 'positive' : 'neutral',
          '운영 준비',
          signals.hasDocker || signals.hasInfra
            ? '인프라 또는 실행 패키징 신호가 있어 구조 확장성을 뒷받침합니다.'
            : '운영 관점의 구조 신호는 아직 약합니다.',
        ),
      ],
    },
    {
      metric: 'consistency',
      label: '일관성',
      score: metrics.consistency,
      summary: summarizeMetric('consistency', metrics.consistency),
      signals: [
        createMetricSignal(
          signals.hasLint ? 'positive' : 'warning',
          'Lint 규칙',
          signals.hasLint ? 'lint 설정 또는 lint 스크립트를 감지했습니다.' : '정적 스타일 검증 신호가 없어 코드 스타일 편차가 커질 수 있습니다.',
        ),
        createMetricSignal(
          signals.hasWorkflowLint || signals.hasWorkflowTypecheck ? 'positive' : 'neutral',
          '자동 검증',
          signals.hasWorkflowLint || signals.hasWorkflowTypecheck
            ? 'lint 또는 typecheck가 워크플로에 연결돼 있습니다.'
            : '규칙이 있어도 자동 검증 연결은 더 보강할 수 있습니다.',
        ),
        createMetricSignal(
          signals.hasTypedLanguage ? 'positive' : 'neutral',
          '타입 시스템',
          signals.hasTypedLanguage ? '타입 기반 언어 또는 설정이 있어 일관성 유지에 유리합니다.' : '동적 언어 비중이 높아 별도 규칙 관리가 더 중요합니다.',
        ),
      ],
    },
    {
      metric: 'modernity',
      label: '현대성',
      score: metrics.modernity,
      summary: summarizeMetric('modernity', metrics.modernity),
      signals: [
        createMetricSignal(
          signals.hasTypedLanguage ? 'positive' : 'neutral',
          '현대 스택',
          signals.hasTypedLanguage
            ? `${signals.mainLanguages.map((language) => language.name).join(', ')} 기반 스택을 감지했습니다.`
            : '현대 개발 도구 신호는 있으나 타입 기반 스택 근거는 제한적입니다.',
        ),
        createMetricSignal(
          signals.hasWorkflowDeploy ? 'positive' : 'neutral',
          '배포 자동화',
          signals.hasWorkflowDeploy ? '배포 또는 릴리스 워크플로가 연결돼 있습니다.' : '배포 자동화 신호는 아직 드러나지 않습니다.',
        ),
        createMetricSignal(
          signals.daysSinceLastPush <= 14 ? 'positive' : signals.daysSinceLastPush <= 45 ? 'neutral' : 'warning',
          '최근성',
          `${signals.daysSinceLastPush}일 전까지 업데이트된 저장소입니다.`,
        ),
      ],
    },
  ]
}

function summarizeMetric(metric: MetricBreakdown['metric'], score: number) {
  const level = score >= 85 ? 'strong' : score >= 70 ? 'steady' : 'thin'

  const copy: Record<
    MetricBreakdown['metric'],
    Record<'strong' | 'steady' | 'thin', string>
  > = {
    readability: {
      strong: '문서와 커밋 설명이 비교적 분명해 저장소 진입 장벽이 낮습니다.',
      steady: '기본 설명은 갖춰졌지만 협업 문서와 구조 설명이 더해지면 해석이 쉬워집니다.',
      thin: '설명형 문서와 커밋 근거가 얇아 코드 의도를 읽는 비용이 큽니다.',
    },
    efficiency: {
      strong: '빌드와 검증 흐름이 자동화되어 반복 작업 비용을 잘 줄이고 있습니다.',
      steady: '핵심 자동화는 보이지만 build, test, lint 연결을 더 촘촘히 만들 여지가 있습니다.',
      thin: '재현 가능한 빌드·검증 루프 신호가 약해 실무형 생산성 근거가 제한적입니다.',
    },
    security: {
      strong: '의존성 고정과 검증 신호가 있어 기본 보안 위생이 잘 갖춰져 있습니다.',
      steady: '보안 기본기는 보이지만 정책 문서나 스캔 자동화가 더해지면 신뢰도가 높아집니다.',
      thin: '보안 정책과 자동 스캔 근거가 적어 리스크를 조기에 드러내기 어렵습니다.',
    },
    architecture: {
      strong: '소스 구조와 운영 신호가 함께 보여 구조적 의도가 비교적 선명합니다.',
      steady: '구조는 잡혀 있지만 실행 패키징이나 모듈 역할 분담 신호를 더 보강할 수 있습니다.',
      thin: '디렉터리 구조와 운영 준비 신호가 얇아 아키텍처 설명력이 부족합니다.',
    },
    consistency: {
      strong: '정적 규칙과 자동 검증이 연결돼 코드 일관성을 유지하기 좋은 상태입니다.',
      steady: '기본 규칙은 있으나 lint, typecheck, CI를 더 강하게 묶으면 흔들림이 줄어듭니다.',
      thin: '규칙 자동화 근거가 적어 팀 규모가 커질수록 편차가 늘어날 수 있습니다.',
    },
    modernity: {
      strong: '현대 스택과 최근 운영 방식 신호가 함께 보여 기술 최신성이 잘 드러납니다.',
      steady: '기술 선택은 무난하지만 배포 자동화나 최신 운영 도구 근거를 더 쌓을 수 있습니다.',
      thin: '최근성이나 현대적 도구 사용 신호가 약해 현재성 판단 근거가 제한적입니다.',
    },
  }

  return copy[metric][level]
}

function createMetricSignal(
  status: 'positive' | 'warning' | 'neutral',
  label: string,
  detail: string,
) {
  return {
    status,
    label,
    detail,
  }
}

function buildMarketFits(signals: ReturnType<typeof buildRepositorySignals>): MarketFit[] {
  const missingFrontend = collectMissingTech([
    [!signals.hasTests, '컴포넌트 또는 통합 테스트'],
    [!signals.hasCi, 'CI 검사'],
    [!signals.hasTypedLanguage, '강한 타입 안정성'],
    [!signals.hasReadme, 'UI 사용 문서'],
  ])
  const missingBackend = collectMissingTech([
    [!signals.hasDocker, '컨테이너 실행 기반'],
    [!signals.hasTests, 'API 또는 통합 테스트'],
    [!signals.hasCi, '릴리즈 검증'],
    [!signals.hasLockfile, '의존성 버전 고정'],
  ])
  const missingPlatform = collectMissingTech([
    [!signals.hasDocker, '컨테이너화'],
    [!signals.hasInfra, 'IaC 또는 배포 설정'],
    [!signals.hasCi, '자동화 파이프라인'],
    [signals.uniqueAuthors <= 1, '운영 인수인계 신호'],
  ])

  return [
    {
      targetJob: '프론트엔드 / 풀스택 엔지니어',
      similarityScore: clamp(
        35 +
          (signals.hasFrontendStack ? 24 : 0) +
          (signals.hasTests ? 8 : 0) +
          (signals.hasCi ? 6 : 0) +
          (signals.hasTypedLanguage ? 10 : 0) +
          (signals.hasReadme ? 4 : 0) +
          activityBonus(signals.daysSinceLastPush),
        0,
        100,
      ),
      missingTech: missingFrontend,
    },
    {
      targetJob: '백엔드 엔지니어',
      similarityScore: clamp(
        34 +
          (signals.hasBackendStack ? 22 : 0) +
          (signals.hasDocker ? 10 : 0) +
          (signals.hasTests ? 8 : 0) +
          (signals.hasCi ? 8 : 0) +
          (signals.hasLockfile ? 6 : 0) +
          activityBonus(signals.daysSinceLastPush),
        0,
        100,
      ),
      missingTech: missingBackend,
    },
    {
      targetJob: '플랫폼 / DevOps 엔지니어',
      similarityScore: clamp(
        24 +
          (signals.hasDocker ? 18 : 0) +
          (signals.hasInfra ? 16 : 0) +
          (signals.hasCi ? 18 : 0) +
          (signals.hasTests ? 6 : 0) +
          (signals.hasLockfile ? 4 : 0) +
          Math.min(signals.uniqueAuthors, 3) * 3,
        0,
        100,
      ),
      missingTech: missingPlatform,
    },
  ]
}

function buildReviewSuggestions(signals: ReturnType<typeof buildRepositorySignals>): ReviewSuggestion[] {
  const suggestions: ReviewSuggestion[] = []

  if (!signals.hasTests) {
    suggestions.push({
      id: 'review-tests',
      title: '자동화 테스트 기본선 추가',
      impact: '품질 + 회귀 안정성',
      description:
        '저장소 루트나 패키지 설정에서 명확한 테스트 흔적이 확인되지 않았습니다. Jest, Vitest, Pytest, Playwright 같은 테스트를 추가하면 신호가 훨씬 강해집니다.',
    })
  }

  if (!signals.hasCi) {
    suggestions.push({
      id: 'review-ci',
      title: '저장소를 CI 검사에 연결하기',
      impact: '전달 속도 + 신뢰도',
      description:
        '워크플로 디렉터리나 CI 설정이 보이지 않습니다. lint, typecheck, 테스트만 도는 가벼운 파이프라인이라도 릴리즈 신뢰도를 바로 높여줍니다.',
    })
  }

  if (!signals.hasReadme) {
    suggestions.push({
      id: 'review-docs',
      title: '온보딩 문서 강화',
      impact: '협업 + 인수인계',
      description:
        '저장소 루트에서 README나 문서 진입점을 찾지 못했습니다. 설치 방법, 아키텍처, 실행 방법을 정리하면 가독성과 채용 신호가 함께 좋아집니다.',
    })
  }

  if (!signals.hasDocker && signals.hasBackendStack) {
    suggestions.push({
      id: 'review-docker',
      title: '배포 가능한 런타임 기본선 추가',
      impact: '이식성 + 운영 준비도',
      description:
        '애플리케이션 중심 저장소로 보이지만 Docker나 compose 설정이 없습니다. 이를 추가하면 로컬-배포 환경 일치와 배포 리허설이 훨씬 쉬워집니다.',
    })
  }

  if (signals.meaningfulCommitRatio < 0.6) {
    suggestions.push({
      id: 'review-commit-hygiene',
      title: '커밋 메시지 위생 개선',
      impact: '리뷰 용이성 + 서사성',
      description:
        '최근 커밋 메시지가 짧거나 너무 일반적인 편입니다. 더 설명적인 제목을 쓰면 코드 리뷰와 포트폴리오 스토리 전달력이 함께 좋아집니다.',
    })
  }

  const fallbackSuggestions: ReviewSuggestion[] = [
    {
      id: 'review-stack-coverage',
      title: '현재 핵심 스택 주변의 증거 넓히기',
      impact: '시장 적합도 + 신뢰도',
      description:
        '저장소는 이미 분명한 기술 방향을 보여주고 있습니다. 여기에 CI, 테스트, 배포 설정 중 하나만 더해도 전체 프로필을 빠르게 끌어올릴 수 있습니다.',
    },
    {
      id: 'review-release-signal',
      title: '릴리즈 기대치를 명확히 하기',
      impact: '전달력 + 협업',
      description:
        '짧은 기여 가이드, 릴리즈 노트 규칙, 유지보수 체크리스트가 있으면 소유권 기대치가 훨씬 선명해집니다.',
    },
    {
      id: 'review-portfolio-story',
      title: '저장소 중심의 포트폴리오 스토리 선명하게 만들기',
      impact: '채용 신호 + 명확성',
      description:
        '짧은 아키텍처 노트나 로드맵 섹션을 추가하면 왜 이 저장소가 중요한지, 다음 단계가 무엇인지 더 잘 전달할 수 있습니다.',
    },
  ]

  for (const suggestion of fallbackSuggestions) {
    if (suggestions.length >= 3) {
      break
    }

    suggestions.push(suggestion)
  }

  return suggestions.slice(0, 3)
}

function buildConceptGaps(signals: ReturnType<typeof buildRepositorySignals>): ConceptGap[] {
  const gaps: ConceptGap[] = []

  if (!signals.hasTests) {
    gaps.push({
      id: 'gap-tests',
      title: '테스트 자동화 커버리지',
      category: '품질 신호',
      severity: 'high',
      timestamp: formatDateTime(new Date()),
      summary:
        '스캔 결과 자동화 테스트 구성이 뚜렷하게 보이지 않습니다. 이 상태에서는 회귀 위험을 가늠하기 어렵고 리뷰어에게 전달되는 품질 신호도 약해집니다.',
      recommendation: '작더라도 눈에 띄는 단위 테스트나 통합 테스트를 추가하고 CI에서 실행하세요.',
    })
  }

  if (!signals.hasCi) {
    gaps.push({
      id: 'gap-ci',
      title: '배포 파이프라인 가시성',
      category: '릴리즈 워크플로',
      severity: 'high',
      timestamp: formatDateTime(new Date(signals.repository.updated_at)),
      summary:
        '루트 구조에서 워크플로나 CI 설정이 보이지 않습니다. 현재는 lint, 테스트 실행, 릴리즈 검증이 대부분 암묵적인 상태로 남아 있습니다.',
      recommendation: 'lint, build, test 검증용 GitHub Actions 워크플로를 추가하세요.',
    })
  }

  if (!signals.hasReadme) {
    gaps.push({
      id: 'gap-docs',
      title: '저장소 온보딩 명확성',
      category: '문서화',
      severity: 'medium',
      timestamp: formatDateTime(new Date(signals.repository.created_at)),
      summary:
        'README가 없으면 저장소만 보고 설치 의도와 의사결정 맥락을 재구성하기 어렵습니다. 이는 가독성과 협업 신뢰도를 직접 떨어뜨립니다.',
      recommendation: '목적, 스택, 로컬 실행 방법, 주요 트레이드오프를 담은 간결한 README를 추가하세요.',
    })
  }

  if (!signals.hasDocker && signals.hasBackendStack) {
    gaps.push({
      id: 'gap-runtime',
      title: '배포 이식성',
      category: '플랫폼 준비도',
      severity: 'medium',
      timestamp: formatDateTime(new Date(signals.repository.pushed_at)),
      summary:
        '저장소에는 애플리케이션 로직이 보이지만 실행 패키징이나 배포 기본선이 명확하지 않습니다. 이 때문에 운영 준비도를 판단하기가 어렵습니다.',
      recommendation: '앱 실행 방식을 설명하는 Dockerfile 또는 런타임 매니페스트를 추가하세요.',
    })
  }

  if (signals.daysSinceLastPush > 45) {
    gaps.push({
      id: 'gap-cadence',
      title: '저장소 활동의 최신성',
      category: '유지보수 주기',
      severity: 'low',
      timestamp: formatDateTime(new Date(signals.repository.pushed_at)),
      summary:
        '마지막 푸시가 비교적 오래되어 현재의 소유권과 반복 개발 속도를 공개 이력만으로 파악하기 어렵습니다.',
      recommendation: '작은 유지보수 작업, 변경 로그 메모, 정리용 커밋으로 저장소를 한 번 갱신해보세요.',
    })
  }

  const fallbackGaps: ConceptGap[] = [
    {
      id: 'gap-typed-signal',
      title: '타입 기반 가드레일 범위',
      category: '유지보수성',
      severity: signals.hasTypedLanguage ? 'low' : 'medium',
      timestamp: formatDateTime(new Date()),
      summary:
        '타입 안정성과 도구 일관성은 포트폴리오 신호의 일부입니다. 작은 범위라도 명시적인 스키마나 타입 검증이 있으면 아키텍처 의도를 읽기 쉬워집니다.',
      recommendation: '가장 중요한 경로부터 스키마 또는 타입 검증을 더 강하게 추가하세요.',
    },
    {
      id: 'gap-collaboration-signal',
      title: '협업 신호 노출 범위',
      category: '팀 워크플로',
      severity: 'low',
      timestamp: formatDateTime(new Date()),
      summary:
        '현재 저장소는 루트 표면에서 인수인계 품질, 리뷰 기대치, 기여자 온보딩에 대한 증거를 더 보여줄 수 있습니다.',
      recommendation: '기여 가이드, 소유권 안내, 가벼운 프로젝트 보드 링크 중 하나를 추가해보세요.',
    },
  ]

  for (const gap of fallbackGaps) {
    if (gaps.length >= 3) {
      break
    }

    gaps.push(gap)
  }

  return gaps.slice(0, 3)
}

function buildActivity(signals: ReturnType<typeof buildRepositorySignals>): ActivityEvent[] {
  const primaryLanguages =
    signals.mainLanguages.length > 0
      ? signals.mainLanguages.map((language) => `${language.name} ${language.share}%`).join(', ')
      : '언어 데이터 없음'
  const stackSummary =
    signals.stackLabels.length > 0 ? signals.stackLabels.join(', ') : '프레임워크 신호가 아직 약합니다'
  const healthSummary = [
    signals.hasTests ? '테스트 감지' : '테스트 없음',
    signals.hasCi ? 'CI 감지' : 'CI 없음',
    signals.hasDocker ? '실행 패키징 감지' : '실행 패키징 없음',
  ].join(' | ')

  return [
    {
      id: 'activity-scan',
      time: formatClock(new Date()),
      label: '실시간 저장소 스캔 완료',
      detail: `${signals.repository.full_name} 저장소 분석을 완료했습니다. 주요 언어 비중: ${primaryLanguages}.`,
    },
    {
      id: 'activity-commit',
      time: formatClock(new Date(signals.latestCommit?.commit.author?.date ?? signals.repository.pushed_at)),
      label: '기본 브랜치 최신 커밋',
      detail: signals.latestCommit
        ? `${signals.latestCommit.sha.slice(0, 7)} | ${firstLine(signals.latestCommit.commit.message)}`
        : '기본 브랜치에서 최근 커밋을 찾지 못했습니다.',
    },
    {
      id: 'activity-stack',
      time: formatClock(new Date(signals.repository.updated_at)),
      label: '스택 및 워크플로 신호',
      detail: `${stackSummary}. ${healthSummary}.`,
    },
  ]
}

function buildHeuristicAIInsight({
  metrics,
  reviewSuggestions,
  conceptGaps,
}: {
  metrics: DevMetric
  reviewSuggestions: ReviewSuggestion[]
  conceptGaps: ConceptGap[]
}): AIInsight {
  const rankedMetrics = (Object.entries(metrics) as Array<[keyof DevMetric, number]>).sort(
    (left, right) => right[1] - left[1],
  )
  const strongestLabel = getMetricLabel(rankedMetrics[0]?.[0] ?? 'readability')
  const weakestLabel = getMetricLabel(rankedMetrics[rankedMetrics.length - 1]?.[0] ?? 'readability')
  const leadingGap = conceptGaps[0]
  const leadingSuggestion = reviewSuggestions[0]

  return {
    headline: `${strongestLabel} 강점은 유지하고 ${weakestLabel}을 우선 보강하세요.`,
    summary:
      leadingGap?.summary ??
      `${weakestLabel} 지표가 상대적으로 낮아 전체 실무 신뢰도를 끌어내리고 있습니다. 개선 우선순위를 명확히 잡는 것이 좋습니다.`,
    strengths: rankedMetrics.slice(0, 3).map(([key, score]) => `${getMetricLabel(key)} ${Math.round(score)}점`),
    nextStep:
      leadingGap?.recommendation ??
      leadingSuggestion?.description ??
      `${weakestLabel}과 연결된 핵심 모듈부터 테스트와 에러 처리 규칙을 보강하세요.`,
  }
}

function buildHeuristicCleanCodeEvaluation(
  metrics: DevMetric,
  signals: ReturnType<typeof buildRepositorySignals>,
): CleanCodeEvaluation {
  const criterionScores: Record<CleanCodeCriterionKey, number> = {
    naming: clamp(Math.round(metrics.readability * 0.7 + metrics.consistency * 0.3), 0, 100),
    singleResponsibility: clamp(
      Math.round(metrics.architecture * 0.72 + (signals.hasSourceDir ? 8 : -6)),
      0,
      100,
    ),
    complexity: clamp(
      Math.round(metrics.efficiency * 0.6 + metrics.readability * 0.4 - (signals.repository.size > 3000 ? 6 : 0)),
      0,
      100,
    ),
    errorHandling: clamp(
      Math.round(metrics.security * 0.68 + (signals.hasTests ? 7 : -7) + (signals.hasCi ? 5 : 0)),
      0,
      100,
    ),
    validation: clamp(
      Math.round(metrics.security * 0.56 + metrics.consistency * 0.44 + (signals.hasTests ? 5 : 0)),
      0,
      100,
    ),
    modularity: clamp(
      Math.round(metrics.architecture * 0.7 + metrics.consistency * 0.3 + (signals.hasSourceDir ? 6 : -4)),
      0,
      100,
    ),
  }

  const criteria = HEURISTIC_CLEAN_CODE_CRITERIA.map((criterion) => ({
    ...criterion,
    score: criterionScores[criterion.key],
    rationale: buildHeuristicCriterionRationale(criterion.key, criterionScores[criterion.key], signals),
  }))
  const score = clamp(
    Math.round(criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0)),
    0,
    100,
  )
  const weakest = criteria.reduce((lowest, current) => (current.score < lowest.score ? current : lowest))

  return {
    score,
    formula: 'Score_clean = Σ w_i × c_i',
    summary: `${weakest.label} 항목이 상대적으로 낮아 유지보수성 병목이 생길 수 있습니다.`,
    criteria,
  }
}

function buildHeuristicCriterionRationale(
  key: CleanCodeCriterionKey,
  score: number,
  signals: ReturnType<typeof buildRepositorySignals>,
) {
  if (key === 'naming') {
    return score >= 70
      ? '문서와 커밋 신호가 비교적 명확해 식별자 의미를 추적하기 쉬운 편입니다.'
      : '설명 신호가 약해 식별자 의도와 책임 경계를 파악하는 데 시간이 더 필요합니다.'
  }

  if (key === 'singleResponsibility') {
    return signals.hasSourceDir
      ? '소스 디렉터리 구분이 있어 역할 경계를 나누려는 구조적 의도가 보입니다.'
      : '핵심 소스 디렉터리 경계가 약해 역할 분리 신호가 충분하지 않습니다.'
  }

  if (key === 'complexity') {
    return signals.hasCi
      ? '자동화 신호가 있어 복잡도 증가 시 회귀 탐지가 가능한 구조에 가깝습니다.'
      : '자동화 검증 신호가 약해 복잡한 변경의 회귀를 조기에 포착하기 어렵습니다.'
  }

  if (key === 'errorHandling') {
    return signals.hasTests
      ? '테스트/검증 신호가 있어 실패 경로를 점검하는 기본선이 보입니다.'
      : '테스트 근거가 부족해 실패 경로의 안전성을 신뢰하기 어렵습니다.'
  }

  if (key === 'validation') {
    return signals.hasTypedLanguage
      ? '타입 기반 신호가 있어 입력 경계 검증을 체계화하기 좋은 상태입니다.'
      : '명시적 타입/스키마 신호가 부족해 입력 경계 검증 전략을 강화할 필요가 있습니다.'
  }

  return signals.hasSourceDir
    ? '모듈 분리의 기본 형태는 보이지만 결합도 관리 기준을 더 선명하게 만들면 좋습니다.'
    : '모듈 경계 정보가 제한적이어서 변경 영향 범위를 예측하기 어렵습니다.'
}

function buildContributorInsights({
  contributors,
  commits,
  recentCommitDetails,
  collectedAt,
}: {
  contributors: GitHubContributorResponse[]
  commits: GitHubCommitResponse[]
  recentCommitDetails: RecentCommitDetail[]
  collectedAt: string
}): ContributorInsight[] {
  type ContributorQualitySignal = {
    name: string
    handle: string | null
    totalContributions: number | null
    recentCommitCount: number
    recentCommitAt: string | null
    messages: string[]
    files: Set<string>
    fileStats: Map<string, { touches: number; changes: number }>
    totalChanges: number
    testFileTouches: number
    docFileTouches: number
    configFileTouches: number
    anyTypeSignals: number
    errorHandlingSignals: number
    validationSignals: number
    largeChangeCommitCount: number
  }

  const merged = new Map<string, ContributorQualitySignal>()

  for (const contributor of contributors) {
    const handle = contributor.login?.trim() ?? null
    const name = handle || '익명 기여자'
    const key = normalizeContributorKey(handle ?? name)

    merged.set(key, {
      name,
      handle,
      totalContributions: typeof contributor.contributions === 'number' ? contributor.contributions : null,
      recentCommitCount: 0,
      recentCommitAt: null,
      messages: [],
      files: new Set(),
      fileStats: new Map(),
      totalChanges: 0,
      testFileTouches: 0,
      docFileTouches: 0,
      configFileTouches: 0,
      anyTypeSignals: 0,
      errorHandlingSignals: 0,
      validationSignals: 0,
      largeChangeCommitCount: 0,
    })
  }

  for (const detail of recentCommitDetails) {
    const identity = detail.authorHandle ?? detail.authorName
    const key = normalizeContributorKey(identity)
    const current =
      merged.get(key) ??
      {
        name: detail.authorName,
        handle: detail.authorHandle,
        totalContributions: null,
        recentCommitCount: 0,
        recentCommitAt: null,
        messages: [],
        files: new Set<string>(),
        fileStats: new Map<string, { touches: number; changes: number }>(),
        totalChanges: 0,
        testFileTouches: 0,
        docFileTouches: 0,
        configFileTouches: 0,
        anyTypeSignals: 0,
        errorHandlingSignals: 0,
        validationSignals: 0,
        largeChangeCommitCount: 0,
      }

    const commitChangeSize = detail.files.reduce((sum, file) => sum + file.changes, 0)
    if (commitChangeSize >= 450) {
      current.largeChangeCommitCount += 1
    }

    if (detail.message && current.messages.length < 20) {
      current.messages.push(detail.message)
    }

    const latest =
      current.recentCommitAt && detail.date
        ? new Date(current.recentCommitAt).getTime() >= new Date(detail.date).getTime()
          ? current.recentCommitAt
          : detail.date
        : current.recentCommitAt ?? detail.date
    current.recentCommitAt = latest
    current.recentCommitCount += 1

    for (const file of detail.files) {
      const normalizedPath = file.path.toLowerCase()
      const currentFile = current.fileStats.get(file.path)
      current.totalChanges += file.changes
      current.files.add(file.path)

      if (!currentFile) {
        current.fileStats.set(file.path, { touches: 1, changes: file.changes })
      } else {
        current.fileStats.set(file.path, {
          touches: currentFile.touches + 1,
          changes: currentFile.changes + file.changes,
        })
      }

      if (isTestFilePath(normalizedPath)) {
        current.testFileTouches += 1
      }
      if (isDocumentationFilePath(normalizedPath)) {
        current.docFileTouches += 1
      }
      if (isConfigOrInfraFilePath(normalizedPath)) {
        current.configFileTouches += 1
      }

      if (file.patch) {
        current.anyTypeSignals += (file.patch.match(/\bany\b/g) ?? []).length
        current.errorHandlingSignals += (file.patch.match(/\b(try|catch|throw|error)\b/gi) ?? []).length
        current.validationSignals +=
          (file.patch.match(/\b(validate|schema|zod|joi|guard|assert|sanitize)\b/gi) ?? []).length
      }
    }

    merged.set(key, current)
  }

  for (const commit of commits) {
    const handle = commit.author?.login?.trim() ?? null
    const name = commit.commit.author?.name?.trim() || handle || '알 수 없는 기여자'
    const key = normalizeContributorKey(handle ?? name)
    const current =
      merged.get(key) ??
      {
        name,
        handle,
        totalContributions: null,
        recentCommitCount: 0,
        recentCommitAt: null,
        messages: [],
        files: new Set<string>(),
        fileStats: new Map<string, { touches: number; changes: number }>(),
        totalChanges: 0,
        testFileTouches: 0,
        docFileTouches: 0,
        configFileTouches: 0,
        anyTypeSignals: 0,
        errorHandlingSignals: 0,
        validationSignals: 0,
        largeChangeCommitCount: 0,
      }

    const message = firstLine(commit.commit.message)
    if (message && !current.messages.includes(message) && current.messages.length < 20) {
      current.messages.push(message)
    }

    merged.set(key, current)
  }

  return Array.from(merged.values())
    .filter((entry) => entry.name.trim().length > 0)
    .sort((left, right) => {
      const leftWeight = (left.totalContributions ?? 0) * 10 + left.recentCommitCount
      const rightWeight = (right.totalContributions ?? 0) * 10 + right.recentCommitCount
      return rightWeight - leftWeight
    })
    .slice(0, MAX_CONTRIBUTOR_COUNT)
    .map((entry, index) => {
      const focusArea = inferContributorFocus(entry.messages, {
        testFileTouches: entry.testFileTouches,
        docFileTouches: entry.docFileTouches,
        configFileTouches: entry.configFileTouches,
      })
      const quality = evaluateContributorCodeQuality(entry, focusArea)

      return {
        id: `contributor-${index + 1}`,
        name: entry.name,
        handle: entry.handle,
        totalContributions: entry.totalContributions,
        recentCommitCount: entry.recentCommitCount,
        recentCommitAt: entry.recentCommitAt ?? collectedAt,
        focusArea,
        codeQualityScore: quality.score,
        codeQualitySummary: quality.summary,
        codeQualityBreakdown: quality.breakdown,
        evidence: quality.evidence,
        strengths: quality.strengths,
        risk: quality.risk,
        recommendation: quality.recommendation,
      }
    })
}

function inferContributorFocus(
  messages: string[],
  fileSignals: {
    testFileTouches: number
    docFileTouches: number
    configFileTouches: number
  },
) {
  if (fileSignals.testFileTouches >= 2) {
    return '테스트/품질'
  }
  if (fileSignals.configFileTouches >= 2) {
    return '인프라/배포'
  }
  if (fileSignals.docFileTouches >= 2) {
    return '문서/가이드'
  }

  if (messages.length === 0) {
    return '유지보수/전반'
  }

  const rules: Array<{ label: string; keywords: string[] }> = [
    { label: '테스트/품질', keywords: ['test', 'jest', 'vitest', 'pytest', 'cypress', 'playwright', 'lint', 'typecheck'] },
    { label: '문서/가이드', keywords: ['docs', 'doc', 'readme', 'guide', 'changelog'] },
    { label: '인프라/배포', keywords: ['deploy', 'docker', 'infra', 'workflow', 'ci', 'cd', 'k8s', 'terraform'] },
    { label: '버그 수정/안정화', keywords: ['fix', 'bug', 'hotfix', 'patch', 'error'] },
    { label: '리팩토링', keywords: ['refactor', 'cleanup', 'restructure', 'rename', 'optimize'] },
    { label: '기능 개발', keywords: ['feat', 'feature', 'implement', 'add', 'create'] },
  ]
  const lowerMessages = messages.join(' ').toLowerCase()
  let winner = '유지보수/전반'
  let highestScore = 0

  for (const rule of rules) {
    const score = rule.keywords.reduce(
      (sum, keyword) => sum + (lowerMessages.includes(keyword) ? 1 : 0),
      0,
    )

    if (score > highestScore) {
      highestScore = score
      winner = rule.label
    }
  }

  return winner
}

function evaluateContributorCodeQuality(
  signal: {
    recentCommitCount: number
    messages: string[]
    files: Set<string>
    fileStats: Map<string, { touches: number; changes: number }>
    totalChanges: number
    testFileTouches: number
    docFileTouches: number
    configFileTouches: number
    anyTypeSignals: number
    errorHandlingSignals: number
    validationSignals: number
    largeChangeCommitCount: number
    totalContributions: number | null
  },
  focusArea: string,
) {
  const commitCount = Math.max(signal.recentCommitCount, 1)
  const filesTouched = Math.max(signal.files.size, 1)
  const avgChangesPerCommit = signal.totalChanges / commitCount
  const filesPerCommit = filesTouched / commitCount
  const testRatio = signal.testFileTouches / filesTouched
  const genericCount = signal.messages.filter(isGenericCommitMessage).length
  const meaningfulRatio =
    signal.messages.length > 0 ? (signal.messages.length - genericCount) / signal.messages.length : 0
  const hasTestKeyword = signal.messages.some((message) => /\b(test|jest|vitest|pytest|cypress|playwright)\b/i.test(message))
  const hasFixKeyword = signal.messages.some((message) => /\b(fix|bug|hotfix|patch|security)\b/i.test(message))

  let naming = 56 + Math.round(meaningfulRatio * 20)
  if (genericCount === 0 && commitCount > 0) naming += 10
  if (signal.docFileTouches > 0) naming += 8
  naming = clamp(Math.round(naming), 40, 100)

  let singleResponsibility = 80
  if (filesPerCommit > 20) singleResponsibility -= 20
  else if (filesPerCommit > 10) singleResponsibility -= 10
  else if (filesPerCommit >= 2 && filesPerCommit <= 5) singleResponsibility += 10
  if (signal.largeChangeCommitCount >= 2) singleResponsibility -= 15
  singleResponsibility = clamp(Math.round(singleResponsibility), 20, 100)

  let complexity = 85
  if (avgChangesPerCommit > 500) complexity -= 25
  else if (avgChangesPerCommit > 200) complexity -= 15
  if (signal.largeChangeCommitCount > 1) complexity -= 15
  if (hasFixKeyword) complexity += 5
  complexity = clamp(Math.round(complexity), 20, 100)

  let errorHandling = 50
  errorHandling += Math.min(25, signal.errorHandlingSignals * 3)
  if (signal.configFileTouches > 0) errorHandling += 5
  if (hasFixKeyword) errorHandling += 10
  errorHandling -= Math.min(15, signal.anyTypeSignals * 2)
  errorHandling = clamp(Math.round(errorHandling), 20, 100)

  let validation = 50
  validation += Math.min(25, signal.validationSignals * 3)
  validation += Math.min(15, signal.testFileTouches * 2)
  if (hasFixKeyword) validation += 5
  validation = clamp(Math.round(validation), 20, 100)

  let modularity = 40 + Math.round(testRatio * 20)
  if (filesTouched > 10 && signal.totalChanges < 500) modularity += 15
  if (signal.testFileTouches > 0) modularity += 15
  modularity = clamp(Math.round(modularity), 20, 100)

  const score = clamp(
    Math.round(
      naming * 0.15 +
      singleResponsibility * 0.2 +
      complexity * 0.2 +
      errorHandling * 0.15 +
      validation * 0.15 +
      modularity * 0.15
    ),
    0,
    100,
  )
  const evidence = Array.from(signal.fileStats.entries())
    .sort((left, right) => right[1].changes - left[1].changes)
    .slice(0, 3)
    .map(([path, stats]) => `${path} (변경 ${stats.changes}줄, 터치 ${stats.touches}회)`)
  const breakdownEntries = [
    { key: 'naming', label: '네이밍', score: naming },
    { key: 'singleResponsibility', label: '단일 책임', score: singleResponsibility },
    { key: 'complexity', label: '복잡도', score: complexity },
    { key: 'errorHandling', label: '에러 처리', score: errorHandling },
    { key: 'validation', label: '입력 검증', score: validation },
    { key: 'modularity', label: '모듈화', score: modularity },
  ] as const
  const weakest = breakdownEntries.reduce((lowest, current) => (current.score < lowest.score ? current : lowest))
  const strengths = buildContributorStrengths({
    focusArea,
    totalContributions: signal.totalContributions,
    recentCommitCount: signal.recentCommitCount,
    breakdown: { naming, singleResponsibility, complexity, errorHandling, validation, modularity },
  })

  return {
    score,
    breakdown: {
      naming,
      singleResponsibility,
      complexity,
      errorHandling,
      validation,
      modularity,
    },
    summary: `${weakest.label} 점수가 상대적으로 낮아 이 구간 보완이 필요합니다.`,
    evidence: evidence.length > 0 ? evidence : ['최근 커밋 diff 기반 증거가 충분하지 않습니다.'],
    strengths,
    risk: buildContributorRisk({
      recentCommitCount: signal.recentCommitCount,
      focusArea,
      weakestKey: weakest.key,
      weakestScore: weakest.score,
    }),
    recommendation: buildContributorRecommendation({
      focusArea,
      weakestKey: weakest.key,
      recentCommitCount: signal.recentCommitCount,
    }),
  }
}

function buildContributorStrengths(input: {
  focusArea: string
  totalContributions: number | null
  recentCommitCount: number
  breakdown: {
    naming: number
    singleResponsibility: number
    complexity: number
    errorHandling: number
    validation: number
    modularity: number
  }
}) {
  const strengths: string[] = []

  if ((input.totalContributions ?? 0) >= 30) {
    strengths.push('누적 기여량이 높아 코드베이스 맥락 이해도가 높습니다.')
  }
  if (input.recentCommitCount >= 3) {
    strengths.push('최근 커밋 활동이 안정적으로 유지되고 있습니다.')
  }
  if (input.breakdown.naming >= 75) strengths.push('코드 네이밍 규칙과 의도 전달이 명확합니다.')
  if (input.breakdown.singleResponsibility >= 70) strengths.push('단일 커밋/수정 범위에 걸쳐 단일 책임 원칙을 잘 지킵니다.')
  if (input.breakdown.complexity >= 72) strengths.push('복잡도를 제어하며 간결한 코드 흐름을 유지합니다.')
  if (input.breakdown.errorHandling >= 72) strengths.push('에러 처리와 예외 상황 대비에 신경 씁니다.')
  if (input.breakdown.validation >= 72) strengths.push('입력 검증 및 타입 방어 로직이 탄탄합니다.')
  if (input.breakdown.modularity >= 72) strengths.push('관심사에 맞춰 파일을 잘 모듈화하여 작업합니다.')
  if (input.focusArea !== '유지보수/전반') {
    strengths.push(`${input.focusArea} 영역에서 명확한 작업 흔적이 보입니다.`)
  }

  if (strengths.length === 0) {
    strengths.push('최근 커밋 기반으로 기본적인 품질 유지 신호가 보입니다.')
  }

  return strengths.slice(0, 3)
}

function buildContributorRisk(input: {
  recentCommitCount: number
  focusArea: string
  weakestKey: 'naming' | 'singleResponsibility' | 'complexity' | 'errorHandling' | 'validation' | 'modularity'
  weakestScore: number
}) {
  if (input.recentCommitCount === 0) {
    return '최근 기본 브랜치 기여가 없어 현재 코드베이스 맥락이 끊길 수 있습니다.'
  }
  if (input.recentCommitCount === 1) {
    return '최근 기여 빈도가 낮아 지식 전파와 리뷰 속도가 느려질 수 있습니다.'
  }
  if (input.weakestKey === 'errorHandling' && input.weakestScore < 60) {
    return '에러 방어 및 예외 대응 로직이 다소 약해 보입니다.'
  }
  if (input.weakestKey === 'singleResponsibility' && input.weakestScore < 60) {
    return '하나의 모듈이나 커밋에 역할이 과도하게 섞여 결합도가 높아질 리스크가 있습니다.'
  }
  if (input.weakestKey === 'modularity' && input.weakestScore < 60) {
    return '로직 분리가 부족해 향후 유지보수 시 구조적 부채가 쌓일 수 있습니다.'
  }
  if (input.focusArea === '기능 개발') {
    return '기능 개발 비중이 높아 회귀 테스트 범위를 함께 확장하지 않으면 안정성 리스크가 생길 수 있습니다.'
  }

  return '즉시 치명적인 리스크는 낮지만, 역할 경계를 문서화하면 협업 효율이 더 좋아집니다.'
}

function buildContributorRecommendation(input: {
  focusArea: string
  weakestKey: 'naming' | 'singleResponsibility' | 'complexity' | 'errorHandling' | 'validation' | 'modularity'
  recentCommitCount: number
}) {
  if (input.recentCommitCount === 0) {
    return '작은 유지보수 커밋이라도 정기적으로 반영해 최신 소유권 신호를 회복하세요.'
  }
  if (input.weakestKey === 'singleResponsibility') {
    return '커밋과 파일 단위에서 역할과 책임을 명확히 나누는 것을 최우선으로 시도해 보세요.'
  }
  if (input.weakestKey === 'complexity') {
    return '복잡도가 높은 함수나 파일을 조기 반환(Early Return) 패턴 등을 통해 분리해 보세요.'
  }
  if (input.weakestKey === 'errorHandling') {
    return '실패 경로(예외 상황) 방어 로직을 먼저 작성해 운영 리스크를 줄이세요.'
  }
  if (input.weakestKey === 'modularity') {
    return '독립적으로 꺼낼 수 있는 비즈니스 로직이나 유틸 함수를 분리하여 재사용성을 높이세요.'
  }
  if (input.weakestKey === 'validation') {
    return '입력값과 외부 의존성 경계에서 타입 및 유효성 검사 로직을 보강하세요.'
  }
  if (input.weakestKey === 'naming') {
    return '변수나 함수의 이름을 좀 더 구체적이고 의도가 드러나도록 리팩토링해 보세요.'
  }
  if (input.focusArea === '테스트/품질') {
    return '테스트 커버리지를 CI 게이트와 연결해 팀 전체의 품질 기준으로 고정하세요.'
  }
  if (input.focusArea === '인프라/배포') {
    return '배포/워크플로 변경에는 운영 체크리스트를 함께 남겨 인수인계 비용을 낮추세요.'
  }
  if (input.focusArea === '문서/가이드') {
    return '문서 업데이트를 코드 변경과 같은 PR에 묶어 최신성 격차를 줄이세요.'
  }

  return '기능/리팩토링 변경 시 영향 범위를 작게 나눠 리뷰 가능성을 높이세요.'
}

function isGenericCommitMessage(message: string) {
  const normalized = message.trim().toLowerCase()
  return normalized.length < 12 || GENERIC_COMMIT_MESSAGES.has(normalized)
}

function isTestFilePath(path: string) {
  return (
    path.includes('/test/') ||
    path.includes('/tests/') ||
    path.includes('/__tests__/') ||
    path.includes('/e2e/') ||
    path.includes('/cypress/') ||
    /\.test\.[a-z0-9]+$/.test(path) ||
    /\.spec\.[a-z0-9]+$/.test(path)
  )
}

function isDocumentationFilePath(path: string) {
  return (
    path.includes('/docs/') ||
    path.endsWith('.md') ||
    path.endsWith('.mdx') ||
    path.includes('/wiki/')
  )
}

function isConfigOrInfraFilePath(path: string) {
  return (
    path.includes('.github/workflows/') ||
    path.includes('/infra/') ||
    path.includes('/terraform/') ||
    path.includes('/k8s/') ||
    path.endsWith('dockerfile') ||
    path.endsWith('docker-compose.yml') ||
    path.endsWith('docker-compose.yaml') ||
    path.endsWith('eslint.config.js') ||
    path.endsWith('eslint.config.mjs')
  )
}

function normalizeContributorKey(value: string) {
  return value.trim().toLowerCase()
}

function getMetricLabel(key: keyof DevMetric) {
  const labels: Record<keyof DevMetric, string> = {
    readability: '가독성',
    efficiency: '효율성',
    security: '보안성',
    architecture: '구조 설계',
    consistency: '일관성',
    modernity: '현대성',
  }

  return labels[key]
}

function describeWeakestMetric(metrics: DevMetric) {
  const entries = Object.entries(metrics) as Array<[keyof DevMetric, number]>
  const [weakestKey] = entries.reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest))

  const copy: Record<keyof DevMetric, string> = {
    readability: '가독성과 문서화 신호를 가장 먼저 보완하는 것이 좋습니다.',
    efficiency: '실행 워크플로와 전달 속도 신호가 가장 약합니다.',
    security: '보안 및 릴리즈 가드레일이 가장 낮은 영역입니다.',
    architecture: '저장소 전반에 비해 아키텍처 증거가 부족합니다.',
    consistency: '도구와 워크플로 전반의 일관성이 가장 약합니다.',
    modernity: '스택은 안정적이지만 최신 도구 사용 신호는 더 강화할 수 있습니다.',
  }

  return copy[weakestKey]
}

function collectMissingTech(candidates: Array<[boolean, string]>) {
  return candidates
    .filter(([condition]) => condition)
    .map(([, value]) => value)
    .slice(0, 3)
}

function estimateDailyLines(repoSizeInKb: number, recentCommitCount: number, daysSinceLastPush: number) {
  return clamp(
    Math.round(repoSizeInKb * 0.18 + recentCommitCount * 28 + Math.max(0, 20 - daysSinceLastPush) * 6),
    40,
    1200,
  )
}

function calculateCleanCodeScore(metrics: DevMetric) {
  return Math.round(
    (metrics.readability +
      metrics.architecture +
      metrics.consistency +
      metrics.modernity +
      metrics.security +
      metrics.efficiency) /
      6,
  )
}

function activityBonus(daysSinceLastPush: number) {
  if (daysSinceLastPush <= 7) {
    return 12
  }
  if (daysSinceLastPush <= 30) {
    return 7
  }
  if (daysSinceLastPush <= 60) {
    return 3
  }

  return 0
}

function modernStackBonus(frameworks: string[]) {
  const modernStack = frameworks.some((framework) =>
    ['Next.js', 'React', 'TypeScript', 'NestJS', 'FastAPI', 'Go', 'Rust', 'Axum', 'Tokio'].includes(
      framework,
    ),
  )

  return modernStack ? 12 : 0
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function firstLine(message: string) {
  return message.split('\n')[0]?.trim() ?? message
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}


type TarballExtractionResult = {
  rootFileContents: Record<string, string>
  workflowSignals: WorkflowSignal[]
  codeSamples: RepositoryCodeSample[]
  rootContents: { name: string, type: 'dir' | 'file' }[]
  codebaseProfile: CodebaseProfile
}

async function downloadAndExtractTarball(repositoryPath: string, branch: string): Promise<TarballExtractionResult> {
  const response = await fetch(`${GITHUB_API_BASE}${repositoryPath}/tarball/${encodeURIComponent(branch)}`, {
    headers: buildGitHubHeaders(),
    cache: 'no-store'
  })
  
  if (!response.ok) {
    throw await createGitHubError(response)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  
  return new Promise((resolve, reject) => {
    const extract = tar.extract()
    const result: TarballExtractionResult = {
      rootFileContents: {},
      workflowSignals: [],
      codeSamples: [],
      rootContents: [],
      codebaseProfile: {
        totalCodeFiles: 0,
        totalCodeLines: 0,
        sampledCodeFiles: 0,
        sampledCodeChars: 0,
        sampleCoveragePercent: 0,
        topDirectories: [],
        languages: [],
      },
    }
    const rootItems = new Set<string>()
    const directoryHistogram = new Map<string, number>()
    const languageHistogram = new Map<string, { files: number; lines: number }>()
    const sampledDirectoryCounts = new Map<string, number>()
    const sampledLanguageCounts = new Map<string, number>()
    let sampledCodeChars = 0
    
    extract.on('entry', (header, stream, next) => {
      const parts = header.name.split('/')
      parts.shift() // remove the top level hash dir from github tarball
      const path = parts.join('/')
      
      if (!path) {
        stream.resume()
        return next()
      }
      
      const isRootItem = parts.length === 1 || (parts.length === 2 && parts[1] === '')
      if (isRootItem && parts[0]) {
        const rootName = parts[0]
        if (!rootItems.has(rootName)) {
           rootItems.add(rootName)
           result.rootContents.push({ name: rootName, type: header.type === 'directory' ? 'dir' : 'file' })
        }
      }
      
      if (header.type !== 'file') {
        stream.resume()
        return next()
      }
      
      const isRootFile = parts.length === 1 && ROOT_FILES_TO_FETCH.has(path.toLowerCase())
      const isWorkflow = path.startsWith('.github/workflows/') && WORKFLOW_FILE_PATTERN.test(path)
      const isCode = isCodeSampleCandidate(path)
      
      if (!isRootFile && !isWorkflow && !isCode) {
        stream.resume()
        return next()
      }
      
      const chunks: Buffer[] = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        
        if (isRootFile) {
          result.rootFileContents[path] = text
        }
        
        if (isWorkflow) {
          const signal = buildWorkflowSignal(path, text)
          if (signal) result.workflowSignals.push(signal)
        }
        
        if (isCode) {
          const lineCount = countCodeLines(text)
          const directoryBucket = getDirectoryBucket(path)
          const language = detectCodeLanguage(path)

          result.codebaseProfile.totalCodeFiles += 1
          result.codebaseProfile.totalCodeLines += lineCount
          incrementNumberMap(directoryHistogram, directoryBucket, 1)
          incrementLanguageHistogram(languageHistogram, language, lineCount)

          const sample = buildRepositoryCodeSample(path, text)
          const directorySampleCount = sampledDirectoryCounts.get(directoryBucket) ?? 0
          const languageSampleCount = sampledLanguageCounts.get(language) ?? 0
          const canSampleByQuota =
            directorySampleCount < MAX_SAMPLES_PER_DIRECTORY &&
            languageSampleCount < MAX_SAMPLES_PER_LANGUAGE
          const canSampleByTotal =
            result.codeSamples.length < MAX_CODE_SAMPLES &&
            sample !== null &&
            sampledCodeChars + sample.snippet.length <= MAX_TOTAL_SAMPLE_CHARS

          if (sample && canSampleByQuota && canSampleByTotal) {
            result.codeSamples.push(sample)
            sampledCodeChars += sample.snippet.length
            sampledDirectoryCounts.set(directoryBucket, directorySampleCount + 1)
            sampledLanguageCounts.set(language, languageSampleCount + 1)
          }
        }
        
        next()
      })
    })
    
    extract.on('finish', () => {
      result.codebaseProfile.sampledCodeFiles = result.codeSamples.length
      result.codebaseProfile.sampledCodeChars = sampledCodeChars
      result.codebaseProfile.sampleCoveragePercent =
        result.codebaseProfile.totalCodeFiles > 0
          ? clamp(Math.round((result.codeSamples.length / result.codebaseProfile.totalCodeFiles) * 100), 0, 100)
          : 0
      result.codebaseProfile.topDirectories = Array.from(directoryHistogram.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([path, files]) => ({ path, files }))
      result.codebaseProfile.languages = Array.from(languageHistogram.entries())
        .sort((left, right) => right[1].files - left[1].files)
        .slice(0, 6)
        .map(([language, stats]) => ({
          language,
          files: stats.files,
          lines: stats.lines,
        }))

      resolve(result)
    })
    extract.on('error', reject)
    
    const gunzip = zlib.createGunzip()
    gunzip.on('error', reject)
    
    gunzip.pipe(extract)
    gunzip.end(Buffer.from(arrayBuffer))
  })
}
