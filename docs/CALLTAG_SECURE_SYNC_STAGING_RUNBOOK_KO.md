# CallTag 암호화 동기화 Staging 실행서

## 목적

CallTag 고객 데이터 서버 동기화를 운영 환경과 완전히 분리된 Cloudflare Pages·D1에서 먼저 검증한다.

검증 대상은 다음과 같다.

- 서로 다른 두 계정의 데이터가 섞이지 않는지
- 동일한 `entityId`를 두 계정이 사용해도 각 계정 데이터만 조회되는지
- 앱 재설치 상황을 가정한 새 기기 `bootstrap` 복구가 되는지
- 한 계정의 삭제 tombstone이 다른 계정 데이터에 영향을 주지 않는지
- 기기 목록이 계정별로 격리되는지

운영 flag는 계속 0으로 유지한다.

- `CALLTAG_SECURE_SYNC_ENABLED=0`
- `CALLTAG_SYNC_RETENTION_ENABLED=0`

운영 D1, 운영 Pages 프로젝트, 운영 Secret에는 이 절차를 적용하지 않는다.

---

## 1. 전용 Cloudflare 리소스

이 작업은 기존 `inlet` Pages 프로젝트와 `inlet-prod` D1을 재사용하지 않는다.

권장 이름:

- Pages: `inlet-calltag-staging`
- D1: `inlet-calltag-staging`

두 이름 모두 반드시 `staging`을 포함해야 한다. 저장소의 staging config 생성기도 이 조건을 강제한다.

### D1 생성

```bash
npx wrangler d1 create inlet-calltag-staging --location apac
```

출력된 D1 UUID를 별도로 보관한다. 저장소나 문서에 실제 UUID를 직접 기록하지 않는다.

### Pages 프로젝트 생성

```bash
npx wrangler pages project create inlet-calltag-staging --production-branch staging
```

기존 `inlet` 프로젝트에 preview branch만 추가하는 방식이 아니라 별도의 Pages 프로젝트를 사용한다.

---

## 2. GitHub Environment

저장소 Settings에서 `calltag-staging` GitHub Environment를 만든다.

가능하면 Required reviewer를 지정한다. staging workflow는 이 Environment를 통과해야만 실행된다.

### Environment variables

| 이름 | 값 예시 | 설명 |
|---|---|---|
| `CALLTAG_STAGING_PAGES_PROJECT` | `inlet-calltag-staging` | 전용 Pages 프로젝트 |
| `CALLTAG_STAGING_D1_DATABASE_NAME` | `inlet-calltag-staging` | 전용 D1 이름 |
| `CALLTAG_STAGING_D1_DATABASE_ID` | D1 UUID | 전용 D1 식별자 |
| `CALLTAG_STAGING_BASE_URL` | `https://inlet-calltag-staging.pages.dev` | smoke 대상 주소 |
| `CALLTAG_STAGING_ALLOW_CUSTOM_HOST` | 공란 | 전용 커스텀 staging 도메인일 때만 아래 확인값 사용 |

전용 커스텀 호스트를 사용하는 경우에만 다음 값을 입력한다.

```text
CALLTAG_STAGING_CUSTOM_HOST_CONFIRMED
```

`pagero.kr`, `www.pagero.kr`, `calltag.pagero.kr`, `inlet.pages.dev`는 smoke script에서 차단된다.

### Environment secrets

| 이름 | 설명 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 전용 staging Pages 배포·D1 migration 권한 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `CALLTAG_STAGING_SESSION_SECRET` | staging 로그인 세션 서명키 |
| `CALLTAG_STAGING_DATA_ENCRYPTION_KEY` | AES-256-GCM 키, base64 32바이트 |
| `CALLTAG_STAGING_DATA_SEARCH_KEY` | HMAC 검색키, base64 32바이트 |
| `CALLTAG_STAGING_ACCOUNT_A_EMAIL` | 검증 완료된 전용 테스트 계정 A |
| `CALLTAG_STAGING_ACCOUNT_A_PASSWORD` | 테스트 계정 A 비밀번호 |
| `CALLTAG_STAGING_ACCOUNT_B_EMAIL` | 검증 완료된 전용 테스트 계정 B |
| `CALLTAG_STAGING_ACCOUNT_B_PASSWORD` | 테스트 계정 B 비밀번호 |

키 생성 예시:

```bash
openssl rand -base64 48
openssl rand -base64 32
openssl rand -base64 32
```

첫 번째 값은 `CALLTAG_STAGING_SESSION_SECRET`, 두 번째와 세 번째 값은 암호화키와 검색키로 각각 사용한다.

세 키는 서로 다른 값이어야 한다. 출력값을 저장소, PR, Action 로그, 메신저에 붙여 넣지 않는다.

---

## 3. workflow 안전장치

workflow 파일:

```text
.github/workflows/calltag-secure-sync-staging.yml
```

자동 실행되지 않는다. `workflow_dispatch`로만 실행한다.

실행 시 확인 문구를 정확히 입력해야 한다.

```text
CALLTAG_STAGING_ONLY
```

