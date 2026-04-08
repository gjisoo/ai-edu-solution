export interface ParsedGitHubRepositoryInput {
  owner: string
  repo: string
  normalizedFullName: string
  htmlUrl: string
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const SSH_PREFIX = 'git@github.com:'

export function parseGitHubRepositoryInput(input: string): ParsedGitHubRepositoryInput {
  const trimmed = input.trim()

  if (!trimmed) {
    throw new Error('GitHub 저장소 URL을 먼저 입력해주세요.')
  }

  if (trimmed.startsWith('@') && !trimmed.includes('/')) {
    throw new Error('사용자 핸들만이 아니라 owner/repo 형식의 저장소 경로를 입력해주세요.')
  }

  if (trimmed.startsWith(SSH_PREFIX)) {
    return parseRepositoryPath(trimmed.slice(SSH_PREFIX.length))
  }

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(trimmed)) {
    return parseRepositoryPath(trimmed)
  }

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('GitHub 저장소 URL 또는 owner/repo 형식으로 입력해주세요.')
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('현재는 github.com 저장소만 분석할 수 있습니다.')
  }

  return parseRepositoryPath(url.pathname)
}

function parseRepositoryPath(pathValue: string): ParsedGitHubRepositoryInput {
  const sanitized = pathValue.trim().replace(/^\//, '').replace(/\.git$/, '')
  const [ownerSegment, repoSegment] = sanitized.split('/').filter(Boolean)
  const owner = decodeURIComponent(ownerSegment ?? '')
  const repo = decodeURIComponent(repoSegment ?? '')

  if (!owner || !repo) {
    throw new Error('저장소 경로를 찾지 못했습니다. 예: vercel/next.js')
  }

  const normalizedFullName = `${owner}/${repo}`

  return {
    owner,
    repo,
    normalizedFullName,
    htmlUrl: `https://github.com/${owner}/${repo}`,
  }
}
