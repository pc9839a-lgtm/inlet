# CallTag 외부 문의 통합 수신 — 구현 현황 / 운영 인수인계

- 기준일: **2026-08-26**
- 서버 저장소: `pc9839a-lgtm/inlet`
- Android 저장소: `pc9839a-lgtm/calltag`
- 서버 runtime 정본: **PR #146** / `5b46f37ff8b2601555da22831cc6e42896e4dffa`
- Android release-candidate 정본: **PR #102** / `cd2d862860cd949160677de27bbe398a1737e98a`
- D1 migration-only 정본: **PR #123**
- D1 baseline audit / history-repair 준비 정본: **PR #149** / `60cbbca75c6cea34d69ad304753ebbfc8c5884c7`
- 운영 상태: **server stack 미병합 / D1 0010~0013 미적용 / baseline history write 미실행 / Play Console 미배포 / live real-device E2E 미실행**

> 구현 완료, 빌드 성공, 운영 활성화는 서로 다른 상태다. 이 문서는 현재까지의 개발·검증·운영 게이트를 한 번에 인수인계하기 위한 정본이다. 최종 판단은 항상 최신 GitHub 코드/PR/Actions 상태를 우선한다.

## 1. 제품 목표와 불변 계약

> **어디서 문의가 들어오든 콜태그로 받고, 바로 전화하고, 끝나면 자동으로 관리한다.**

현재 공식 대상 채널:

```text
PageRo / Meta Lead Ads / Google Forms / Generic Webhook / Direct API
→ Canonical Lead Intake
→ D1 customer + inquiry/event
→ PII-free FCM lead_available
→ Android signed pull
→ local CRM import
→ ACK(IMPORTED / REJECTED)
```

반드시 유지:
- FCM은 source of truth가 아니라 best-effort signal이다.
- FCM payload에 고객명/전화번호/이메일/문의내용 등 PII를 넣지 않는다.
- 실제 Lead 데이터는 로그인된 Android가 signed API로 pull한다.
- owner/tenant는 body/query/provider 입력을 신뢰하지 않고 session/API key/stored connection에서 서버가 결정한다.
- 같은 정규화 전화번호는 기존 customer를 재사용하되 문의마다 inquiry/event를 새로 만든다.
- dedupe/idempotency는 connection scope를 유지한다.
- provider credential/raw API key/Webhook secret은 평문 지속 저장하지 않는다.
- FCM 실패가 이미 수락·저장된 Lead를 rollback하면 안 된다.
- PageRo는 기존 전용 queue/SMS 경로를 유지하고 Universal pull에서는 `pagero`를 제외한다.
- 웹 진단은 delivery 상태를 바꾸지 않아야 한다.
- `GET /api/calltag/v1/leads`는 `ACCEPTED → DELIVERED`를 만들 수 있으므로 웹 진단용으로 재사용하지 않는다.
- shared API wrapper에서 모든 403을 일괄 세션 만료로 처리하지 않는다.
- 동적 provider/server 값은 `innerHTML`이 아니라 `textContent`로 렌더링한다.

## 2. 서버 개발 스택

```text
#117 → #118 → #119 → #121 → #122 → #125
→ #126 → #127 → #128 → #130 → #133 → #135
→ #136 → #139 → #140 → #141 → #142 → #143
→ #144 → #145 → #146
```

| PR | 역할 |
|---|---|
| #117 | Universal Lead Intake / Direct API / Android pull / ACK |
| #118 | Generic Webhook / raw sample / RFC6901 mapping / replay |
| #119 | Generic PII-free realtime FCM |
| #121 | Meta Lead Ads core / webhook / Graph fetch / encrypted credential |
| #122 | Meta OAuth Connect / Page 선택 / leadgen subscribe |
| #125 | Meta connection health |
| #126 | Unified `/connect` hub |
| #127 | Webhook sample mapping UX |
| #128 | read-only Integration Activity |
| #130 | guarded real-path E2E harness |
| #133 | Direct API guide |
| #135 | Generic Webhook guide |
| #136 | Connect mobile/accessibility/risk UX |
| #139 | E2E summary isolation + failure audit |
| #140 | Webhook mapper 한국어 오류 UX |
| #141 | hidden asset chain 제거 |
| #142 | mapper array-index/MutationObserver binding 제거 |
| #143 | body-wide MutationObserver 제거 |
| #144 | lifecycle action 세션 만료 복구 통일 |
| #145 | auth reset 시 one-time secret/OAuth transient state 삭제 |
| #146 | Google Forms bridge + Naver/Kakao placeholder 제거 |

