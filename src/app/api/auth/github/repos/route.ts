import { NextRequest, NextResponse } from 'next/server'

import {
  GITHUB_OAUTH_SESSION_COOKIE_NAME,
  readGitHubSessionCookieValue,
} from '@/lib/github/oauth-session'

type GitHubRepositoryResponse = {
  id: number
  full_name: string
  private: boolean
  html_url: string
  description: string | null
  updated_at: string
  pushed_at: string
}

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(GITHUB_OAUTH_SESSION_COOKIE_NAME)?.value ?? null
  const session = readGitHubSessionCookieValue(raw)

  if (!session) {
    const response = NextResponse.json(
      { error: 'GitHub 로그인 세션이 없습니다.' },
      { status: 401 },
    )

    if (raw) {
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

  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
    : DEFAULT_LIMIT

  const response = await fetch(
    `${GITHUB_API_BASE}/user/repos?sort=updated&direction=desc&per_page=${limit}&affiliation=owner,collaborator,organization_member`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'dev-radar-mvp',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: '내 GitHub 저장소 목록을 불러오지 못했습니다.' },
      { status: response.status },
    )
  }

  const payload = (await response.json()) as GitHubRepositoryResponse[]
  const repositories = payload.map((item) => ({
    id: item.id,
    fullName: item.full_name,
    private: item.private,
    url: item.html_url,
    description: item.description,
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
  }))

  return NextResponse.json({
    repositories,
  })
}

