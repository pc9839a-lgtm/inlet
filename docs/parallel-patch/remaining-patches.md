# 페이지로 랜딩 제작 남은 패치

업데이트: 2026-08-03 00:37 KST

저장소: `pc9839a-lgtm/inlet`

운영 브랜치: `main`

현재 `main`: `d2f929769957bfd7aff1f01b6ac0d9769612ca97`

랜딩 제작 모바일 기준선: `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`

현재 배포 기록의 소스 SHA: `38d6a56abd5fad86ed621cc558538efdfc03ed14`

이 문서는 **페이지로의 랜딩페이지 제작·편집·저장·미리보기·발행·도메인·운영 기능만** 관리한다.

콜태그 앱, 콜태그 문의 동기화, 문자·전화 CRM 기능은 이 문서의 범위가 아니며 별도 제품 문서에서 관리한다.

코드 완료, 자동 QA 완료, `main` 병합, 운영 배포, 실환경 검증은 서로 다른 상태다. 브랜치 전용 코드, mock, 스크린샷, `skipped-live` 결과만으로 운영 완료라고 기록하지 않는다.

# 현재 상태 요약

## 완료된 랜딩 제작 기준선

다음 항목은 현재 `main`에 병합됐다. 실제 회귀가 재현되지 않는 한 다시 만들지 않는다.

- 활성 템플릿 3종 유지
  - 개인회생 상담
  - 모바일 청첩장
  - 부동산 분양
- 360px, 390px, 430px 실제 Chrome 모바일 회귀검사
- 갤러리 화살표·도트 터치 및 키보드 포커스
- FAQ 열기·닫기
- 지도 외부 이동
- 상담폼·방문예약폼
- 모바일 키보드 표시 중 상단 메뉴·공유·하단 고정 UI 숨김
- 개인정보 동의 행과 체크박스 터치 영역
- 상단 메뉴 1~8개 균형 배치
- 공유 버튼과 하단 고정 버튼 충돌 방지
- 타이머 3종, 하단 타이머 상속, 공용 카운트다운 시계
- 저장 중 페이지 전환 응답 격리
- 계정·페이지별 임시 초안 복구
- 이미지 방향 보정·리사이즈·압축·중복 방지
- 일반 계정 1개 활성 페이지 서버 차단 기반
- 공개 랜딩, 로그인 편집기, 상담·예약 브라우저 회귀 기반
- 배포 후 HTML·Functions·정적 자산 smoke 검사

PR `#44`는 `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`으로 `main`에 병합됐다. 이전 문서의 “PR #44 미병합” 상태는 폐기한다.

## 아직 운영 완료가 아닌 영역

- D1 변경 전 암호화 백업·복구 게이트
- 개인 도메인
- 일반 계정 1페이지 정책의 운영 실검증
- 관리자 권한·감사기록
- 실제 Android 기기 최종 검수
- Google Sheets·전환추적 실환경 검증
- 대용량 문의·통계 성능 검증
- 클래식·프로 기능 권한
- 결제·정기구독

# 절대 규칙

## 운영 메인 동결

`https://pagero.kr/`의 현재 메인 화면은 동결 기준본이다.

사용자가 메인 변경을 직접 요청하지 않은 작업에서는 디자인, 문구, 섹션 순서, 메뉴, 푸터, 애니메이션, 생활정보 연결, 로그인·시작 버튼, 반응형 결과를 변경하지 않는다.

보호 범위:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`의 루트·공개 홈 분기
- 공개 홈 컴포넌트와 스타일
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- `server/index.mjs`의 루트·정적 라우팅

필수 운영 신호:

- `.pagero-exact-home` 정확히 1개
- `.c63-life-nav-link` 정확히 1개
- `.c63-life-bridge` 정확히 1개
- `.c63-life-post` 정확히 4개
- `https://life.pagero.kr/` 링크
- `https://awards.pagero.kr/` 링크

관련 없는 패치에서 보호 파일 diff 또는 필수 신호 변화가 생기면 병합·배포를 중단한다.

## 계정별 페이지 정책

- 일반 계정: 활성 랜딩페이지 1개
- 플랫폼 마스터: 활성 랜딩페이지 무제한
- 화면과 API 양쪽에서 제한
- `superadmin` 같은 역할 문자열 위조로 우회 금지
- 기존 페이지 편집·revision·restore·preview·publish 허용
- 보관·삭제된 페이지는 활성 페이지 수에서 제외
- Google 로그인 계정도 동일 정책
- manager/member가 소유자 quota를 우회해 새 페이지 생성 금지
- 플랫폼 마스터 판별은 승인 이메일과 `INLET_PLATFORM_MASTER_EMAILS`만 사용

