import { NextResponse } from 'next/server'

import { analyzeGitHubRepository } from '@/lib/dev-radar/github-analysis'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { repo?: string }

    if (!payload.repo || typeof payload.repo !== 'string') {
      return NextResponse.json(
        { error: 'Send a GitHub repository URL or owner/repo path to analyze.' },
        { status: 400 },
      )
    }

    const analysis = await analyzeGitHubRepository(payload.repo)

    return NextResponse.json(analysis)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown repository analysis error occurred.'
    const status =
      typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 500

    return NextResponse.json({ error: message }, { status })
  }
}
