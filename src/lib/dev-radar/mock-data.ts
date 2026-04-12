import type {
  ActivityEvent,
  CodebaseProfile,
  ConceptGap,
  ContributorInsight,
  DashboardAnalysis,
  DevMetric,
  MarketFit,
  RepositorySummary,
  ReviewSuggestion,
} from '@/types/dev-radar'

function hashString(value: string) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createRepository(fullName: string): RepositorySummary {
  const [owner, name] = fullName.split('/')

  return {
    owner,
    name,
    fullName,
    url: `https://github.com/${fullName}`,
    description: '실시간 GitHub 분석이 연결되기 전 데모용으로 사용하는 저장소 요약입니다.',
    visibility: 'public',
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    mainLanguages: [
      { name: 'TypeScript', share: 62 },
      { name: 'CSS', share: 18 },
      { name: 'MDX', share: 12 },
    ],
    stars: 128,
    forks: 24,
    openIssues: 7,
    lastPushAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    topics: ['dashboard', 'analytics', 'nextjs'],
  }
}

function createMetrics(seed: number): DevMetric {
  return {
    readability: clamp(72 + (seed % 17), 0, 100),
    efficiency: clamp(64 + (seed % 21), 0, 100),
    security: clamp(58 + (seed % 19), 0, 100),
    architecture: clamp(66 + (seed % 18), 0, 100),
    consistency: clamp(74 + (seed % 16), 0, 100),
    modernity: clamp(61 + (seed % 23), 0, 100),
  }
}

function createMarketFits(seed: number): MarketFit[] {
  return [
    {
      targetJob: '백엔드 엔지니어',
      similarityScore: clamp(70 + (seed % 19), 0, 100),
      missingTech: ['CI 파이프라인', 'Docker', '관측성'],
    },
    {
      targetJob: '풀스택 엔지니어',
      similarityScore: clamp(62 + (seed % 17), 0, 100),
      missingTech: ['설계 문서', 'E2E 테스트', '접근성'],
    },
    {
      targetJob: '플랫폼 엔지니어',
      similarityScore: clamp(48 + (seed % 15), 0, 100),
      missingTech: ['CI/CD', '관측성', 'Kubernetes'],
    },
  ]
}

function createReviewSuggestions(seed: number): ReviewSuggestion[] {
  return [
    {
      id: `review-${seed}-1`,
      title: '핵심 로직과 통합 코드를 분리하기',
      impact: '가독성 + 아키텍처',
      description:
        '도메인 로직을 네트워크 및 파일 접근 코드와 분리하면 테스트가 쉬워지고 아키텍처 명확성도 높아집니다.',
    },
    {
      id: `review-${seed}-2`,
      title: '오류 처리 경로 강화하기',
      impact: '보안 + 안정성',
      description:
        '비동기 경계에서 일관된 실패 방식을 드러내면 API 핸들러와 백그라운드 작업의 동작을 훨씬 이해하기 쉬워집니다.',
    },
    {
      id: `review-${seed}-3`,
      title: '커밋 범위를 더 작게 유지하기',
      impact: '리뷰 용이성 + 일관성',
      description:
        '작은 커밋은 의도를 추적하기 쉽고, 나중에 합류한 협업자도 더 빠르게 리뷰할 수 있게 해줍니다.',
    },
  ]
}

function createConceptGaps(seed: number): ConceptGap[] {
  return [
    {
      id: `gap-${seed}-1`,
      title: '비동기 오류 전파',
      category: '빌드 오류',
      severity: 'high',
      timestamp: '4월 7일 11:14',
      summary:
        'Promise 체인과 async/await 흐름이 섞여 있으면 실패가 숨겨지고, 운영 버그를 특정 경계로 추적하기 어려워질 수 있습니다.',
      recommendation: 'Promise 처리 전략을 점검하고 비동기 경계의 오류 래핑 방식을 표준화하세요.',
    },
    {
      id: `gap-${seed}-2`,
      title: '자료구조 선택',
      category: '알고리즘 패턴',
      severity: 'medium',
      timestamp: '4월 6일 18:20',
      summary:
        '정답은 맞더라도 array, map, set 선택의 트레이드오프가 드러나지 않으면 엔지니어링 깊이가 충분히 보이지 않을 수 있습니다.',
      recommendation: '구현을 확정하기 전에 시간 복잡도와 컬렉션 특성을 비교하는 습관을 들이세요.',
    },
    {
      id: `gap-${seed}-3`,
      title: '테스트 더블 전략',
      category: '리뷰 피드백',
      severity: 'low',
      timestamp: '4월 3일 09:05',
      summary:
        '테스트는 통과하지만 mock, stub, spy의 경계가 아직 명확하지 않아 이후 기여자가 테스트를 깔끔하게 확장하기 어려울 수 있습니다.',
      recommendation: 'mock, stub, spy를 언제 쓰는지 문서화해 이후 테스트가 예측 가능하게 유지되도록 하세요.',
    },
  ]
}

function createActivity(seed: number, githubId: string): ActivityEvent[] {
  return [
    {
      id: `event-${seed}-1`,
      time: '09:42',
      label: '데모 스캔 완료',
      detail: `${githubId}용 시드 기반 데모 프로필이 정적 저장소 및 커밋 신호로 생성되었습니다.`,
    },
    {
      id: `event-${seed}-2`,
      time: '12:08',
      label: '커밋 위생 스냅샷',
      detail:
        '데모에서 리뷰와 협업 신호를 보여줄 수 있도록 최근 커밋 메시지를 적당히 설명적인 형태로 시드 처리했습니다.',
    },
    {
      id: `event-${seed}-3`,
      time: '14:31',
      label: '시장 적합도 프로필 갱신',
      detail:
        '같은 저장소가 다양한 채용 트랙에서 어떻게 읽히는지 보여주기 위해 역할 적합도 카드를 다시 계산했습니다.',
    },
  ]
}

