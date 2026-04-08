import type {
  ActivityEvent,
  ConceptGap,
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

export function createDashboardAnalysis(githubId: string): DashboardAnalysis {
  const seed = hashString(githubId)
  const metrics = createMetrics(seed)
  const normalizedRepository = githubId.includes('/') ? githubId : `demo/${githubId}`

  return {
    githubId: normalizedRepository,
    repository: createRepository(normalizedRepository),
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
