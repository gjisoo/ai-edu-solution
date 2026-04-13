import { NextResponse } from 'next/server'

import {
  createGitHubOAuthState,
  GITHUB_OAUTH_STATE_COOKIE_NAME,
  GITHUB_OAUTH_STATE_MAX_AGE_SECONDS,
} from '@/lib/github/oauth-session'

const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_OAUTH_SCOPE = 'repo read:user'

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim()

  if (!clientId) {
    return NextResponse.json(
      { error: 'GITHUB_CLIENT_ID 설정이 필요합니다.' },
      { status: 500 },
    )
  }

  const state = createGitHubOAuthState()
  const authorizeUrl = new URL(GITHUB_OAUTH_AUTHORIZE_URL)
  const redirectUri = getGitHubOAuthRedirectUri(request.url)

  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('allow_signup', 'false')

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set({
    name: GITHUB_OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
    path: '/',
    maxAge: GITHUB_OAUTH_STATE_MAX_AGE_SECONDS,
  })

  return response
}

function getGitHubOAuthRedirectUri(requestUrl: string) {
  const configured = process.env.GITHUB_OAUTH_REDIRECT_URI?.trim()
  if (configured) {
    return configured
  }

  const origin = new URL(requestUrl).origin
  return `${origin}/api/auth/github/callback`
}

function isSecureCookie() {
  return process.env.NODE_ENV === 'production'
}

