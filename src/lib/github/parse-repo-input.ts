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
    throw new Error('Enter a GitHub repository URL first.')
  }

  if (trimmed.startsWith('@') && !trimmed.includes('/')) {
    throw new Error('Enter a repository path like owner/repo, not just a user handle.')
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
    throw new Error('Use a GitHub repository URL or an owner/repo path.')
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Only github.com repositories can be analyzed right now.')
  }

  return parseRepositoryPath(url.pathname)
}

function parseRepositoryPath(pathValue: string): ParsedGitHubRepositoryInput {
  const sanitized = pathValue.trim().replace(/^\//, '').replace(/\.git$/, '')
  const [ownerSegment, repoSegment] = sanitized.split('/').filter(Boolean)
  const owner = decodeURIComponent(ownerSegment ?? '')
  const repo = decodeURIComponent(repoSegment ?? '')

  if (!owner || !repo) {
    throw new Error('Repository path not found. Example: vercel/next.js')
  }

  const normalizedFullName = `${owner}/${repo}`

  return {
    owner,
    repo,
    normalizedFullName,
    htmlUrl: `https://github.com/${owner}/${repo}`,
  }
}