## 활성 템플릿

아래 3개만 유지한다.

1. 개인회생 상담
2. 모바일 청첩장
3. 부동산 분양

새 템플릿을 추가하거나 편집 불가능한 HTML 껍데기로 교체하지 않는다.

개인회생 문구에서 승인·면책·법적 결과를 보장하지 않는다.

## 요금제

유료 플랜은 정확히 2개다.

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

3,300원 / 6,600원 / 9,900원 3단계 방향을 복원하지 않는다. 세 번째 유료 플랜을 추가하지 않는다.

플랜별 페이지 수, 문의 수, 통계 보관기간, 매니저 수, 개인 도메인, 외부 연동 권한은 사용자가 확정하기 전까지 추측으로 구현하지 않는다.

## 배포

- `main` force-push 금지
- destructive reset, clean, restore로 릴리스 구성 금지
- 관련 없는 리팩터링 혼합 금지
- 기능별 QA와 전체 QA 통과 전 병합 금지
- 운영 배포는 명시적 승인 후에만 진행
- `skipped-live`를 실환경 성공으로 기록 금지

# 남은 패치 우선순위

## P0-1. D1 마이그레이션 안전 게이트 분리

현재 PR `#45`에는 D1 안전 게이트와 콜태그 Android 문서가 함께 들어 있다. 이 문서의 범위에서는 PR `#45`를 그대로 병합하지 않는다.

페이지로 랜딩 제작에 필요한 아래 파일만 최신 `main` 기준의 별도 PR로 분리한다.

- `.github/workflows/d1-migration-safety.yml`
- `scripts/d1-migration-safety.mjs`
- `scripts/d1-migration-safety-runner.mjs`
- `scripts/d1-migration-safety-quality-check.mjs`
- `docs/ops-d1-migration-safety.md`
- `docs/ops-storage-migration-policy.md`
- 필요한 `.env.example` 항목
- 필요한 `package.json` QA 명령
- 필요한 `scripts/qa-all.mjs` 등록

필수 동작:

1. 읽기 전용 `preflight`
2. 원격 migration history 조회
3. 적용 예정 파일명과 순서의 정확한 승인
4. 전체 SQL export
5. AES-256 암호화 artifact만 보관
6. plaintext SQL 삭제 확인
7. SHA-256과 HMAC 증빙
8. 가능한 경우 D1 Time Travel bookmark 기록
9. 적용 후 migration history 재확인
10. 자동 운영 복구 금지
11. disposable D1에서 복구 연습

완료 기준:

- 별도 랜딩 전용 PR
- 최신 `main`과 충돌 없음
- 전체 QA 성공
- 운영 Secret 목록 문서화
- read-only preflight 성공
- 암호화 백업 생성 증빙
- disposable 복구 drill 성공

## P0-2. 개인 도메인 migration 번호 정리

현재 `main`에는 이미 `0006_*` migration이 존재한다. PR `#41`의 `0006_page_domains.sql`, `0007_page_domain_operations.sql`을 그대로 적용하지 않는다.

D1 preflight에서 원격·로컬 migration 목록을 확인한 뒤 다음 사용 가능한 연속 번호로 재명명한다.

예상 번호는 `0007_page_domains.sql`, `0008_page_domain_operations.sql`이지만, 원격 이력을 확인하기 전 확정하지 않는다.

함께 수정할 범위:

- migration 파일명
- migration 안전 게이트 승인 목록
- D1 schema QA
- 운영 runbook
- PR 설명과 체크리스트

## P0-3. 개인 도메인 운영 완성

PR `#41`에는 코드와 자동 QA 기반이 있으나 아직 운영 기능이 아니다.

필수 작업:

- 최신 `main` 재통합
- 보호 메인 파일 diff 없음 확인
- D1 백업 후 재번호화된 migration 적용
- Cloudflare account ID 설정
- Pages project 설정
- Pages Edit 최소 권한 API token 설정
- CNAME target 설정
- domain recheck secret 설정
- GitHub scheduled recheck secret 동기화
- 테스트 도메인 연결

실환경 검증:

- 도메인 입력 검증
- 동일 도메인 중복 소유 차단
- DNS 안내
- `pending → verifying → active` 상태
- 실패·재시도·운영 확인 승격
- SSL 활성화
- 루트 공개 라우팅
- JS·CSS·이미지 자산
- 상담폼 제출
- 방문예약 제출
- 통계·전환 이벤트
- 공유 URL과 canonical URL
- 기본 주소 복귀
- 도메인 해제·재연결
- 미등록·미활성 도메인 noindex 404

## P0-4. 일반 계정 1페이지 운영 실검증

