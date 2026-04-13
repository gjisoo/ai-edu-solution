import { NextRequest, NextResponse } from 'next/server'

import {
  createGitHubSessionCookieValue,
  GITHUB_OAUTH_SESSION_COOKIE_NAME,
  GITHUB_OAUTH_SESSION_MAX_AGE_SECONDS,
  GITHUB_OAUTH_STATE_COOKIE_NAME,
} from '@/lib/github/oauth-session'

type GitHubTokenResponse = {
  access_token?: string
  token_type?: string
  scope?: string
  error?: string
  error_description?: string
}

const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const oauthErrorDescription = url.searchParams.get('error_description')
  const stateCookie = request.cookies.get(GITHUB_OAUTH_STATE_COOKIE_NAME)?.value ?? null

  if (oauthError) {
    return buildRedirectResponse(request, 'oauth-error')
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return buildRedirectResponse(request, 'oauth-error')
  }

  const clientId = process.env.GITHUB_CLIENT_ID?.trim()
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    return buildRedirectResponse(request, 'oauth-error')
  }

  try {
    const tokenResponse = await fetch(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'dev-radar-mvp',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        state,
        redirect_uri: getGitHubOAuthRedirectUri(request.url),
      }),
      cache: 'no-store',
    })

    const payload = (await tokenResponse.json()) as GitHubTokenResponse
    if (!tokenResponse.ok || payload.error || !payload.access_token) {
      console.error('[github-oauth] token exchange failed', {
        status: tokenResponse.status,
        error: payload.error ?? oauthError,
        description: payload.error_description ?? oauthErrorDescription ?? null,
      })
      return buildRedirectResponse(request, 'oauth-error')
    }

    const sessionValue = createGitHubSessionCookieValue(payload.access_token)
    if (!sessionValue) {
      return buildRedirectResponse(request, 'oauth-error')
    }

    const response = buildRedirectResponse(request, 'connected')
    response.cookies.set({
      name: GITHUB_OAUTH_SESSION_COOKIE_NAME,
      value: sessionValue,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureCookie(),
      path: '/',
      maxAge: GITHUB_OAUTH_SESSION_MAX_AGE_SECONDS,
    })
    clearOAuthStateCookie(response)

    return response
  } catch (error) {
    console.error('[github-oauth] callback failed', error)
    return buildRedirectResponse(request, 'oauth-error')
  }
}

function buildRedirectResponse(request: NextRequest, status: 'connected' | 'oauth-error') {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/dashboard'
  redirectUrl.search = ''
  redirectUrl.searchParams.set('github', status)

  const response = NextResponse.redirect(redirectUrl)
  clearOAuthStateCookie(response)
  return response
}

function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set({
    name: GITHUB_OAUTH_STATE_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
  })
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

