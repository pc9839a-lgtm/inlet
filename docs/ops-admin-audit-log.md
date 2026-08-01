# 페이지로 관리자 감사 로그 운영 가이드

Updated: 2026-08-01

## 목적

계정·인증·매니저·소유권 이전·프로젝트·플랫폼 관리자 조작 이력을 D1 `audit_logs`에 남기고, 일반 운영자가 감사 기록을 임의로 수정하거나 삭제할 수 없도록 유지합니다.

## 관리자 권한 원칙

전체 관리자 권한은 세션 역할 문자열이 아니라 플랫폼 마스터 이메일 허용목록으로 판별합니다.

허용 기준:

- 코드 기본 운영자 이메일
- `INLET_PLATFORM_MASTER_EMAILS`에 등록된 이메일

`superadmin`, `serviceadmin`, `platform_master` 같은 역할값만으로는 `/api/admin/*`에 접근할 수 없습니다.

모든 관리자 요청은 `functions/api/admin/_middleware.js`에서 검사하며, 다음 자동 운영 엔드포인트만 정확한 전용 비밀키로 세션 검사를 대체할 수 있습니다.

- `/api/admin/domains/recheck`: `INLET_DOMAIN_RECHECK_SECRET`
- `/api/admin/audit/retention`: `INLET_AUDIT_RETENTION_SECRET`

각 엔드포인트 내부에서도 비밀키를 다시 검증합니다.

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
- `account.email_changed`
- `account.email_change_failed`
- `account.suspended_by_admin`
- `account.restored_by_admin`
- `account.admin_status_change_failed`

### 비밀번호 변경

비밀번호와 인증 코드는 감사 메타데이터에 저장하지 않습니다. 성공 기록은 계정 ID를 사용하고 실패 기록은 이메일 원문 대신 HMAC-SHA256 지문을 사용합니다.

비밀번호 변경 후 화면은 새 비밀번호로 다시 로그인하도록 안내합니다.

### 이메일 변경

```text
PATCH /api/auth/account/email
```

필수 조건:

1. 유효한 로그인 세션
2. 기존 이메일과 다른 새 이메일
3. 새 이메일로 발급된 `email-change` 인증 코드
4. 비밀번호 가입 계정은 현재 비밀번호 확인

Google 계정처럼 비밀번호 해시가 없는 계정은 로그인 세션과 새 이메일 인증으로 변경합니다.

이메일 변경 시:

- 기존 계정 ID를 유지합니다.
- 중복 이메일을 차단합니다.
- 비밀번호 계정은 새 이메일 기준으로 비밀번호 해시를 다시 생성합니다.
- 새 이메일이 포함된 세션을 새로 발급합니다.
- 기존 이메일이 포함된 이전 세션은 계정 조회에 실패하므로 자동 무효화됩니다.
- 감사 로그에는 이전·새 이메일 원문 대신 각각의 HMAC-SHA256 지문만 저장합니다.

### 플랫폼 관리자 계정 정지·복원

```text
PATCH /api/admin/accounts/:id/status
```

지원 조작:

- `suspend`: `suspended`로 변경하고 `account.suspended_by_admin` 기록
- `restore`: `active`로 변경하고 `account.restored_by_admin` 기록

안전장치:

- 현재 로그인한 운영자 본인 계정 변경 차단
- 플랫폼 마스터 계정 변경 차단
- `deleted_pending_retention` 계정 복원 차단
- 동일 상태 재요청 시 중복 감사 기록 미생성

## 기록되는 매니저 이벤트

- `manager.invite_created`
- `manager.invite_accepted`
- `manager.member_added`
- `manager.permissions_changed`
- `manager.status_changed`
- `manager.removed`

페이지 저장 전후 `ownership.managers`를 비교해 실제 차이가 있을 때만 기록합니다. 일반 콘텐츠 저장이나 동일 권한 재저장은 이벤트를 만들지 않습니다.

매니저 이메일은 감사 메타데이터에 저장하지 않습니다. 계정·멤버 ID가 없을 때만 이메일 지문을 대상 ID로 사용합니다.

## 기록되는 소유권 이전 이벤트

- `ownership_transfer.requested`
- `ownership_transfer.waiting_billing_clearance`
- `ownership_transfer.approved`
- `ownership_transfer.rejected`
- `ownership_transfer.completed`
- `ownership_transfer.canceled`
- 예외 상태 변경 시 `ownership_transfer.status_changed`

상태 변경 기록에는 이전·다음 상태와 결제 정리 상태를 함께 저장합니다.

## 기록되는 프로젝트 이벤트

- `project.paused`
- `project.restored`
- `project.archived`

운영자 일시중지는 기존 `archived` DB 상태를 사용해 공개 페이지를 즉시 내립니다. 감사 기록에는 `operatorState: paused`를 남깁니다. 복원 시 `active`로 변경하고 `project.restored`를 기록합니다.

일반 사용자의 페이지 삭제도 실제 행을 제거하지 않고 `archived`로 전환하며 `project.archived`를 기록합니다.

## 내부 운영 화면

```text
/admin/audit
```

일반 작업 메뉴에 노출하지 않는 route-only 운영 화면입니다.

제공 기능:

- 감사 로그 검색·필터·페이지네이션
- 전체 프로젝트 검색
- 프로젝트 일시중지·복원
- 전체 계정 검색
- 일반 계정 정지·복원

화면 HTML에는 운영자 이메일 허용목록, 세션 비밀키, API 토큰, 감사 보존 비밀키를 포함하지 않습니다. 실제 권한은 각 API에서 다시 확인합니다.

적용 헤더:

- `X-Robots-Tag: noindex, nofollow, noarchive`
- `Cache-Control: no-store`
- `Content-Security-Policy`의 `frame-ancestors 'none'`

