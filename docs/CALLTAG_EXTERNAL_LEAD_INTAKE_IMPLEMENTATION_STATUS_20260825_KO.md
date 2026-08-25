# CallTag 외부 문의 통합 수신 — 구현 현황 / 운영 인수인계

- 기준일: **2026-08-25**
- 서버: `pc9839a-lgtm/inlet`
- Android: `pc9839a-lgtm/calltag`
- 서버 개발 정본: **PR #145** / `f7f17e71fdf0a34767683f58d510070759047bee`
- Android 안전 정본: **PR #101** / `6324fd7bc80dabeaaf8d2b389b70f55b2ff1737f`
- 운영 상태: **server stack 미병합 / D1 0010~0013 미적용 / Play 미배포 / live E2E 미실행**

> 구현 완료와 운영 활성화는 구분한다. 이 문서는 다음 개발자/AI가 현재 정본과 남은 운영 P0를 빠르게 파악하기 위한 handoff다.

## 1. 제품 목표와 불변 계약

> **어디서 문의가 들어오든 콜태그로 받고, 바로 전화하고, 끝나면 자동으로 관리한다.**

```text
PageRo / Direct API / Generic Webhook / Meta Lead Ads
→ Canonical Lead Intake
→ D1 customer + inquiry/event
→ PII-free FCM lead_available
→ Android signed pull
→ local CRM import
→ ACK(IMPORTED / REJECTED)
```

반드시 유지:
- FCM은 source of truth가 아니라 best-effort signal이다.
- FCM payload에 고객명/전화/이메일/문의내용을 넣지 않는다.
- 실제 Lead는 Android가 signed API로 pull한다.
- owner/tenant는 body/query가 아니라 session/API key/stored connection으로 서버가 결정한다.
- 동일 전화번호는 기존 customer를 재사용하고 inquiry event는 매번 새로 만든다.
- dedupe/idempotency는 connection scope를 유지한다.
- provider credential/raw API key/Webhook secret은 평문 지속 저장하지 않는다.
- FCM 실패가 이미 저장된 Lead를 rollback하면 안 된다.

## 2. 서버 개발 스택

```text
#117 → #118 → #119 → #121 → #122 → #125
→ #126 → #127 → #128 → #130 → #133 → #135
→ #136 → #139 → #140 → #141 → #142 → #143
→ #144 → #145
```

| PR | 역할 |
|---|---|
| #117 | Universal Lead Intake core / Direct API / pull / ACK |
| #118 | Generic Webhook / raw sample / RFC6901 mapping / replay |
| #119 | Generic PII-free realtime FCM |
| #121 | Meta Lead Ads core / webhook / Graph fetch / encrypted credential |
| #122 | Meta OAuth Connect / Page 선택 / leadgen subscribe |
| #125 | Meta connection health |
| #126 | Unified Connect Hub |
| #127 | Webhook sample mapping UX |
| #128 | read-only Integration Activity |
| #130 | guarded E2E harness |
| #133 | Direct API guide |
| #135 | Generic Webhook guide |
| #136 | Connect mobile/empty/accessibility/risk UX |
| #139 | E2E summary isolation + failure audit |
| #140 | Webhook mapper 한국어 오류 UX |
| #141 | hidden asset chain 제거 |
| #142 | Webhook index/MutationObserver binding 제거 |
| #143 | Connect body-wide MutationObserver 제거 |
| #144 | lifecycle action 세션 만료 복구 통일 |
| #145 | 세션 종료 시 transient secret/OAuth state 삭제 |

최근 핵심 QA:
- #141 `32811976994` — 5/5 SUCCESS
- #142 `32813001162` — 5/5 SUCCESS
- #143 `32813578519` — 5/5 SUCCESS
- #144 `32815649203` — 5/5 SUCCESS
- #145 `32816482799` — 5/5 SUCCESS
- production deploy workflows는 skipped.

## 3. 최근 구조/보안 정리

### #141 — explicit asset ownership
`public/call/connect/index.html`이 Connect 자산을 명시적으로 로드한다.

```text
hub.js
→ direct-api-guide.js
→ webhook-guide.js
→ connect-polish.js
→ webhook-mapper.js
→ activity.js
→ e2e.js
```

기능 JS가 다른 기능 JS/CSS를 몰래 로드하지 않는다.

### #142 — Webhook mapper deterministic binding
과거:
- DOM card index와 `webhookConnections[index]`를 같은 것으로 가정
- MutationObserver로 재렌더 추측

현재:
- `data-webhook-connection-id`
- `data-webhook-mapper-trigger`
- exact connection id lookup
- `calltag:webhooks-rendered`
- mapper 내부 MutationObserver 없음

### #143 — Connect UI explicit update events
과거 `document.body` 전체 subtree/class를 MutationObserver로 감시했다.

