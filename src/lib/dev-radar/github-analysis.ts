import 'server-only'

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

  return {
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
      'Repository not found. Check that it is public, or configure GITHUB_TOKEN for private repositories.',
      404,
    )
  }

  if (response.status === 403 && rateLimitRemaining === '0') {
    return new GitHubAnalysisError(
      'GitHub API rate limit reached. Try again later or configure GITHUB_TOKEN.',
      429,
    )
  }

  if (response.status === 403) {
    return new GitHubAnalysisError(
      'GitHub API access was denied. Check token permissions and repository visibility.',
      403,
    )
  }

  return new GitHubAnalysisError(
    body ?? 'Failed to load data from the GitHub API.',
    response.status,
  )
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
    [!signals.hasTests, 'component or integration tests'],
    [!signals.hasCi, 'CI checks'],
    [!signals.hasTypedLanguage, 'strong type safety'],
    [!signals.hasReadme, 'UI usage docs'],
  ])
  const missingBackend = collectMissingTech([
    [!signals.hasDocker, 'container baseline'],
    [!signals.hasTests, 'API or integration tests'],
    [!signals.hasCi, 'release validation'],
    [!signals.hasLockfile, 'dependency pinning'],
  ])
  const missingPlatform = collectMissingTech([
    [!signals.hasDocker, 'containerization'],
    [!signals.hasInfra, 'IaC or deployment config'],
    [!signals.hasCi, 'automation pipeline'],
    [signals.uniqueAuthors <= 1, 'ops handoff signal'],
  ])

  return [
    {
      targetJob: 'Frontend / Fullstack Engineer',
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
      targetJob: 'Backend Engineer',
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
      targetJob: 'Platform / DevOps Engineer',
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
      title: 'Add an automated test baseline',
      impact: 'Quality + regression safety',
      description:
        'No clear test footprint was detected from the repository root or package manifests. Adding Jest, Vitest, Pytest, or Playwright coverage would make this signal much stronger.',
    })
  }

  if (!signals.hasCi) {
    suggestions.push({
      id: 'review-ci',
      title: 'Wire the repo into CI checks',
      impact: 'Delivery speed + confidence',
      description:
        'A workflow directory or CI config was not found. Even a lightweight pipeline for lint, typecheck, and tests would improve release trust immediately.',
    })
  }

  if (!signals.hasReadme) {
    suggestions.push({
      id: 'review-docs',
      title: 'Strengthen onboarding documentation',
      impact: 'Collaboration + handoff',
      description:
        'A README or docs entry point was not detected at the repository root. Clear setup, architecture, and run instructions would improve readability and hiring signal.',
    })
  }

  if (!signals.hasDocker && signals.hasBackendStack) {
    suggestions.push({
      id: 'review-docker',
      title: 'Add a deployment-ready runtime baseline',
      impact: 'Portability + ops readiness',
      description:
        'The repository looks application-oriented, but no Docker or compose config was found. Adding one would make local parity and deployment rehearsal much easier.',
    })
  }

  if (signals.meaningfulCommitRatio < 0.6) {
    suggestions.push({
      id: 'review-commit-hygiene',
      title: 'Tighten commit message hygiene',
      impact: 'Reviewability + narrative',
      description:
        'Recent commit messages skew short or generic. More descriptive commit titles would make code reviews and portfolio storytelling much stronger.',
    })
  }

  const fallbackSuggestions: ReviewSuggestion[] = [
    {
      id: 'review-stack-coverage',
      title: 'Broaden stack evidence around the current core',
      impact: 'Market fit + credibility',
      description:
        'The repository already shows a clear technical direction. Adding one more strong signal such as CI, tests, or deployment config would raise the overall profile fast.',
    },
    {
      id: 'review-release-signal',
      title: 'Make release expectations explicit',
      impact: 'Delivery + collaboration',
      description:
        'A short contribution guide, release note pattern, or maintenance checklist would make ownership expectations much easier to understand.',
    },
    {
      id: 'review-portfolio-story',
      title: 'Sharpen the portfolio story around the repo',
      impact: 'Hiring signal + clarity',
      description:
        'Adding a concise architecture note or roadmap section helps reviewers understand why this repository matters and what the next step should be.',
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
      title: 'Test automation coverage',
      category: 'quality signal',
      severity: 'high',
      timestamp: formatDateTime(new Date()),
      summary:
        'The scan did not find a clear automated test setup. This makes regression risk hard to estimate and weakens the engineering quality signal for reviewers.',
      recommendation: 'Add a small but visible unit or integration test suite and run it in CI.',
    })
  }

  if (!signals.hasCi) {
    gaps.push({
      id: 'gap-ci',
      title: 'Delivery pipeline visibility',
      category: 'release workflow',
      severity: 'high',
      timestamp: formatDateTime(new Date(signals.repository.updated_at)),
      summary:
        'No workflow or CI configuration was detected from the root structure. That leaves linting, test execution, and release validation largely implicit.',
      recommendation: 'Create a GitHub Actions workflow for lint, build, and test validation.',
    })
  }

  if (!signals.hasReadme) {
    gaps.push({
      id: 'gap-docs',
      title: 'Repository onboarding clarity',
      category: 'documentation',
      severity: 'medium',
      timestamp: formatDateTime(new Date(signals.repository.created_at)),
      summary:
        'Without a README, setup intent and decision context are hard to reconstruct from the repository alone. This directly lowers readability and collaboration confidence.',
      recommendation: 'Add a concise README covering purpose, stack, local setup, and key tradeoffs.',
    })
  }

  if (!signals.hasDocker && signals.hasBackendStack) {
    gaps.push({
      id: 'gap-runtime',
      title: 'Deployment portability',
      category: 'platform readiness',
      severity: 'medium',
      timestamp: formatDateTime(new Date(signals.repository.pushed_at)),
      summary:
        'The repository shows application logic, but no clear runtime packaging or deployment baseline. That leaves production-readiness harder to judge.',
      recommendation: 'Add a Dockerfile or runtime manifest that documents how the app is executed.',
    })
  }

  if (signals.daysSinceLastPush > 45) {
    gaps.push({
      id: 'gap-cadence',
      title: 'Freshness of repository activity',
      category: 'maintenance cadence',
      severity: 'low',
      timestamp: formatDateTime(new Date(signals.repository.pushed_at)),
      summary:
        'The latest push is relatively old, so current ownership and iteration speed are harder to infer from the public history.',
      recommendation: 'Refresh the repo with a small maintenance pass, changelog note, or cleanup commit.',
    })
  }

  const fallbackGaps: ConceptGap[] = [
    {
      id: 'gap-typed-signal',
      title: 'Typed guardrail coverage',
      category: 'maintainability',
      severity: signals.hasTypedLanguage ? 'low' : 'medium',
      timestamp: formatDateTime(new Date()),
      summary:
        'Type safety and tooling consistency are part of the portfolio signal. Even a small amount of explicit schema or type coverage makes architecture intent easier to read.',
      recommendation: 'Add stronger schema or type validation around the most important paths.',
    },
    {
      id: 'gap-collaboration-signal',
      title: 'Collaboration surface area',
      category: 'team workflow',
      severity: 'low',
      timestamp: formatDateTime(new Date()),
      summary:
        'The repository can still expose more evidence of handoff quality, review expectations, and contributor onboarding from the root project surface.',
      recommendation: 'Add a contribution note, ownership guide, or lightweight project board reference.',
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
      : 'language data unavailable'
  const stackSummary =
    signals.stackLabels.length > 0 ? signals.stackLabels.join(', ') : 'framework signal still light'
  const healthSummary = [
    signals.hasTests ? 'tests detected' : 'tests missing',
    signals.hasCi ? 'CI detected' : 'CI missing',
    signals.hasDocker ? 'runtime packaging detected' : 'runtime packaging missing',
  ].join(' | ')

  return [
    {
      id: 'activity-scan',
      time: formatClock(new Date()),
      label: 'Live repository scan completed',
      detail: `${signals.repository.full_name} was scanned successfully. Primary language mix: ${primaryLanguages}.`,
    },
    {
      id: 'activity-commit',
      time: formatClock(new Date(signals.latestCommit?.commit.author?.date ?? signals.repository.pushed_at)),
      label: 'Latest commit on the default branch',
      detail: signals.latestCommit
        ? `${signals.latestCommit.sha.slice(0, 7)} | ${firstLine(signals.latestCommit.commit.message)}`
        : 'No recent commits were returned for the default branch.',
    },
    {
      id: 'activity-stack',
      time: formatClock(new Date(signals.repository.updated_at)),
      label: 'Stack and workflow signal',
      detail: `${stackSummary}. ${healthSummary}.`,
    },
  ]
}

function describeWeakestMetric(metrics: DevMetric) {
  const entries = Object.entries(metrics) as Array<[keyof DevMetric, number]>
  const [weakestKey] = entries.reduce((lowest, current) => (current[1] < lowest[1] ? current : lowest))

  const copy: Record<keyof DevMetric, string> = {
    readability: 'Readability and documentation signal need the most attention.',
    efficiency: 'Execution workflow and delivery speed are the weakest signal right now.',
    security: 'Security and release guardrails are the lowest-scoring area.',
    architecture: 'Architecture evidence is thinner than the rest of the repo signal.',
    consistency: 'Consistency across tooling and workflow is the weakest area.',
    modernity: 'The stack looks stable, but the modern tooling signal can be stronger.',
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
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function firstLine(message: string) {
  return message.split('\n')[0]?.trim() ?? message
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
