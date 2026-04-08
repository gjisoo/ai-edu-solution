import { NextResponse } from 'next/server'

import { analyzeGitHubRepository } from '@/lib/dev-radar/github-analysis'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { repo?: string }

    if (!payload.repo || typeof payload.repo !== 'string') {
      return NextResponse.json(
        { error: '분석할 GitHub 저장소 URL 또는 owner/repo 경로를 보내주세요.' },
        { status: 400 },
      )
    }

    const analysis = await analyzeGitHubRepository(payload.repo)

    return NextResponse.json(analysis)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '저장소 분석 중 알 수 없는 오류가 발생했습니다.'
    const status =
      typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 500

    return NextResponse.json({ error: message }, { status })
  }
}
