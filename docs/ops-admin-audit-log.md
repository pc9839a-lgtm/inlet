# 페이지로 관리자 감사 로그 운영 가이드

Updated: 2026-08-01

## 목적

운영자 권한과 계정·매니저·소유권·프로젝트 상태 변경 이력을 D1 `audit_logs`에 남기고, 전체 관리자만 검색·조회할 수 있도록 유지합니다.

## 관리자 권한 원칙

전체 관리자 권한은 세션의 역할 문자열로 부여하지 않습니다.

허용 기준:

- 코드 기본 운영자 이메일
- `INLET_PLATFORM_MASTER_EMAILS`에 등록된 이메일

`superadmin`, `serviceadmin`, `platform_master` 같은 클라이언트 또는 세션 역할값만으로는 관리자 API에 접근할 수 없습니다.

모든 `/api/admin/*` 요청은 `functions/api/admin/_middleware.js`에서 먼저 검사합니다. 단, 자동 도메인 재확인 엔드포인트는 `INLET_DOMAIN_RECHECK_SECRET`과 일치하는 Bearer 비밀키를 사용할 때만 세션 검사를 통과할 수 있습니다. 해당 엔드포인트 내부에서도 비밀키를 다시 검증합니다.

## 기록되는 계정·인증 이벤트

- `account.signup_completed`
- `account.signup_failed`
- `auth.login_succeeded`
- `auth.login_failed`
- `auth.email_verification_requested`
- `auth.email_verification_request_failed`
- `account.profile_changed`
- `account.status_changed`
- `account.password_changed`
- `account.password_change_failed`

비밀번호 변경 감사 메타데이터에는 비밀번호나 인증 코드가 포함되지 않습니다. 변경 성공 기록은 계정 ID를 사용하고 실패 기록은 이메일 원문 대신 HMAC-SHA256 지문을 사용합니다.

현재 세션 토큰은 무상태 서명 토큰이므로 비밀번호 변경 성공 기록에 `sessionRotationRequired: true`를 남깁니다. 화면에서는 새 비밀번호로 다시 로그인하도록 안내합니다.

## 기록되는 매니저 이벤트

- `manager.invite_created`
- `manager.invite_accepted`
- `manager.member_added`
- `manager.permissions_changed`
- `manager.status_changed`
- `manager.removed`

매니저 권한 이벤트는 페이지 저장 시 변경 전후 `ownership.managers`를 비교해 실제 차이가 있을 때만 기록합니다. 일반 콘텐츠 저장이나 동일 권한 재저장은 이벤트를 만들지 않습니다.

매니저 이메일은 감사 메타데이터에 저장하지 않습니다. 계정·멤버 ID가 없을 때만 이메일의 HMAC-SHA256 지문을 대상 ID로 사용합니다.

## 기록되는 소유권 이전 이벤트

- `ownership_transfer.requested`
- `ownership_transfer.waiting_billing_clearance`
- `ownership_transfer.approved`
- `ownership_transfer.rejected`
- `ownership_transfer.completed`
- `ownership_transfer.canceled`
- 예외 상태 변경 시 `ownership_transfer.status_changed`

상태 변경 기록에는 이전·다음 상태와 이전·다음 결제 정리 상태를 함께 저장합니다.

## 기록되는 프로젝트 이벤트

- `project.paused`
- `project.restored`
- `project.archived`

운영자 일시중지는 기존 `archived` DB 상태를 사용해 공개 페이지를 즉시 내립니다. 운영 콘솔에서는 이를 `paused` 조작으로 구분해 감사 기록에 `operatorState: paused`를 남깁니다. 복원하면 상태를 `active`로 돌리고 `project.restored`를 기록합니다.

일반 사용자의 페이지 삭제도 실제 행을 삭제하지 않고 `archived` 상태로 전환하며 `project.archived`를 기록합니다.

## 내부 운영 화면

```text
/admin/audit
```

이 화면은 일반 작업 메뉴에 노출하지 않는 route-only 운영 화면입니다.

제공 기능:

- 감사 로그 검색
- 작업 코드·프로젝트 ID·대상 종류·시작 날짜 필터
- 50개 단위 추가 조회
- 전체 프로젝트 목록 및 상태 검색
- 프로젝트 일시중지
- 프로젝트 복원

화면 HTML에는 운영자 이메일 목록, 세션 비밀키, API 토큰을 포함하지 않습니다. 브라우저의 로그인 세션으로 보호된 `/api/admin/audit`, `/api/admin/summary`, `/api/admin/projects/:id/status`를 호출하며 실제 데이터 권한은 API에서 다시 확인합니다.

SEO 및 프레임 삽입 방지 헤더:

- `X-Robots-Tag: noindex, nofollow, noarchive`
- `Content-Security-Policy`의 `frame-ancestors 'none'`
- `Cache-Control: no-store`