서버 최신 핵심 QA:
- #146 QA `32844885779` — 전체 SUCCESS
- production deploy workflow는 skipped
- 따라서 **코드는 준비됐지만 production runtime에 반영된 상태는 아니다.**

## 3. `/connect`와 채널별 구현 상태

### PageRo
- 기본 채널
- 기존 PageRo 전용 queue/SMS 자동화 유지
- canonical dual-write가 있더라도 Android Universal pull에서는 `excludeSourceType=pagero`
- 동일 문의가 PageRo legacy + Universal 양쪽에서 중복 import되지 않게 유지

### Meta Lead Ads
- OAuth login
- managed Page 선택
- leadgen subscribe
- 연결/재연결/해제
- 권한/토큰/최근 lead/webhook health
- provider access token browser 노출 금지
- 운영 단계에서 Meta App Dashboard / App Review / Live 설정 필요

필요 env:
```text
CALLTAG_PROVIDER_CREDENTIAL_KEY
CALLTAG_META_APP_SECRET
CALLTAG_META_WEBHOOK_VERIFY_TOKEN
CALLTAG_META_GRAPH_VERSION
CALLTAG_META_APP_ID
CALLTAG_META_OAUTH_REDIRECT_URI
optional CALLTAG_META_OAUTH_SCOPES
```

OAuth callback:
```text
https://calltag.pagero.kr/api/calltag/v1/meta/oauth/callback
```

Webhook:
```text
https://calltag.pagero.kr/api/calltag/v1/meta/webhook
```

### Google Forms
현재 제품 구현은 **Google Apps Script → Generic Webhook bridge**다.

사용 흐름:
1. `/connect → Google Forms`
2. Google Forms용 Webhook 생성
3. 생성 직후 1회 표시되는 URL 복사
4. 제공 Apps Script 붙여넣기
5. `<YOUR_CALLTAG_WEBHOOK_URL>`만 실제 URL로 교체
6. `installCallTag()` 1회 실행
7. installable `onFormSubmit` trigger 생성
8. 테스트 응답 제출
9. Webhook Mapper에서 전화번호 field 지정
10. 이후 제출은 기존 canonical intake로 유입

계약:
- `FormResponse.getItemResponses()` → nested `answers`
- `response.getId()` → `Idempotency-Key`
- `source=google_forms`
- form id/title, response id, submitted_at 포함
- 실제 Webhook secret URL을 공개 저장소/예제/browser storage에 남기지 않음
- 별도 server route / 별도 D1 migration 없음

Google Forms native API + Pub/Sub 방식은 **현재 제품 구현이 아니다.**

### Generic Webhook
- `POST /api/calltag/v1/hooks/{endpointKey}`
- create / rotate / revoke
- raw retention 1~30일
- sample 최대 5건
- RFC6901 mapping
- phone 필수
- mapping save / raw replay
- mapping 오류는 202로 수락 후 확인 가능
- endpoint/body/query owner를 신뢰하지 않음

Idempotency header 우선순위:
```text
Idempotency-Key
X-Webhook-Id
X-Delivery-Id
X-Request-Id
X-Event-Id
payload SHA-256 fallback
```

### Direct API
- `POST /api/calltag/v1/leads`
- Bearer auth
- key create / rotate / revoke
- raw key 1회 표시
- connection-scoped idempotency
- body 최대 256 KB

### Activity / Diagnostics
- `GET /api/calltag/v1/activity`
- owner-scoped, SELECT-only
- 최근 7일 수신/전달/ACK 요약
- source/status filter
- manual refresh
- failure audit에 name/phone/email/content 저장 금지
- `calltag_e2e_test`는 운영 summary에서 제외

