import { NextRequest, NextResponse } from 'next/server'

import {
  GITHUB_OAUTH_SESSION_COOKIE_NAME,
  GITHUB_OAUTH_STATE_COOKIE_NAME,
} from '@/lib/github/oauth-session'

export async function GET(request: NextRequest) {
  return buildLogoutResponse(request)
}

export async function POST(request: NextRequest) {
  return buildLogoutResponse(request)
}

function buildLogoutResponse(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/dashboard'
  redirectUrl.search = ''
  redirectUrl.searchParams.set('github', 'disconnected')

  const response = NextResponse.redirect(redirectUrl)
  const commonCookieOptions = {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecureCookie(),
  }

  response.cookies.set({
    name: GITHUB_OAUTH_SESSION_COOKIE_NAME,
    value: '',
    ...commonCookieOptions,
  })
  response.cookies.set({
    name: GITHUB_OAUTH_STATE_COOKIE_NAME,
    value: '',
    ...commonCookieOptions,
  })

  return response
}

function isSecureCookie() {
  return process.env.NODE_ENV === 'production'
}

