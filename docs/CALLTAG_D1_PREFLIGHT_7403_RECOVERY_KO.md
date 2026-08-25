# CallTag D1 Preflight 403 / 7403 복구 가이드

작성 기준: 2026-08-25

대상: `pc9839a-lgtm/inlet`의 `D1 Migration Safety`

## 현재 확인된 사실

CallTag Universal External Lead Intake용 D1 target은 `wrangler.jsonc`에 이미 선언되어 있다.

```text
binding: DB
database_name: inlet-prod
database_id: b68d3820-001f-4dbe-87cd-dc9fc0be17ee
```

따라서 `PAGERO_D1_DATABASE_NAME` / `PAGERO_D1_DATABASE_ID` GitHub Secret은 필수값이 아니라 override다. 비어 있으면 `wrangler.jsonc` 값을 사용한다.

반대로 override Secret이 존재하면서 `wrangler.jsonc`와 다른 경우에는 잘못된 production DB를 가리킬 위험이 있으므로 새 preflight가 실행을 차단한다.

## 2026-08-25 실패 run

Run:

```text
32797397018
```

Provider 응답:

```text
HTTP 403
Cloudflare code 7403
The given account is not valid or is not authorized to access this service
```

이 실행에서는 D1 write가 발생하지 않았다.

## 새 fail-fast 진단 순서

Migration history를 읽기 전에 다음을 순서대로 검증한다.

1. D1 target resolve
   - 환경 override가 있으면 `wrangler.jsonc`와 일치하는지 확인
   - 없으면 `wrangler.jsonc`를 정본으로 사용
2. Cloudflare API token verify
   - `/user/tokens/verify`
   - token status가 `active`여야 함
3. D1 database access verify
   - `GET /accounts/{account_id}/d1/database/{database_id}`
   - 현재 Account ID가 실제 `inlet-prod` 소유 계정인지 확인
   - token에 해당 account의 D1 Read 권한이 있는지 확인
4. 위 검증이 모두 성공한 경우에만 기존 migration history/pending 검사로 진행

결과는 아래 artifact에 남는다.

```text
.tmp-d1-migration-safety/d1-cloudflare-access-preflight.json
```

API token 원문은 evidence에 기록하지 않는다.

## 오류 코드 해석

### `CLOUDFLARE_API_TOKEN_INVALID`

Token 자체가 disabled/expired/invalid 상태다.

조치:

- GitHub `production` Environment의 `CLOUDFLARE_API_TOKEN` 확인
- 새 token을 만들 경우 secret 원문을 채팅/PR/로그에 붙이지 않음

### `CLOUDFLARE_D1_ACCOUNT_OR_PERMISSION_MISMATCH`

Token은 active지만 Account ID 또는 D1 권한이 맞지 않는다. 기존 7403은 이 범주로 분류한다.

확인:

- `CLOUDFLARE_ACCOUNT_ID`가 `inlet-prod`를 실제 소유한 계정인지
- API token resource scope가 같은 account인지
- preflight용 최소 D1 Read 권한이 있는지

### `CLOUDFLARE_D1_PERMISSION_DENIED`

선택한 account/database에 대한 D1 읽기가 거부됐다.

### `CLOUDFLARE_D1_DATABASE_NOT_FOUND`

`database_id`가 해당 account에 존재하지 않는다.

### `D1_CONFIG_OVERRIDE_MISMATCH`

GitHub Environment의 `PAGERO_D1_DATABASE_NAME` 또는 `PAGERO_D1_DATABASE_ID`가 현재 `wrangler.jsonc`와 다르다.

운영 DB를 의도적으로 변경하는 작업이 아니라면 override 값을 최신 정본과 맞추거나 제거한다.

## 다음 preflight 입력

운영 credential을 바로잡은 뒤:

```text
branch: ops/calltag-migrations-0010-0013-20260825
mode: preflight
expected_pending: 비움
allow_writes: false
approval_phrase: 비움
require_live: true
```

성공 조건은 `verified-live`이며, 그 다음 `pendingMigrationsBefore`를 직접 검토한다.

예상 대상은 현재 문서 기준 아래 4개지만, 실제 remote 결과가 최종 권위다.

```text
0010_calltag_universal_lead_intake.sql
0011_calltag_generic_webhook_mapper.sql
0012_calltag_meta_lead_ads.sql
0013_calltag_meta_oauth.sql
```

다르게 나오면 migration apply를 진행하지 않는다.

## 쓰기 단계

`backup-and-apply`는 read-only preflight 성공 후 별도 승인으로만 진행한다.

- main branch only
- 정확한 pending list
- `allow_writes=true`
- `I_APPROVE_D1_MIGRATIONS`
- 32자 이상 backup encryption key
- encrypted export 생성
- backup 직후 migration history 재확인
- 상태가 바뀌면 apply 중단

이 문서는 운영 쓰기 승인을 의미하지 않는다.
