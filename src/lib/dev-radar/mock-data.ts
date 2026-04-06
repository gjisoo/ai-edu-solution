import type {
  ActivityEvent,
  ConceptGap,
  DashboardAnalysis,
  DevMetric,
  MarketFit,
  ReviewSuggestion,
} from '@/types/dev-radar'

function hashString(value: string) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
      targetJob: 'Backend Engineer · Node.js / TypeScript',
      similarityScore: clamp(70 + (seed % 19), 0, 100),
      missingTech: ['테스트 자동화', 'Docker', '성능 최적화'],
    },
    {
      targetJob: 'Fullstack Engineer · React / Next.js',
      similarityScore: clamp(62 + (seed % 17), 0, 100),
      missingTech: ['디자인 시스템', 'E2E 테스트', '접근성'],
    },
    {
      targetJob: 'Platform Engineer · Cloud / Infra',
      similarityScore: clamp(48 + (seed % 15), 0, 100),
      missingTech: ['CI/CD', 'Observability', 'Kubernetes'],
    },
  ]
}

function createReviewSuggestions(seed: number): ReviewSuggestion[] {
  return [
    {
      id: `review-${seed}-1`,
      title: '함수 책임 분리',
      impact: '가독성 + 아키텍처',
      description:
        '비즈니스 로직과 외부 IO를 분리하면 테스트 가능성이 높아지고 함수 단일 책임 원칙 준수 점수가 함께 상승합니다.',
    },
    {
      id: `review-${seed}-2`,
      title: '에러 핸들링 강화',
      impact: '보안성 + 안정성',
      description:
        '비동기 흐름에서 예외가 누락되는 패턴이 보여 서버 액션과 API 레이어 모두에서 공통 예외 처리 유틸이 필요합니다.',
    },
    {
      id: `review-${seed}-3`,
      title: '커밋 단위 분리',
      impact: '협업성 + 일관성',
      description:
        '기능 추가와 리팩터링을 분리된 커밋으로 남기면 변경 의도가 선명해져 리뷰 효율과 팀 생산성이 좋아집니다.',
    },
  ]
}

function createConceptGaps(seed: number): ConceptGap[] {
  return [
    {
      id: `gap-${seed}-1`,
      title: '비동기 예외 전파',
      category: 'build error',
      severity: 'high',
      timestamp: '오늘 11:14',
      summary:
        'Promise 체인과 async/await이 혼합된 구간에서 예외 전파가 누락되어 빌드 오류와 런타임 불안정이 반복적으로 발생했습니다.',
      recommendation: 'Promise 에러 흐름, try/catch 범위, Result 패턴 복습',
    },
    {
      id: `gap-${seed}-2`,
      title: '자료구조 선택 근거',
      category: 'algorithm pattern',
      severity: 'medium',
      timestamp: '어제 18:20',
      summary:
        '문제는 해결되지만 배열과 맵, 셋 중 어떤 구조를 왜 선택했는지 설명 근거가 약해 효율성 지표에 영향을 주고 있습니다.',
      recommendation: '해시 기반 컬렉션과 시간 복잡도 비교 정리',
    },
    {
      id: `gap-${seed}-3`,
      title: '테스트 더블 설계',
      category: 'review feedback',
      severity: 'low',
      timestamp: '3일 전 09:05',
      summary:
        '핵심 테스트는 통과하지만 외부 의존성 분리를 더 선명하게 하면 유지보수성과 협업성이 함께 상승할 수 있습니다.',
      recommendation: 'mock, stub, spy 사용 구분과 의존성 역전 패턴 복습',
    },
  ]
}

function createActivity(seed: number, githubId: string): ActivityEvent[] {
  return [
    {
      id: `event-${seed}-1`,
      time: '09:42',
      label: 'VS Code 세션 동기화 완료',
      detail: `@${githubId}의 오늘 첫 코딩 세션 64분이 집계되었고 TypeScript 파일 8개가 정적 분석 대상으로 등록되었습니다.`,
    },
    {
      id: `event-${seed}-2`,
      time: '12:08',
      label: 'GitHub 커밋 품질 갱신',
      detail:
        '최근 5개 커밋 중 4개가 명확한 작업 의도와 범위를 포함해 협업성 축 점수가 상승했습니다.',
    },
    {
      id: `event-${seed}-3`,
      time: '14:31',
      label: '채용 공고 매칭 완료',
      detail:
        '백엔드 JD와의 벡터 유사도가 재계산되었고 테스트 자동화 경험이 핵심 보완 포인트로 식별되었습니다.',
    },
  ]
}

export function createDashboardAnalysis(githubId: string): DashboardAnalysis {
  const seed = hashString(githubId)
  const metrics = createMetrics(seed)

  return {
    githubId,
    collectedAt: new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
        ? '보안 입력 검증과 예외 처리 품질 보강'
        : '아키텍처 분리와 테스트 자동화 레벨업',
    metrics,
    marketFits: createMarketFits(seed),
    conceptGaps: createConceptGaps(seed),
    reviewSuggestions: createReviewSuggestions(seed),
    activity: createActivity(seed, githubId),
  }
}
