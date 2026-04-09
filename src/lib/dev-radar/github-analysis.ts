import 'server-only'

import { generateRepositoryAIEnhancement } from '@/lib/dev-radar/gemini-analysis'
import { parseGitHubRepositoryInput } from '@/lib/github/parse-repo-input'
import type {
  ActivityEvent,
  ConceptGap,
  DashboardAnalysis,
  DevMetric,
  MarketFit,
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

type GitHubContentItem = {
  name: string
  path: string
  type: 'file' | 'dir'
}

type GitHubFileResponse = {
  type: 'file'
  content?: string
  encoding?: string
}

type PackageManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
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

  const [languages, commits, rootContentsRaw] = await Promise.all([
    fetchGitHubJson<Record<string, number>>(`${repositoryPath}/languages`),
    fetchGitHubJson<GitHubCommitResponse[]>(
      `${repositoryPath}/commits?per_page=${MAX_COMMITS}&sha=${encodeURIComponent(repository.default_branch)}`,
      { fallbackValue: [] },
    ),
    fetchGitHubJson<GitHubContentItem[] | GitHubContentItem>(`${repositoryPath}/contents`, {
      fallbackValue: [],
    }),
  ])

  const rootContents = Array.isArray(rootContentsRaw) ? rootContentsRaw : []
  const rootFileContents = await loadRootFileContents(repositoryPath, rootContents)
  const packageManifest = parsePackageManifest(rootFileContents['package.json'] ?? null)
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
  })
  const metrics = buildMetrics(repositorySignals)
  const marketFits = buildMarketFits(repositorySignals)
  const reviewSuggestions = buildReviewSuggestions(repositorySignals)
  const conceptGaps = buildConceptGaps(repositorySignals)
  const activity = buildActivity(repositorySignals)
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
    engine: {
      mode: 'heuristic',
      label: 'GitHub API + 규칙 기반 분석',
      model: null,
    },
    aiInsight: null,
    collectedAt: formatDateTime(new Date()),
    dailyLines: estimateDailyLines(repository.size, commits.length, repositorySignals.daysSinceLastPush),
    cleanCodeScore: Math.round(
      (metrics.readability +
        metrics.architecture +
        metrics.consistency +
        metrics.modernity +
        metrics.security +
        metrics.efficiency) /
        6,
    ),
    focusArea: describeWeakestMetric(metrics),
    metrics,
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
  })

  if (!aiEnhancement) {
    return heuristicAnalysis
  }

  return {
    ...heuristicAnalysis,
    engine: {
      mode: 'hybrid-ai',
      label: 'GitHub API + Gemini 분석',
      model: aiEnhancement.model,
    },
    aiInsight: aiEnhancement.aiInsight,
    focusArea: aiEnhancement.focusArea,
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

async function loadRootFileContents(
  repositoryPath: string,
  rootContents: GitHubContentItem[],
): Promise<Record<string, string>> {
  const targetFiles = rootContents
    .filter((item) => item.type === 'file')
    .filter((item) => ROOT_FILES_TO_FETCH.has(item.name.toLowerCase()))
    .map((item) => item.path)

  const fileEntries = await Promise.all(
    targetFiles.map(async (filePath) => [filePath, await fetchRepositoryFileText(repositoryPath, filePath)] as const),
  )

  return Object.fromEntries(fileEntries.filter((entry): entry is [string, string] => Boolean(entry[1])))
}

async function fetchRepositoryFileText(
  repositoryPath: string,
  filePath: string,
): Promise<string | null> {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const response = await fetchGitHubJson<GitHubFileResponse | null>(
    `${repositoryPath}/contents/${encodedPath}`,
    {
    fallbackValue: null,
    },
  )

  if (!response || response.type !== 'file' || !response.content || response.encoding !== 'base64') {
    return null
  }

  return Buffer.from(response.content.replace(/\n/g, ''), 'base64').toString('utf8')
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
}: {
  repository: GitHubRepositoryResponse
  languages: Record<string, number>
  commits: GitHubCommitResponse[]
  rootContents: GitHubContentItem[]
  frameworks: string[]
  packageManifest: PackageManifest | null
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
  const hasReadme = Array.from(rootNames).some((name) => name.startsWith('readme'))
  const hasDocsDir = rootNames.has('docs')
  const hasSourceDir = rootNames.has('src') || rootNames.has('app') || rootNames.has('packages')
  const hasTests =
    rootNames.has('test') ||
    rootNames.has('tests') ||
    rootNames.has('__tests__') ||
    rootNames.has('cypress') ||
    rootNames.has('e2e') ||
    frameworks.some((framework) =>
      ['Jest', 'Vitest', 'Pytest', 'Playwright', 'Cypress'].includes(framework),
    )
  const hasCi =
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
    hasReadme,
    hasDocsDir,
    hasSourceDir,
    hasTests,
    hasCi,
    hasDocker,
    hasInfra,
    hasLint,
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

function buildMetrics(signals: ReturnType<typeof buildRepositorySignals>): DevMetric {
  return {
    readability: clamp(
      40 +
        (signals.hasReadme ? 15 : 0) +
        (signals.repository.description ? 8 : 0) +
        Math.min(signals.repository.topics?.length ?? 0, 4) * 3 +
        (signals.hasDocsDir ? 8 : 0) +
        Math.round(signals.meaningfulCommitRatio * 17),
      0,
      100,
    ),
    efficiency: clamp(
      38 +
        Math.min(signals.commits.length, 12) * 3 +
        (signals.hasCi ? 12 : 0) +
        (signals.hasTests ? 10 : 0) +
        (signals.hasLint ? 8 : 0) +
        activityBonus(signals.daysSinceLastPush),
      0,
      100,
    ),
    security: clamp(
      35 +
        (signals.hasCi ? 14 : 0) +
        (signals.hasLockfile ? 10 : 0) +
        (signals.hasTests ? 8 : 0) +
        (signals.hasSecurityFile ? 12 : 0) +
        (signals.hasDocker ? 6 : 0),
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
        (signals.repository.size > 900 ? 8 : 0),
      0,
      100,
    ),
    consistency: clamp(
      42 +
        (signals.hasLint ? 12 : 0) +
        (signals.hasTests ? 10 : 0) +
        (signals.hasCi ? 10 : 0) +
        Math.round(signals.meaningfulCommitRatio * 14) +
        (signals.hasTypedLanguage ? 8 : 0),
      0,
      100,
    ),
    modernity: clamp(
      36 +
        (signals.hasTypedLanguage ? 14 : 0) +
        activityBonus(signals.daysSinceLastPush) +
        modernStackBonus(signals.frameworks) +
        (signals.hasCi ? 8 : 0) +
        (signals.hasDocker ? 8 : 0),
      0,
      100,
    ),
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