### E2E
- 기본 disabled
- `CALLTAG_E2E_TEST_ENABLED=1`일 때만 생성
- confirm phrase + 테스트 전화번호 필요
- 실제 canonical intake → FCM → Android pull/import/ACK 경로를 사용

### 제외 채널
- Naver 제거
- Kakao 제거
- UI에서 `준비 중` 채널로 다시 노출하지 않는다.

## 4. 서버 핵심 API

Universal Lead:
```text
POST /api/calltag/v1/leads
GET  /api/calltag/v1/leads
POST /api/calltag/v1/leads/ack
```

Generic Webhook:
```text
POST /api/calltag/v1/hooks/{endpointKey}
GET|POST|PATCH /api/calltag/v1/connections
GET /api/calltag/v1/connections/{id}/samples
```

Meta:
```text
/api/calltag/v1/meta/connections
/api/calltag/v1/meta/health
/api/calltag/v1/meta/webhook
/api/calltag/v1/meta/oauth/start
/api/calltag/v1/meta/oauth/callback
/api/calltag/v1/meta/oauth/session
/api/calltag/v1/meta/oauth/complete
```

Diagnostics:
```text
GET /api/calltag/v1/activity
GET|POST /api/calltag/v1/e2e
```

## 5. Android 구현 정본

### PR #100 — Universal Lead realtime sync
- HEAD `e1aeb17d40bd9ae3735d8fa1b7217242e81cdade`
- CI `32762593463` SUCCESS
- 당시 app version `0.44.45` / code `2026082101`

구현:
- generic `lead_available` FCM
- legacy `pagero_lead_available` 유지
- signed pull
- 50/page, 최대 4 page/run
- eventId local receipt idempotency
- 같은 전화번호 existing customer 재사용
- 신규 고객 생성
- CRM 저장 후 receipt → ACK
- invalid lead → REJECTED
- startup/foreground safety sync
- PageRo Universal pull 제외

### PR #101 — E2E 고객 오염 방지
- HEAD `6324fd7bc80dabeaaf8d2b389b70f55b2ff1737f`
- CI `32809350582` SUCCESS

`source.type=calltag_e2e_test`일 때:
- 실제 pull/import/ACK 수행
- 테스트 번호가 기존 실고객과 겹쳐도 source/memo/last-contact/updated-at을 덮지 않음
- interaction은 `CALLTAG_E2E_TEST`로 구분

### PR #102 — visible external lead UI + v0.44.46 release candidate
- URL: `pc9839a-lgtm/calltag#102`
- 상태: open / mergeable
- base: `agent/calltag-v04422-billing-live`
- HEAD: `cd2d862860cd949160677de27bbe398a1737e98a`
- versionName: **`0.44.46`**
- versionCode: **`2026082601`**
- package: `kr.pagero.calltag`

#102는 release base 위에 #100 + #101 + visible UI를 함께 포함한다.

새로 사용자에게 보이는 UI:
- `더보기` 최상단 `외부 문의 연동`
- 전용 `외부 문의 연동` 화면
- 로그인/앱 수신 상태 표시
- `지금 문의 확인` 버튼 → 실제 `UniversalLeadSyncManager` 강제 동기화
- sync broadcast 결과로 신규/기존고객/확인필요 건수 표시
- 로컬 CRM 출처 기록 고객 수 표시
- PageRo / Meta Lead Ads / Google Forms / Generic Webhook / Direct API 카드
- `웹에서 연동 설정 열기` → 시스템 브라우저에서 CallTag Connect 오픈
- FCM PII-free → signed pull → CRM 저장 → ACK / eventId 중복방지 설명

안전 계약:
- WebView 사용 안 함
- Connect는 HTTPS 시스템 브라우저로 오픈
- PageRo legacy 경로 유지
- FCM PII 없음
- 로그인 세션으로 pull
- CRM save/receipt 후 ACK
- #101 E2E 고객 보호 유지

## 6. Android v0.44.46 빌드 / AAB 증적

GitHub Actions:
- workflow: `Build CallTag Play Internal`
- run ID: **`32910779254`**
- run number: **`#2551`**
- result: **SUCCESS**