세 작업은 각각 별도로 선택한다.

1. `apply_migrations`: 전용 staging D1에 migration 적용
2. `deploy_staging`: 전용 staging Pages에 Secret 등록 후 배포
3. `run_smoke`: 두 계정 격리·재설치 복구 smoke 실행

처음에는 `apply_migrations=true`, `deploy_staging=true`, `run_smoke=false`로 실행한다.

배포가 완료된 뒤 staging 화면에서 테스트 계정 두 개를 생성하고 이메일 검증까지 완료한다. 두 계정은 실제 고객이나 운영자 계정을 사용하지 않는다.

계정 Secret 등록 후 `apply_migrations=false`, `deploy_staging=false`, `run_smoke=true`로 다시 실행한다.

migration·배포·smoke를 한 번에 실행할 수도 있지만, 최초 구성에서는 계정 준비 단계를 분리하는 편이 안전하다.

---

## 4. staging 배포 구성

staging config는 저장소에 실제 D1 UUID를 기록하지 않고 실행 중 임시 생성된다.

```text
scripts/calltag-secure-sync-staging-config.mjs
```

생성되는 staging 설정:

- `CALLTAG_SECURE_SYNC_ENABLED=1`
- `CALLTAG_SYNC_RETENTION_ENABLED=0`
- `CALLTAG_STAGING_ENVIRONMENT=1`
- 전용 staging D1만 `DB`에 연결
- 운영 R2 binding 제외
- 이메일 provider는 staging용 `mock`

암호화키·검색키·세션키는 config 파일의 평문 `vars`에 넣지 않는다. Pages Secret으로만 등록한다.

D1 migration은 `wrangler d1 migrations apply ... --remote`로 실행된다. CI 환경에서는 Cloudflare가 confirmation prompt를 생략하고 migration 단위 rollback과 backup을 수행한다.

---

## 5. 두 계정 smoke 검증

실행 파일:

```text
scripts/calltag-secure-sync-staging-smoke.mjs
```

검증 순서:

1. 계정 A와 B를 각각 로그인한다.
2. 두 계정의 `ownerId`가 다른지 확인한다.
3. 같은 `entityId`로 서로 다른 고객 payload를 저장한다.
4. 각 계정의 `pull` 결과가 자기 payload만 포함하는지 확인한다.
5. 새 기기 식별자로 `bootstrap`을 호출해 재설치 복구를 검증한다.
6. 각 계정 기기 목록에 현재 복구 기기가 나타나는지 확인한다.
7. 계정 A를 삭제 처리하고 계정 B 데이터가 유지되는지 확인한다.
8. 테스트 데이터는 마지막에 tombstone으로 정리한다.

성공 출력 핵심값:

```json
{
  "ok": true,
  "ownersDistinct": true,
  "sameEntityIdIsolated": true,
  "reinstallBootstrapVerified": true,
  "tombstoneIsolationVerified": true,
  "cleanup": "tombstones-written"
}
```

테스트 계정의 이메일·비밀번호·세션값·실제 `ownerId`는 출력하지 않는다.

---

## 6. 실패 시 판정

### migration 실패

- staging D1 이름과 UUID가 서로 일치하는지 확인한다.
- API Token에 D1 edit 권한이 있는지 확인한다.
- 운영 D1로 대상을 변경해 재시도하지 않는다.

### Pages Secret 등록 실패

- 전용 Pages 프로젝트가 먼저 생성됐는지 확인한다.
- Pages edit 권한을 확인한다.
- 키 형식이 base64 32바이트인지 확인한다.

### 로그인 실패

- 계정 A·B가 staging D1에 생성됐는지 확인한다.
- 이메일 검증 완료 상태인지 확인한다.
- staging 배포에 사용한 `INLET_SESSION_SECRET`이 중간에 변경되지 않았는지 확인한다.

### 계정 격리 실패

즉시 진행을 중단한다.

- PR을 병합하지 않는다.
- 운영 flag를 켜지 않는다.
- staging D1을 보존해 문제 레코드를 조사한다.
- `owner_id` 조건, AAD, session owner 결정 경로를 다시 검토한다.

### 복구 실패

- `bootstrap`의 `snapshotCursor`와 `followUp.cursor`를 확인한다.
- 새 기기 등록과 rate limit 상태를 확인한다.
- 운영 적용을 중단한다.

---

## 7. 완료 기준

다음 조건이 모두 충족돼야 staging 1차 검증 완료로 본다.

- staging 전용 Pages·D1 사용
- 운영 config flag 0 유지
- migration 성공
- staging Pages 배포 성공
- 두 계정 로그인 성공
- 동일 entity ID 계정 격리 성공
- 새 기기 bootstrap 재설치 복구 성공
- tombstone 계정 격리 성공
- 기기 목록 owner 격리 성공
- Action 로그에 Secret·세션·고객 원문 미노출

이후 단계는 Android outbox·bootstrap 클라이언트를 staging URL에만 연결해 실제 앱 삭제·재설치 복구를 검증하는 것이다.