현재:
- 초기 enhance 1회
- click 기반 동기화
- 동적 renderer가 `calltag:connect-ui-updated` 발행
- Meta/Webhook/API/secret/activity/mapper/E2E 갱신 시에만 polish 재적용

### #144 — expired-session lifecycle recovery
다음 5개 액션이 세션 만료 401/403에서 로그인 화면으로 복귀하도록 통일됐다.
- Meta 연결 해제
- Webhook URL 교체
- Webhook 연결 해제
- API Key 교체
- API Key 폐기

공통 `api()`에서 모든 403을 자동 로그아웃으로 처리하지 않는다. E2E disabled 같은 의도된 403을 session expiry로 오인하면 안 된다.

### #145 — auth boundary secret cleanup
문제:
- `showSecret()`로 1회 표시한 Webhook URL/API Key가 `requireLogin()` 후에도 DOM에 남을 수 있었다.
- 같은 탭에서 다시 로그인하면 이전 세션 비밀값이 재노출될 위험이 있었다.
- Meta OAuth 임시 session id/page picker도 auth 경계를 넘을 수 있었다.

현재 `clearTransientAuthUi()`가 `requireLogin()`에서 호출된다.
- `rememberOauthSession('')`로 memory/sessionStorage OAuth id 삭제
- `webhookSecret` DOM 내용 삭제 + hidden base class 복구
- `apiSecret` DOM 내용 삭제 + hidden base class 복구
- transient ARIA role/label 삭제
- Meta page picker 숨김
- Meta page list 비움

shared `api()`의 403 의미 해석은 그대로 caller별로 유지한다.

## 4. `/connect` 현재 기능

### PageRo
- 기본 채널 표시
- 기존 PageRo 전용 delivery/SMS 경로 유지
- Android Universal pull에서는 `pagero` 제외

### Meta Lead Ads
- OAuth login
- managed Page 선택
- leadgen subscribe
- 연결/재연결/해제
- 권한/토큰 만료/최근 lead/webhook 상태
- 사용자 클릭 시 live health check
- provider token browser 노출 없음

### Generic Webhook
- create / rotate / revoke
- raw retention 1~30일
- sample 최대 5건
- mapper field 후보 + draft suggestion
- RFC6901 JSON Pointer
- phone 필수
- mapping save / raw replay
- cURL/sample JSON guide

### Direct API
- key create / rotate / revoke
- raw key 1회 표시
- `POST /api/calltag/v1/leads`
- Bearer auth
- idempotency
- request/response/error code guide

### Activity
- `GET /api/calltag/v1/activity`
- owner-scoped / SELECT-only
- 최근 7일 수신/전달/ACK 요약
- source/status filter
- manual refresh only
- failure audit에 고객 PII 없음
- `calltag_e2e_test`는 운영 summary 제외

### E2E
- 기본 disabled
- `CALLTAG_E2E_TEST_ENABLED=1`일 때만 생성
- confirm phrase + 사용자 입력 테스트 전화번호 필요
- canonical intake + PII-free FCM + Android pull/import/ACK 실제 경로 사용

Google Forms / Naver / Kakao는 connector 미구현이므로 **준비 중**으로만 표시한다.

## 5. 서버 핵심 API

Universal Lead:
```text
POST /api/calltag/v1/leads
GET  /api/calltag/v1/leads
POST /api/calltag/v1/leads/ack
```

주의: Android delivery `GET /leads`는 `ACCEPTED → DELIVERED` 상태를 변경할 수 있으므로 웹 진단 UI에서 조회용으로 재사용하지 않는다.

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

## 6. Android 정본

### PR #100 — Universal realtime sync
- HEAD `e1aeb17d40bd9ae3735d8fa1b7217242e81cdade`
- package `kr.pagero.calltag`
- versionName `0.44.45`
- versionCode `2026082101`
- CI `32762593463` SUCCESS

구현:
- `lead_available` FCM
- signed pull
- local receipt idempotency
- same-phone existing customer reuse
- new customer create
- `LEAD_INQUIRY / CALLTAG_LEAD`
- local save 후 ACK
- invalid lead REJECTED
- PageRo Universal pull 제외

### PR #101 — E2E 고객 오염 방지
- HEAD `6324fd7bc80dabeaaf8d2b389b70f55b2ff1737f`
- CI `32809350582` SUCCESS

`source.type=calltag_e2e_test`일 때:
- 실제 pull/import/ACK는 수행
- 기존 고객 source/memo/last-contact/updated-at을 테스트 값으로 덮지 않음
- E2E interaction은 `CALLTAG_E2E_TEST`로 식별

Play Console 배포는 하지 않았다.

## 7. D1 운영 side track

Migration-only 정본: **PR #123**
```text
0010_calltag_universal_lead_intake.sql
0011_calltag_generic_webhook_mapper.sql
0012_calltag_meta_lead_ads.sql
0013_calltag_meta_oauth.sql
```

**#120은 superseded. merge 금지.**