성공한 주요 단계:
- Universal Lead Android contract check
- Play release contract / version 확인
- Java 17 / Gradle / Android 16 SDK
- production Firebase BuildConfig 존재 확인
- 기존 stable Play upload key 검증
- debug APK build
- **signed release AAB build**
- release file 검증
- AAB artifact upload
- debug APK artifact upload

AAB artifact:
- artifact id: `9586513397`
- artifact name: `calltag-v0.44.46-play-internal-aab`
- artifact ZIP SHA-256: `77b82917e8139f332d7e09738d26fd96008c7fee70a96687d2e90cb48623ea5b`

추출된 실제 Play Console 업로드용 AAB:
- 파일명: `CallTag-v0.44.46-code2026082601.aab`
- 크기: `5,326,805 bytes`
- SHA-256: **`43f5a29334915550b2999015d5773d4f5946681f8601195d552bcca06d3fb5a7`**

중요:
- workflow의 `Upload Google Play internal AAB`는 GitHub Actions artifact 업로드 단계다.
- **Play Console에 자동 배포된 것은 아니다.**
- 현재 AAB는 Play Console 내부 테스트에 올릴 준비가 완료된 release candidate다.

## 7. D1 migration 상태

Migration-only 정본: **PR #123**

```text
0010_calltag_universal_lead_intake.sql
0011_calltag_generic_webhook_mapper.sql
0012_calltag_meta_lead_ads.sql
0013_calltag_meta_oauth.sql
```

#120은 superseded이므로 merge/apply 금지.

### 7.1 Cloudflare access 문제 — 해결됨
처음 live preflight는 403/provider code 7403으로 실패했다.

이후 production GitHub Environment에 least-privilege D1 Read credential/account 설정을 맞춘 뒤 같은 preflight를 재실행했고:
- status: `verified-live`
- DB: `inlet-prod`
- writeRequested: `false`
- gateErrors: `[]`
- secretValuesIncluded: `false`

즉 **Cloudflare 계정/토큰/권한 blocker는 해결**됐다.

### 7.2 실제 blocker — migration history 부재
read-only preflight에서:
- `migrationHistoryAvailable=false`
- `remoteAppliedMigrationsBefore=[]`

그 결과 로컬 runner는 0001~0013 전체를 pending으로 보았다.

하지만 production에는 이미 다음 계열 schema가 존재했다.
- core accounts/projects/pages/leads/events
- auth_email_verifications
- calllink profiles/entitlements
- calltag_pagero_leads
- project_integrations
- calltag_push_devices
- billing/referral/partner tables
- 기타 0001~0009 schema

따라서 0001~0009를 무작정 다시 실행하면 안 된다.

## 8. PR #149 — legacy baseline audit와 baseline history repair 준비

PR #149:
- title: `ops(calltag): audit legacy D1 baseline before migrations`
- base: `ops/calltag-migrations-0010-0013-20260825`
- current HEAD: **`60cbbca75c6cea34d69ad304753ebbfc8c5884c7`**
- open / mergeable

### 8.1 Read-only baseline audit
`scripts/d1-baseline-audit.mjs`가 0001~0009 SQL을 기준으로 기대 schema를 계산하고 production D1에는 read-only query만 수행한다.

검사 대상:
- tables
- columns
- column type
- PK
- NOT NULL
- indexes
- index target table
- `d1_migrations` 존재 여부

production query는 `sqlite_schema`와 `PRAGMA table_info` 중심이며 schema write를 수행하지 않는다.

live manual `preflight` 실행이 SUCCESS했고, audit가 mismatch 시 non-zero exit하도록 설계되어 있으므로 현재 안전 결론은:

> **운영 0001~0009 실제 schema는 local legacy migration baseline과 호환된다.**

단, 당시 artifact upload는 hidden path 때문에 누락되었고 이후 workflow에 `include-hidden-files: true`를 추가해 증적 업로드를 수정했다.

### 8.2 Baseline history repair 코드 — 준비 완료, production 미실행
현재 #149에는 다음 guarded writer도 포함된다.
- `scripts/d1-baseline-history-write.mjs`
- `scripts/d1-baseline-history-write-quality-check.mjs`

