import { NextRequest, NextResponse } from 'next/server'

import {
  GITHUB_OAUTH_SESSION_COOKIE_NAME,
  readGitHubSessionCookieValue,
} from '@/lib/github/oauth-session'

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(GITHUB_OAUTH_SESSION_COOKIE_NAME)?.value ?? null
  const session = readGitHubSessionCookieValue(raw)

  const response = NextResponse.json({
    authenticated: Boolean(session),
    expiresAt: session?.expiresAt ?? null,
  })

  if (!session && raw) {
    response.cookies.set({
      name: GITHUB_OAUTH_SESSION_COOKIE_NAME,
      value: '',
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}