제품 제한 로직은 `main`에 존재하지만 실제 운영 fixture 검증은 완료되지 않았다.

PR `#42`를 최신 `main` 기준으로 재통합하고 다음을 검증한다.

- 일반 계정 첫 페이지 생성 성공
- 두 번째 화면 생성 차단
- 직접 API 생성 `409 / ACCOUNT_PAGE_LIMIT_REACHED`
- 기존 페이지 저장·revision·restore·preview·publish
- 보관 후 대체 페이지 생성
- 삭제 후 대체 페이지 생성
- 플랫폼 마스터 복수 페이지 생성
- 로그아웃·로그인·세션 갱신 후 플랫폼 마스터 유지
- Google 로그인 계정 동일 quota
- manager/member 우회 차단
- 모든 `qa-limit-*` 테스트 페이지 삭제

`verified-live`와 cleanup 증빙이 모두 있어야 완료다.

## P1-1. 실제 Android 기기 최종 검수

자동 Chrome QA와 별도로 실제 Android 기기에서 검수한다.

최소 폭:

- 약 360px
- 약 390px
- 약 430px

검수 항목:

- 긴 히어로 제목과 설명
- 5~8개 상단 메뉴
- 갤러리 화살표·도트·스와이프
- FAQ
- 지도 앱 이동
- 상담폼
- 예약 날짜·시간
- 개인정보 동의
- 키보드가 제출 버튼을 가리지 않는지
- 입력 중 고정 UI 숨김
- 공유 버튼
- 하단 CTA
- 느린 네트워크 이미지 로딩
- 중복 제출 잠금
- Chrome과 Samsung Internet

실기기 증빙 없이 모바일 운영 검증 완료라고 기록하지 않는다.

## P1-2. 관리자 권한·감사 기능

PR `#43`을 최신 `main`에 재통합한다.

필수 기능:

- `/api/admin/*` 플랫폼 마스터 권한 통일
- 역할 문자열 위조 차단
- 계정 정지·복원
- 프로젝트 일시중지·복원
- 이메일 변경 후 이전 세션 무효화
- 매니저 초대·수락·권한 변경·삭제 이력
- 소유권 이전 요청·승인·거절·취소·완료 이력
- 감사 검색·필터·페이지네이션
- 비밀번호·토큰·세션·쿠키·Authorization 마스킹
- IP·User-Agent 원문 저장 금지
- 감사 로그 보존정책
- `/admin/audit` route-only 유지

운영 Secret과 disposable fixture를 준비한 뒤 read-only → token request → verify-live 순서로 검증한다.

## P1-3. 외부 연동 실환경 검증

새로 구현하지 말고 현재 기반을 실제 운영 설정으로 검증한다.

Google Sheets:

- 운영 OAuth redirect URI
- 연결
- 토큰 만료 후 refresh
- 폼 항목에 맞춘 header
- 문의 행 전달
- 중복 행 방지
- 연결 해제 즉시 전송 중단
- 실패 재시도와 dead-letter 확인

전환 추적:

- GTM
- Google Analytics
- Meta Pixel
- 상담 제출 이벤트
- 예약 제출 이벤트
- 실제 광고 계정 이벤트 수신

인증 이메일:

- SES identity
- DKIM
- SPF
- DMARC
- sandbox 해제
- 가입 인증
- 비밀번호 재설정
- 이메일 변경
- 매니저 초대
- 소유권 이전 알림

## P1-4. 대용량 데이터와 운영 복구

검증 데이터 규모:

- 문의 10,000건
- 문의 100,000건
- 이벤트·통계 1,000,000행 수준의 쿼리 계획 점검

검증 항목:

- 접수함 첫 로드
- cursor 또는 page pagination
- 기간 필터
- 검색
- CSV 월 범위 제한
- 통계 집계
- source·device·page 필터
- D1 인덱스 사용
- timeout과 메모리

운영 복구:

- 이전 Cloudflare Pages 배포로 복귀
- D1 Time Travel
- migration rollback 문서
- 잘못 연결된 개인 도메인 긴급 해제
- 폼 접수 장애 사용자 안내
- audit·delivery log 보존기간

## P1-5. 접근성·키보드 회귀

- 키보드만으로 편집기 주요 기능 접근
- 모달 focus trap
- 닫은 뒤 원래 버튼으로 focus 복귀
- input·button·toggle 라벨
- `focus-visible`
- 44px 모바일 터치 영역
- 색 대비
- reduced motion
- 오류·저장 상태 `aria-live`

## P2-1. 클래식·프로 권한 확정

결제 전에 사용자가 아래 차이를 확정해야 한다.