현재 HEAD QA:
- run `32855394981`
- run number `#1997`
- result: **SUCCESS**
- production deploy workflows: skipped

writer가 기록 대상으로 고정한 0001~0009 exact filename/order:
```text
0001_inlet_core.sql
0002_lead_dedupe_fields.sql
0003_event_dimensions.sql
0004_lead_blocked_submissions.sql
0005_auth_email_verifications.sql
0006_calllink_app_accounts.sql
0006_calltag_pagero_lead_queue.sql
0006_project_integrations.sql
0008_calltag_realtime_push.sql
0009_unified_billing_referral.sql
```

writer는 **0001~0009 DDL을 재실행하지 않는다.**

수행하려는 write는 Wrangler 호환 history table을 만들고 위 파일명을 기록하는 baseline history repair다.

핵심 write gate:
- mode는 `preflight`만 허용
- `allow_writes=true` 필요
- approval phrase exact match 필요:
  `I_APPROVE_D1_BASELINE_0001_0009`
- branch exact match 필요:
  `ops/calltag-d1-baseline-audit-20260825`
- `expected_pending`은 baseline write 중 비워둬야 함
- 직전 read-only audit가 `baseline-compatible`이어야 함
- audit migration list가 exact 0001~0009와 일치해야 함
- local 0001~0009 목록이 승인 후 변했으면 중단
- write 직전 `d1_migrations`가 갑자기 생기면 중단
- write 전 Cloudflare D1 Time Travel bookmark 필수
- write 후 `d1_migrations` rows가 exact baseline과 일치해야 함
- write 후 pending이 exact 0010~0013이어야 함
- post-write bookmark 기록
- schema replay 없음
- 0010~0013 apply 없음
- 자동 restore 없음
- rollback은 별도 승인 필요
- evidence에 secret 값 포함 금지

### 8.3 아직 하지 않은 것
현재까지 production D1에 대해:
- baseline audit read-only 실행: **완료**
- baseline history writer 코드/QA: **완료**
- `d1_migrations` 생성/insert: **미실행**
- 0010~0013 apply: **미실행**
- production D1 write: **0건 유지**

현재 `CallTag D1 Preflight` credential은 D1 Read 용도다. baseline history repair를 실제 실행하는 순간에는 의도적으로 D1 write 권한이 있는 credential이 필요하지만, **코드가 준비됐다는 이유만으로 지금 D1 Edit를 부여하거나 실행하면 안 된다.**

## 9. 현재 정확한 운영 게이트

완료:
- [x] server Universal Lead / Webhook / Meta / Google Forms 구현
- [x] PII-free FCM + Android pull/ACK 구현
- [x] Android E2E 실고객 오염 방지
- [x] visible Android 외부 문의 UI 구현
- [x] Android v0.44.46 / code 2026082601 release AAB build
- [x] signed AAB build/verification SUCCESS
- [x] Cloudflare read access blocker 해결
- [x] production D1 read-only preflight `verified-live`
- [x] migration history 부재 원인 확인
- [x] production 0001~0009 read-only baseline compatibility audit SUCCESS
- [x] baseline history repair 코드 작성 및 QA SUCCESS

아직 운영 미완료:
- [ ] baseline history repair production write 승인/실행
- [ ] repair 후 read-only preflight 재실행
- [ ] pending exact 0010~0013 확인
- [ ] backup 검증
- [ ] 별도 승인 후 0010~0013 apply
- [ ] server stacked runtime 최신 main 기준 merge/retarget 검토
- [ ] server production rollout
- [ ] Direct API real activity
- [ ] Generic Webhook real activity
- [ ] Google Forms real submission E2E
- [ ] Meta production env/App Review/real lead
- [ ] Android #102 merge/release decision
- [ ] Play Console 내부 테스트 업로드
- [ ] real-device E2E
- [ ] Play rollout

## 10. 이후 rollout 순서 — 이 순서를 바꾸지 않는다