Preflight diagnostics: **PR #132**
- HEAD `d30ec6eb3b5e3123c72f821b3e3d50a1f44d0146`
- QA `32805506934` SUCCESS

기존 live preflight `32797397018`은 Cloudflare 403/provider code 7403으로 안전 실패했다.
- D1 write 없음
- migration apply 없음
- backup artifact 없음

API token 원문을 채팅/문서/PR에 붙이지 않는다.

## 8. 보안 / 개인정보 계약

금지:
- FCM PII
- Meta access token browser 노출/URL query
- raw API key DB 저장
- raw Webhook secret DB 저장
- public webhook body/query ownerId 신뢰
- failure audit에 name/phone/email/content 저장
- sample/mapping/secret browser storage 저장
- provider payload `innerHTML`
- auth 종료 후 raw one-time secret DOM 잔존

유지:
- dynamic provider/server 값은 `textContent`
- key/secret은 생성/회전 직후 1회만 표시
- auth reset 시 transient secret/OAuth state 삭제
- owner는 서버 인증 경계에서 결정
- raw webhook retention 제한
- read-only diagnostics는 delivery 상태를 바꾸지 않음
- 403 의미는 endpoint/caller별로 해석

## 9. 완료된 개발 / 남은 P0

완료:
- [x] Universal Direct API / Webhook / Meta canonical intake
- [x] PII-free FCM + Android pull/ACK
- [x] Connect Hub + mapper/activity/E2E
- [x] Direct API/Webhook guide
- [x] mobile/accessibility/risk UX
- [x] failure audit / E2E summary isolation
- [x] hidden asset chain 제거
- [x] index/MutationObserver binding 제거
- [x] body-wide MutationObserver 제거
- [x] lifecycle action expired-session recovery
- [x] auth reset transient secret/OAuth cleanup

남은 실제 운영 P0:
- [ ] Cloudflare D1 권한/계정 문제 해결
- [ ] production read-only migration preflight
- [ ] migration 0010~0013 apply
- [ ] server runtime rollout
- [ ] Meta App Dashboard/App Review/Live 설정
- [ ] 실제 Meta test lead 반복 검증
- [ ] Android #100/#101 rollout 준비
- [ ] 실기기 E2E
- [ ] Play rollout

## 10. 운영 rollout 순서

1. Cloudflare D1 account/token/permission 해결
2. D1 Migration Safety read-only preflight 성공
3. pending이 승인된 0010~0013과 정확히 일치하는지 확인
4. 명시적 승인 후 #123 처리
5. encrypted backup + guarded migration apply
6. server stacked PR을 최신 main 기준으로 충돌/retarget 재검토
7. server runtime rollout
8. Direct API/Webhook 실제 activity 확인
9. Meta production env + App Dashboard 설정
10. Meta real Lead Ads 수신 확인
11. Android #100/#101 통합 rollout 준비
12. 실기기 E2E
13. 확인 후 Play rollout

과거 QA success만 보고 오래된 stacked PR을 연속 merge하지 않는다. 운영 merge 직전 diff/mergeable을 다시 확인한다.

## 11. Meta 운영 설정

필요 env/secret:
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

Graph version/scopes는 운영 시점 Meta App Dashboard와 공식 문서를 기준으로 확인한다.

## 12. Definition of Done

- [ ] production D1 0010~0013 정상 적용
- [ ] server runtime 최신 stack 운영 반영
- [ ] Direct API 실제 문의 수신
- [ ] Webhook sample → mapping → replay → canonical intake
- [ ] Meta OAuth 실제 연결 + real lead 수신
- [ ] FCM PII-free 확인
- [ ] Android pull/import/ACK 확인
- [ ] same-phone 재문의 customer 중복 없음
- [ ] PageRo legacy + Universal 중복 import 없음
- [ ] E2E가 실고객 metadata 오염하지 않음
- [ ] activity/failure audit로 장애 지점 확인 가능
- [ ] auth 경계 이후 one-time secret 재노출 없음
- [ ] Play rollout 후 실기기 회귀 확인

## 13. 금지사항

- #120 merge 금지
- D1 preflight 없이 migration apply 금지
- backup/expected pending 확인 없이 production D1 write 금지
- server schema보다 Android를 먼저 production rollout하지 않음
- FCM을 source of truth로 바꾸지 않음
- FCM PII 금지
- 미구현 Google/Naver/Kakao를 연결 가능하다고 표시하지 않음
- 테스트 때문에 기존 고객 데이터를 덮어쓰지 않음
- body-wide MutationObserver / hidden asset chain / array-index binding 재도입 금지
- shared `api()`에서 모든 403 자동 로그아웃 금지
- auth reset 후 raw secret/OAuth state 보존 금지
- 실제 운영 검증을 mock 추가로 완료 처리하지 않음

이후 개발은 **새 기능 개수보다 canonical 계약, auth 경계, 단순한 의존관계, 운영 안전성**을 우선한다.