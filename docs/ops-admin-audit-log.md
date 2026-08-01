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

- `project.archived`

현재 삭제 동작은 프로젝트를 실제 삭제하지 않고 `archived` 상태로 전환합니다. 감사 기록에는 이전 상태, 다음 상태, 주소 슬러그, 처리 시각을 남깁니다.

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

## 운영 확인

1. 일반 계정으로 `/api/admin/summary`와 `/api/admin/audit` 요청 시 403인지 확인합니다.
2. 역할만 `superadmin`으로 위조한 일반 계정도 403인지 확인합니다.
3. 허용 이메일 운영자는 두 API에서 200을 받는지 확인합니다.
4. 회원가입·로그인·프로필 변경 후 계정 이벤트가 생성되는지 확인합니다.
5. 매니저 초대 발급·수락 후 초대 이벤트가 생성되는지 확인합니다.
6. 매니저 권한 변경·비활성화·삭제 후 해당 이벤트만 생성되는지 확인합니다.
7. 소유권 이전 요청·승인·거절·취소·완료 상태마다 정확한 이벤트가 생성되는지 확인합니다.
8. 페이지 삭제 처리 후 `project.archived`가 생성되고 프로젝트가 `archived` 상태인지 확인합니다.
9. 실패 로그인 기록에 비밀번호·토큰·세션이 없는지 확인합니다.
10. 조회 응답에 `ip`, `user_agent` 원문이 없는지 확인합니다.
11. 필터와 페이지네이션이 최신순으로 동작하는지 확인합니다.

## QA

```bash
npm run admin:audit:qa
npm run auth:qa
npm run auth:email:qa
npm run api:functions:qa
npm run api:security:qa
npm run qa:all
```

`admin:audit:qa`는 매니저 변경 전후 데이터를 직접 실행해 추가·권한 변경·상태 변경·삭제 이벤트가 각각 한 번씩 생성되는지 확인합니다.

## 배포 상태 구분

- 코드 완료: 감사 기록·관리자 미들웨어·조회 API가 브랜치에 존재
- QA 완료: 정적·런타임·전체 QA 통과
- 병합 완료: `main` 반영
- 배포 완료: 운영 Pages Functions 반영
- 운영 검증 완료: 실제 운영자/일반 계정으로 권한과 기록 확인

브랜치 코드나 mock QA만으로 운영 검증 완료라고 기록하지 않습니다.