## 개인정보 및 비밀값 보호

감사 메타데이터에서 다음 키는 자동으로 `[redacted]` 처리합니다.

- password / passcode
- token / secret
- authorization / cookie / session
- credential / api key
- access key / refresh key

IP와 User-Agent는 원문 대신 `sha256:` 접두사의 HMAC-SHA256 지문만 저장합니다.

운영 필수 권장값:

```text
INLET_AUDIT_HASH_SECRET=<충분히 긴 감사 지문 전용 랜덤 문자열>
```

설정하지 않으면 `INLET_SESSION_SECRET`, 이후 `INLET_API_TOKEN`을 사용하지만 운영에서는 별도 감사 지문 키를 사용합니다.

## 감사 조회 API

```text
GET /api/admin/audit
```

지원 필터:

- `q`
- `action`
- `actor`
- `projectId`
- `targetType`
- `dateFrom`
- `dateTo`
- `cursor`
- `limit` 1~100

응답에는 원본 IP와 원본 User-Agent가 포함되지 않습니다. 일반 관리자용 감사 로그 수정·삭제 API는 제공하지 않습니다.

## 감사 로그 보존·정리

```text
POST /api/admin/audit/retention
```

이 엔드포인트는 플랫폼 관리자 브라우저 세션만으로 실행할 수 없고, 정확한 `INLET_AUDIT_RETENTION_SECRET`이 필요합니다.

환경값:

```text
INLET_AUDIT_RETENTION_DAYS=730
INLET_AUDIT_RETENTION_BATCH_LIMIT=1000
INLET_AUDIT_RETENTION_SECRET=<충분히 긴 별도 랜덤 문자열>
```

정책:

- 기본 보존기간: 730일
- 최소 보존기간: 365일
- 최대 보존기간: 3,650일
- 실행당 기본 삭제 상한: 1,000행
- 실행당 최대 삭제 상한: 5,000행
- 오래된 행부터 제한 수만 삭제
- `audit.retention_*` 자체 실행 기록은 자동 삭제 대상에서 제외
- `dryRun: true` 요청은 대상 건수만 계산

자동 실행:

```text
.github/workflows/audit-retention.yml
```

매월 1일 UTC 03:17에 실행되며 수동 dry-run도 지원합니다.

GitHub 설정:

- Secret: `PAGERO_AUDIT_RETENTION_SECRET`
- 선택 Variable: `PAGERO_AUDIT_RETENTION_URL`

GitHub Secret은 운영의 `INLET_AUDIT_RETENTION_SECRET`과 같은 값이어야 합니다. Secret이 없으면 workflow는 `skipped-live`로 종료하며 운영 완료로 간주하지 않습니다.

## 프로젝트 운영 API

```text
PATCH /api/admin/projects/:id/status
```

지원 조작:

- `pause`
- `restore`
- `archive`

동일 상태 재요청은 DB와 감사 로그를 중복 변경하지 않습니다.

## 운영 확인

1. 일반 계정으로 `/api/admin/summary`, `/api/admin/audit` 요청 시 403인지 확인합니다.
2. 위조한 `superadmin` 역할도 403인지 확인합니다.
3. 허용된 플랫폼 마스터는 200인지 확인합니다.
4. 회원가입·로그인·프로필·비밀번호·이메일 변경 이벤트를 확인합니다.
5. 이메일 변경 후 이전 세션이 거부되고 새 세션이 정상인지 확인합니다.
6. 이메일 변경 감사 행에 이메일·비밀번호·인증 코드 원문이 없는지 확인합니다.
7. `/admin/audit`에서 계정 정지·복원 후 대상 계정 로그인 차단·복원을 확인합니다.
8. 본인·플랫폼 마스터 계정 상태 변경이 차단되는지 확인합니다.
9. 매니저와 소유권 이전 이벤트를 확인합니다.
10. 페이지 중지 시 공개 주소가 내려가고 복원 시 다시 노출되는지 확인합니다.
11. 감사 조회 응답에 원본 IP·User-Agent가 없는지 확인합니다.
12. 보존 workflow를 먼저 dry-run으로 실행해 대상 건수를 확인합니다.
13. 실제 실행 후 삭제 상한과 `audit.retention_completed` 행을 확인합니다.
14. 일반 운영자 세션만으로 보존 엔드포인트를 실행할 수 없는지 확인합니다.

## QA

```bash
npm run admin:audit:qa
npm run auth:qa
npm run auth:email:qa
npm run api:functions:qa
npm run api:security:qa
npm run qa:all
```

`admin:audit:qa` 검증 범위:

- 매니저 변경 이벤트 분리
- 비밀번호·토큰·세션 자동 마스킹
- 이메일 변경 인증·세션 회전·원문 비저장 계약
- 플랫폼 관리자 계정 정지·복원 안전장치
- 프로젝트 pause/restore 정책
- 감사 보존기간·삭제 상한·전용 비밀키
- workflow 비밀값 비출력
- `/admin/audit` noindex·CSP·비밀값 비노출
- 역할 문자열 관리자 우회 차단

최종 구현 QA 증빙:

- implementation commit: `21871a9af227672ded641de19a0da5f1db086d37`
- workflow run: `30703735200`
- full offline QA: success
- public landing browser regression: success
- authenticated editor browser regression: success
- form and reservation browser regression: success

## 배포 상태 구분

- 코드 완료: 브랜치에 구현 존재
- QA 완료: 정적·런타임·전체·브라우저 QA 통과
- 병합 완료: `main` 반영
- 배포 완료: 운영 Pages Functions 반영
- 운영 검증 완료: 실제 계정·D1·워크플로로 확인

브랜치 코드, mock QA 또는 `skipped-live` 결과만으로 운영 검증 완료라고 기록하지 않습니다.