function createCodebaseProfile(seed: number): CodebaseProfile {
  const totalCodeFiles = 90 + (seed % 220)
  const sampledCodeFiles = Math.max(24, Math.round(totalCodeFiles * 0.42))
  const totalCodeLines = totalCodeFiles * (80 + (seed % 40))
  const sampledCodeChars = sampledCodeFiles * (1100 + (seed % 320))

  return {
    totalCodeFiles,
    totalCodeLines,
    sampledCodeFiles,
    sampledCodeChars,
    sampleCoveragePercent: clamp(Math.round((sampledCodeFiles / totalCodeFiles) * 100), 1, 100),
    topDirectories: [
      { path: 'src', files: Math.round(totalCodeFiles * 0.54) },
      { path: 'components', files: Math.round(totalCodeFiles * 0.2) },
      { path: 'lib', files: Math.round(totalCodeFiles * 0.16) },
    ],
    languages: [
      { language: 'TypeScript', files: Math.round(totalCodeFiles * 0.68), lines: Math.round(totalCodeLines * 0.7) },
      { language: 'TSX', files: Math.round(totalCodeFiles * 0.2), lines: Math.round(totalCodeLines * 0.18) },
      { language: 'JavaScript', files: Math.round(totalCodeFiles * 0.12), lines: Math.round(totalCodeLines * 0.12) },
    ],
  }
}

function createContributorInsights(seed: number): ContributorInsight[] {
  const contributors = ['alpha-dev', 'beta-dev', 'gamma-dev']

  return contributors.map((name, index) => {
    const recentCommitCount = 2 + ((seed + index * 7) % 8)
    const totalContributions = recentCommitCount * (4 + index)

    return {
      id: `contributor-${seed}-${index + 1}`,
      name,
      handle: name,
      totalContributions,
      recentCommitCount,
      recentCommitAt: new Date(Date.now() - index * 1000 * 60 * 60 * 18).toISOString(),
      focusArea: index === 0 ? '기능 개발' : index === 1 ? '테스트/품질' : '리팩토링/유지보수',
      codeQualityScore: clamp(68 + ((seed + index * 13) % 26), 0, 100),
      codeQualitySummary:
        index === 0
          ? '변경 범위 제어는 안정적이지만 테스트 동반 비율을 더 높이면 배포 신뢰도가 올라갑니다.'
          : index === 1
            ? '테스트/품질 변경 비중이 높아 회귀 예방 신호가 강합니다.'
            : '리팩토링 품질은 양호하나 변경 근거를 커밋 단위로 더 명확히 남기면 리뷰 효율이 좋아집니다.',
      codeQualityBreakdown: {
        changeScope: clamp(66 + ((seed + index * 9) % 28), 0, 100),
        testDiscipline: clamp(62 + ((seed + index * 7) % 30), 0, 100),
        riskControl: clamp(64 + ((seed + index * 11) % 27), 0, 100),
        consistency: clamp(67 + ((seed + index * 5) % 25), 0, 100),
      },
      evidence: [
        'src/app/dashboard/page.tsx 변경에서 UI 상태 분리 커밋이 확인됩니다.',
        'tests/analysis.spec.ts 추가로 회귀 체크 신호가 보입니다.',
      ],
      strengths: [
        '최근 커밋 활동이 안정적으로 유지됩니다.',
        '커밋 메시지 가독성이 좋아 리뷰 추적이 쉽습니다.',
      ],
      risk:
        index === 2
          ? '최근 커밋 빈도가 상대적으로 낮아 작업 연속성이 끊길 수 있습니다.'
          : '큰 리스크 신호는 없지만, 변경 범위가 커지기 전에 단위 테스트를 함께 강화하는 것이 좋습니다.',
      recommendation:
        index === 0
          ? '핵심 기능 변경 시 테스트 케이스를 동시에 추가해 안정성을 높이세요.'
          : index === 1
            ? '품질 자동화 범위를 CI 단계까지 확장해 회귀를 줄이세요.'
            : '리팩토링 변경은 작은 PR 단위로 나눠 지식 공유 속도를 높이세요.',
    }
  })
}

export function createDashboardAnalysis(githubId: string): DashboardAnalysis {
  const seed = hashString(githubId)
  const metrics = createMetrics(seed)
  const normalizedRepository = githubId.includes('/') ? githubId : `demo/${githubId}`

  return {
    githubId: normalizedRepository,
    repository: createRepository(normalizedRepository),
    codebaseProfile: createCodebaseProfile(seed),
    contributorInsights: createContributorInsights(seed),
    engine: {
      mode: 'heuristic',
      label: 'GitHub API + 규칙 기반 분석',
      model: null,
    },
    aiInsight: null,
    collectedAt: new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()),
    dailyLines: 420 + (seed % 260),
    cleanCodeScore: Math.round(
      (metrics.readability +
        metrics.architecture +
        metrics.consistency +
        metrics.modernity +
        metrics.security +
        metrics.efficiency) /
        6,
    ),
    focusArea:
      metrics.security < 70
        ? '보안 검토와 실패 처리 방식을 강화할 필요가 있습니다.'
        : '아키텍처와 자동화 신호를 더 끌어올릴 수 있습니다.',
    metrics,
    marketFits: createMarketFits(seed),
    conceptGaps: createConceptGaps(seed),
    reviewSuggestions: createReviewSuggestions(seed),
    activity: createActivity(seed, normalizedRepository),
  }
}