## 개인정보 및 비밀값 보호

감사 메타데이터에서 다음 키는 자동으로 `[redacted]` 처리합니다.

- password / passcode
- token / secret
- authorization / cookie / session
- credential / api key
- access key / refresh key

IP와 User-Agent는 원문 대신 `sha256:` 접두사의 HMAC-SHA256 지문만 저장합니다.

권장 환경값:

```text
INLET_AUDIT_HASH_SECRET=<충분히 긴 별도 랜덤 문자열>
```

설정하지 않으면 `INLET_SESSION_SECRET`, 그다음 `INLET_API_TOKEN`을 사용합니다. 운영에서는 감사 지문 전용 비밀키를 별도로 설정합니다.

## 조회 API

```text
GET /api/admin/audit
```

지원 필터:

- `q`: 작업·대상·운영자 이메일/이름·프로젝트 제목/주소 검색
- `action`: 정확한 작업 코드
- `actor`: 운영자 계정 ID 또는 이메일
- `projectId`: 프로젝트 ID
- `targetType`: 대상 종류
- `dateFrom`: 시작 날짜 또는 ISO 시각
- `dateTo`: 종료 날짜 또는 ISO 시각
- `cursor`: 오프셋
- `limit`: 1~100

응답에는 원본 IP와 원본 User-Agent가 포함되지 않습니다. 감사 로그 삭제·수정 API는 제공하지 않습니다.

## 프로젝트 운영 API

```text
PATCH /api/admin/projects/:id/status
```

지원 조작:

- `pause`: DB 상태를 `archived`로 전환하고 `project.paused` 기록
- `restore`: DB 상태를 `active`로 전환하고 `project.restored` 기록
- `archive`: DB 상태를 `archived`로 전환하고 `project.archived` 기록

동일 상태로 다시 요청하면 DB와 감사 로그를 중복 변경하지 않습니다.

## 운영 확인

1. 일반 계정으로 `/api/admin/summary`와 `/api/admin/audit` 요청 시 403인지 확인합니다.
2. 역할만 `superadmin`으로 위조한 일반 계정도 403인지 확인합니다.
3. 허용 이메일 운영자는 두 API에서 200을 받는지 확인합니다.
4. 회원가입·로그인·프로필·비밀번호 변경 후 계정 이벤트가 생성되는지 확인합니다.
5. 비밀번호 변경 실패 기록에 비밀번호·인증 코드·이메일 원문이 없는지 확인합니다.
6. 매니저 초대 발급·수락 후 초대 이벤트가 생성되는지 확인합니다.
7. 매니저 권한 변경·비활성화·삭제 후 해당 이벤트만 생성되는지 확인합니다.
8. 소유권 이전 요청·승인·거절·취소·완료 상태마다 정확한 이벤트가 생성되는지 확인합니다.
9. `/admin/audit`에서 로그 검색과 추가 조회가 동작하는지 확인합니다.
10. 운영 콘솔에서 페이지를 중지하면 공개 주소가 404가 되고, 복원하면 다시 노출되는지 확인합니다.
11. 페이지 삭제 처리 후 `project.archived`가 생성되고 프로젝트가 `archived` 상태인지 확인합니다.
12. 조회 응답에 `ip`, `user_agent` 원문이 없는지 확인합니다.
13. 필터와 페이지네이션이 최신순으로 동작하는지 확인합니다.

## QA

```bash
npm run admin:audit:qa
npm run auth:qa
npm run auth:email:qa
npm run api:functions:qa
npm run api:security:qa
npm run qa:all
```

`admin:audit:qa`는 다음을 실행 검증합니다.

- 매니저 추가·권한 변경·상태 변경·삭제 이벤트 분리
- 비밀번호·토큰·세션 자동 마스킹
- 프로젝트 pause/restore 상태 정책
- `/admin/audit`의 noindex·CSP·비밀값 비노출
- 운영자 이메일 역할 문자열 위조 차단

최종 브랜치 QA 증빙:

- commit: `b521c19f67633cf07b3aa21fa89690cb446ce790`
- workflow run: `30702147816`
- full offline QA: success
- public landing browser regression: success
- authenticated editor browser regression: success
- form and reservation browser regression: success

## 배포 상태 구분

- 코드 완료: 감사 기록·관리자 미들웨어·조회 API·운영 화면이 브랜치에 존재
- QA 완료: 정적·런타임·전체 QA 통과
- 병합 완료: `main` 반영
- 배포 완료: 운영 Pages Functions 반영
- 운영 검증 완료: 실제 운영자/일반 계정으로 권한과 기록 확인

브랜치 코드나 mock QA만으로 운영 검증 완료라고 기록하지 않습니다.
