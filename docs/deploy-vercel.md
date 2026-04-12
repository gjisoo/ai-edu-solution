# Vercel 배포 가이드

## 1) 사전 준비

1. Node.js 18.17 이상 사용
2. GitHub 저장소에 최신 코드 push
3. 아래 환경변수 값 준비

- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (기본값: `gemini-2.5-flash`)

## 2) Vercel 프로젝트 생성 (웹 콘솔)

1. Vercel 로그인
2. `Add New...` -> `Project`
3. 이 저장소 선택 후 Import
4. Framework는 `Next.js` 자동 감지 확인
5. `Environment Variables`에 아래 값 추가
6. `Deploy` 클릭

환경변수 권장 등록 방식:

- `GITHUB_TOKEN`: Production/Preview/Development 모두 등록
- `GEMINI_API_KEY`: Production/Preview/Development 모두 등록
- `GEMINI_MODEL`: 필요 시만 등록 (미등록 시 기본값 사용)

## 3) CLI 배포 (선택)

```bash
npm i -g vercel
vercel login
vercel link
vercel env add GITHUB_TOKEN
vercel env add GEMINI_API_KEY
vercel env add GEMINI_MODEL
vercel --prod
```

이미 `package.json`에 아래 스크립트를 추가해 두었습니다:

```bash
npm run deploy:check
npm run deploy:vercel
```

## 4) 배포 후 확인

1. 접속 후 대시보드 렌더링 확인
2. 공개 GitHub 저장소 분석 정상 동작 확인
3. 추천 강의 링크가 새 탭으로 실제 강의 페이지 열리는지 확인
4. 플랫폼 필터(인프런/유데미/프로그래머스/공식문서) 동작 확인

## 5) 운영 시 체크 포인트

- API 호출이 길어질 수 있어 `analyze-repo` 라우트의 최대 실행시간을 60초로 고정함
- 설정 파일: `vercel.json`
- 라우트 파일: `src/app/api/analyze-repo/route.ts`
- GitHub API rate limit 회피를 위해 `GITHUB_TOKEN`은 사실상 필수
- 타임아웃이 발생하면 Vercel Project Settings의 Functions에서 Fluid Compute 활성화 권장

## 6) 커스텀 도메인 연결

1. Vercel 프로젝트 진입
2. `Settings` -> `Domains`
3. 도메인 추가 후 안내된 DNS 레코드 반영
