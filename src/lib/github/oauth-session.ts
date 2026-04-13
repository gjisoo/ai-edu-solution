import 'server-only'

import crypto from 'crypto'

export const GITHUB_OAUTH_STATE_COOKIE_NAME = 'github_oauth_state'
export const GITHUB_OAUTH_SESSION_COOKIE_NAME = 'github_oauth_session'
export const GITHUB_OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10
export const GITHUB_OAUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

type GitHubSessionPayload = {
  accessToken: string
  expiresAt: number
}

export function createGitHubOAuthState() {
  return crypto.randomBytes(24).toString('hex')
}

export function createGitHubSessionCookieValue(accessToken: string, now = Date.now()) {
  const key = deriveSessionKey()

  if (!key || !accessToken.trim()) {
    return null
  }

  const payload: GitHubSessionPayload = {
    accessToken: accessToken.trim(),
    expiresAt: now + GITHUB_OAUTH_SESSION_MAX_AGE_SECONDS * 1000,
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function readGitHubSessionCookieValue(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const key = deriveSessionKey()

  if (!key) {
    return null
  }

  const parts = value.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const [ivPart, tagPart, dataPart] = parts
    const iv = Buffer.from(ivPart, 'base64url')
    const tag = Buffer.from(tagPart, 'base64url')
    const data = Buffer.from(dataPart, 'base64url')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    const decoded = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    const payload = JSON.parse(decoded) as Partial<GitHubSessionPayload>

    if (
      typeof payload.accessToken !== 'string' ||
      !payload.accessToken.trim() ||
      typeof payload.expiresAt !== 'number' ||
      !Number.isFinite(payload.expiresAt)
    ) {
      return null
    }

    if (payload.expiresAt <= Date.now()) {
      return null
    }

    return {
      accessToken: payload.accessToken,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

function deriveSessionKey() {
  const secret =
    process.env.GITHUB_SESSION_SECRET?.trim() ||
    process.env.GITHUB_CLIENT_SECRET?.trim() ||
    ''

  if (!secret) {
    return null
  }

  return crypto.createHash('sha256').update(secret).digest()
}