1. #149 baseline history repair 코드 최종 리뷰
2. production write 직전 backup/Time Travel 복구 수단 재확인
3. 별도 write-capable D1 credential 준비
4. **명시적 최종 승인 후에만** baseline history repair 실행
5. 즉시 read-only preflight 재실행
6. remote applied가 exact 0001~0009인지 확인
7. pending이 exact 다음 4개인지 확인
   - `0010_calltag_universal_lead_intake.sql`
   - `0011_calltag_generic_webhook_mapper.sql`
   - `0012_calltag_meta_lead_ads.sql`
   - `0013_calltag_meta_oauth.sql`
8. encrypted backup / rollback evidence 확인
9. **별도 승인** 후 #123의 0010~0013 apply
10. post-migration verification
11. server stack 최신 main 기준 재검토 후 rollout
12. Direct API 실제 문의 수신
13. Generic Webhook sample → mapping → canonical intake
14. Google Forms 실제 제출 → Apps Script → Webhook → mapping → canonical intake
15. Meta production 설정 + real Lead Ads 수신
16. Android #102 release candidate 검증
17. Play Console 내부 테스트 업로드
18. 실기기 FCM → pull → CRM → ACK E2E
19. same-phone 재문의 / PageRo 중복 방지 / E2E 보호 회귀 확인
20. 최종 Play rollout

과거 QA success만 보고 stacked PR을 연속 merge하지 않는다. 운영 merge 직전 최신 diff/mergeable/check를 다시 본다.

## 11. Definition of Done

- [ ] production migration history가 0001~0009 exact baseline을 반영
- [ ] repair 직후 pending이 exact 0010~0013
- [ ] production D1 0010~0013 정상 적용
- [ ] server runtime 최신 stack production 반영
- [ ] Direct API 실제 문의 수신
- [ ] Webhook sample → mapping → replay → canonical intake
- [ ] Google Forms 실제 제출 → Apps Script → Webhook → canonical intake
- [ ] Meta OAuth 실제 연결 + real lead 수신
- [ ] FCM PII-free 확인
- [ ] Android signed pull/import/ACK 확인
- [ ] same-phone 재문의 customer 중복 없음
- [ ] PageRo legacy + Universal 중복 import 없음
- [ ] E2E가 실고객 metadata 오염하지 않음
- [ ] activity/failure audit로 장애 지점 확인 가능
- [ ] auth 경계 이후 one-time secret 재노출 없음
- [ ] Android v0.44.46 외부 문의 UI 실기기 확인
- [ ] Play Console 내부 테스트 → 회귀 → rollout 완료

## 12. 금지사항

- #120 merge 금지
- #123 즉시 merge/apply 금지
- 0001~0009 DDL 재실행 금지
- read-only audit 성공만으로 history write 자동 실행 금지
- explicit approval 없이 production D1 write 금지
- baseline history repair와 0010~0013 apply를 한 번에 묶지 않음
- backup/Time Travel 확인 없이 write 금지
- pending exact-set 확인 없이 0010~0013 apply 금지
- API token 원문을 채팅/문서/PR/log/artifact에 붙이지 않음
- FCM PII 금지
- FCM을 source of truth로 변경 금지
- server schema보다 Android production rollout을 먼저 하지 않음
- Naver/Kakao를 다시 연결 가능/준비 중 채널로 노출하지 않음
- Google Forms native API/PubSub가 구현된 것처럼 표시하지 않음
- 테스트 때문에 기존 실고객 metadata를 덮지 않음
- body-wide MutationObserver / hidden asset chain / array-index binding 재도입 금지
- shared `api()`에서 모든 403 자동 로그아웃 금지
- auth reset 후 raw secret/OAuth state 보존 금지
- GitHub artifact build 성공을 Play Console 배포 완료로 표시하지 않음
- mock/QA 성공만으로 real production E2E 완료 처리하지 않음

## 13. 현재 인수인계 한 줄

**서버·Android 구현과 v0.44.46 서명 AAB까지 준비됐고, production D1은 read-only baseline 검증까지 안전하게 통과했다. 다음 실질 단계는 0001~0009 DDL 재실행이 아니라, 별도 승인된 baseline migration-history repair이며, 그 write가 끝난 뒤 pending이 정확히 0010~0013인지 확인한 다음에만 실제 migration apply로 넘어간다.**