- 활성 페이지 수
- 페이지 복제
- 월 문의 접수량
- 통계 보관기간
- 매니저 수
- 개인 도메인
- Google Sheets
- GTM·Pixel·전환추적
- 데이터 내보내기
- 외부 연동 수

확정 전에는 화면이나 서버에서 임의 권한을 만들지 않는다.

## P2-2. 서버 권한 엔진

플랜 권한은 화면 버튼 숨김이 아니라 API와 저장소 경계에서 강제한다.

필수:

- 서버 entitlement 모델
- 기능별 limit 검사
- 기존 사용자 migration
- 운영자 override 감사기록
- downgrade 처리
- grace period
- 만료 후 데이터 보존정책

## P2-3. 결제·정기구독

- 결제 제공자 추상화
- 빌링키·카드 등록
- 최초 결제
- 정기 갱신
- 기간 종료 해지
- 결제 실패
- 유예기간
- 서명된 webhook
- webhook idempotency
- 결제내역
- 영수증 링크
- 관리자 수동 처리와 감사기록
- 결제 Secret 서버 전용

# 현재 열린 PR 판정

## PR #41 — 개인 도메인

상태:

- 코드·자동 QA 기반 완료
- open / mergeable
- 최신 `main` 이후 다시 상태 확인 필요
- 운영 migration 미적용
- Cloudflare 운영 설정 미완료
- 실제 도메인 검증 미완료

판정:

- 바로 병합 금지
- D1 안전 게이트와 migration 재번호화 후 진행

## PR #42 — 1페이지 정책 실검증

상태:

- 제품 제한 로직은 이미 `main`에 있음
- 운영 verifier 코드·자동 QA 기반 완료
- disposable fixture·signed session 미준비
- `verified-live` 미완료

판정:

- 개인 도메인과 분리해서 최신 `main`에 재통합
- 운영 쓰기 검증은 별도 승인 필요

## PR #43 — 관리자·감사

상태:

- 코드·자동 QA 기반 완료
- 운영 Secret·fixture 미확인
- `verified-live` 미완료

판정:

- 개인 도메인과 한 번에 병합 금지
- 최신 `main` 재통합 후 별도 배포·검증

## PR #45 — D1 안전 게이트 + 타 제품 문서 혼합

상태:

- D1 안전 게이트 코드와 QA 기반 완료
- 콜태그 Android 문서가 같은 PR에 포함
- 운영 preflight·backup·restore drill 미완료

판정:

- 그대로 병합 금지
- 페이지로 랜딩 제작에 필요한 D1 안전 파일만 별도 PR로 분리

# 실행 순서

1. 이 백로그 문서 최신화
2. PR #45에서 D1 안전 게이트만 분리
3. 최신 `main` read-only D1 preflight
4. migration 번호 충돌 해소
5. 암호화 운영 D1 백업
6. disposable D1 복구 drill
7. PR #41 개인 도메인 최신화·QA
8. 개인 도메인 migration·환경 설정·배포·실검증
9. PR #42 1페이지 정책 `verified-live`
10. 실제 Android 기기 검수
11. PR #43 관리자·감사 최신화·실검증
12. Sheets·SES·전환추적 실환경 검증
13. 대용량·복구·접근성 검증
14. 클래식·프로 권한 확정
15. 서버 entitlement
16. 결제·정기구독

# 병합·배포 전 필수 QA

```bash
npm run templates:qa
npm run browser:templates-mobile:contract:qa
npm run browser:templates-mobile:qa
npm run preview:parity:qa
npm run bottom:fixed:qa
npm run topnav:balance:qa
npm run qa:all
npm run build
npm run deployment:qa
npm run deployment:smoke:contract:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:production:qa
npm run live:qa
```

기능에 따라 추가:

```bash
npm run account:page-limit:qa
npm run page:save:qa
npm run page:draft:qa
npm run page:operation:isolation:qa
npm run image:upload:qa
```

D1 안전 게이트가 분리되면 해당 contract QA와 preflight도 필수 명령에 추가한다.

# 패치 종료 기록

모든 패치 종료 시 아래를 기록한다.

1. 기준 `main` SHA
2. 작업 브랜치와 PR
3. 변경 파일
4. 보호 메인 파일 diff 없음
5. 코드 완료 여부
6. 자동 QA 완료 여부
7. 병합 여부
8. 배포 SHA와 URL
9. migration 적용 여부
10. 필요한 Secret 설정 여부
11. 실환경 검증 결과
12. cleanup·rollback 증빙

완료된 항목은 활성 목록에서 제거한다. 브랜치 전용, mock 전용, screenshot 전용, `skipped-live` 결과를 운영 완료로 남기지 않는다.
