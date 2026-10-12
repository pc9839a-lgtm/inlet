# PageRo 내부 기능 / 작업 기준

- 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-10-12 KST
- 저장소: `pc9839a-lgtm/inlet`
- 운영 브랜치: `main`
- 운영 도메인: `https://pagero.kr/`

> 다른 AI는 이 문서를 읽기 전에 반드시 현재 `main` HEAD와 open PR을 먼저 확인한다. 아래 상태표는 작업 방향을 정하는 기준이며, 오래된 branch/SHA를 재사용하지 않는다.

## 1. 제품 한 줄

PageRo는 범용 디자인 툴이 아니라 **광고용 문의 페이지 제작 → 유입 → 문의 → 접수함 → 전환 확인**을 한 제품 안에서 처리하는 도구다.

## 2. 현재 완료 상태

| 영역 | 상태 | 기준 |
| --- | --- | --- |
| E0 유지보수 정리 | 완료 | dead path/docs/CSS owner 정리 |
| E1 편집기 shell | 완료 | 구조/추가 + canvas + inspector |
| E2 섹션 패턴 | 완료 | 추천/업종별/기본/최근 사용 |
| E3 문의·전환 cockpit | 완료 | 테스트 문의, 전달/추적 상태, 테스트 트래픽 분리 |
| E4 AI first-page | 구현 완료 | editable PageRo blocks + 발행 checklist |
| UI 밀도/설명문 정리 | 완료 | 대시보드/인증/접수함/통계/설정/편집기/접근 흐름 |
| P6 설정 UX | 완료 | 역할별 nav, owner-only destructive action, read-only settings 보호 |
| 문서 구조 정리 | 완료 | current SOURCE/RUNBOOK inventory + docs hygiene QA |
| 저장/Undo/Redo/Revision | 완료 및 회귀 QA 존재 | save/reload/revision 계약 유지 |
| 배포 asset/cache graph | 완료 | live graph + cache 검증 |
| production D1 save roundtrip | 배포 gate에 존재 | 실제 deploy workflow에서 검증 |

### 완료 영역은 다시 만들지 않는다

실제 버그가 재현되지 않는 한 아래를 새 작업처럼 다시 손대지 않는다.

- editor CSS ownership / workspace geometry / preview shell
- PC·모바일 반응형 회귀 보강
- E1 editor shell
- E2 section pattern
- E3 conversion cockpit
- E4 AI first-page
- 로그인/대시보드/접수함/통계의 설명문 제거
- 설정/편집기 compact density

완료 여부는 PR 번호가 아니라 **현재 main source와 QA contract**를 기준으로 확인한다.

## 3. 현재 실제 runtime

### 공개 루트

`/`의 공개 메인은 Cloudflare Pages Functions의 `functions/index.js`가 기준이다.

- root marker: `.pagero-exact-home`
- frozen C63 asset + life bridge 보호
- 내부 앱 수정 때문에 공개 루트 디자인/문구/구조를 바꾸지 않는다.

### SPA / 앱

`src/main.jsx`는 `/embed/*`만 `MapEmbedApp`으로 분기하고, 나머지 SPA 진입은 `App`으로 연결한다.

`App.jsx`에서:

- 공개 slug → `PreviewRenderer`
- 초대 → `InviteAcceptScreen`
- 인증 → `AuthScreen`
- 로그인 후 비작업공간 → `Dashboard`
- 작업공간 → `WorkspaceEditorScreen`

공개 `/` 서버 홈과 SPA 인증 화면을 같은 것으로 취급하지 않는다.

## 4. 현재 편집기 경로

`WorkspaceEditorScreen → WorkspaceLeftPanel → WorkspaceActivePanel → EditPanel → EditPanelLayout`

주요 owner:

| 영역 | source |
| --- | --- |
| editor shell | `src/screens/WorkspaceEditorScreen.jsx` |
| left workspace | `src/screens/workspace/WorkspaceLeftPanel.jsx` |
| preview/canvas | `src/screens/workspace/WorkspacePreviewPane.jsx` |
| active panel | `src/screens/workspace/WorkspaceActivePanel.jsx` |
| edit panel | `src/editor/EditPanel.jsx` |
| block order | `src/editor/editPanelParts/ScreenOrder*.jsx/css` |
| settings | `src/panels/SettingsPanel.jsx`, `src/panels/settings/**` |
| save | `src/runtime/usePageSaveAction.js` |
| history | `src/runtime/pageEditHistory.js` |
| revision | `src/lib/pageRevisionRestore.js`, `PageRevisionHistorySection.jsx` |
| conversion cockpit | `src/screens/workspace/ConversionCockpit.jsx` |
| production root | `functions/index.js` |

제거된 과거 editor path를 fallback 명목으로 복구하지 않는다.

## 5. 설정 권한 기준

설정은 `authContext.js`의 tab read/write 권한을 기준으로 판단한다.

### builder / owner

- 페이지 설정
- 미디어
- 개인 도메인
- 계정
- 매니저/소유권
- 요금제/추천인/파트너/정산
- 고급 설정
- 초기화

### manager

- `settings.write=true`일 때 프로젝트 설정 변경 가능
- 매니저/소유권, owner finance, 초기화는 불가
- 미디어 권한은 `edit` read/write와 별도 연동
- read-only settings에서는 페이지 기본을 수정하지 못함

### client-admin

- owner finance / 매니저 / 소유권 / 고급 / 개인 도메인 변경 불가
- 페이지 기본은 read-only
- 계정 정보는 본인 계정 범위에서 사용

권한을 UI 숨김만으로 추정하지 말고 실제 `canReadTab/canWriteTab` 경로를 함께 확인한다.

## 6. UI 문구 기준

PageRo 내부 제품 UI에서는 설명문보다 기능명·상태·값을 우선한다.

제거/축약 대상:

- 제목 아래에서 기능을 다시 설명하는 문장
- `~할 수 있습니다`, `~확인합니다`, `~관리합니다` 식 중복 안내
- 마케팅형 hero/pitch
- 버튼만 봐도 알 수 있는 도움말

유지 대상:

- 입력 검증 오류
- 권한 부족
- 저장 실패/충돌
- 결제 실패
- 삭제/초기화/소유권 이전 같은 위험 경고
- 사용자가 다음 행동을 결정하는 데 필요한 상태

## 7. 현재 남은 실제 backlog

### B3 — 신규 사용자 production smoke

현재 **사용자 요청으로 스킵**한다.

필요 시 별도 승인 후:

`회원가입 → 이메일 인증 → 로그인 → 첫 페이지 → 수정 → 발행 → 공개 URL → 테스트 문의 → 접수함`

production D1 write가 발생하므로 자동으로 실행하지 않는다.

### P5 — 개인 도메인 운영화

P5 개인 도메인 current-main 재구성: **완료**.

current-main 코드 재구성 완료:

- PR #352: canonical `page_domains` ownership / backfill / collision / release / schema QA
- PR #353: Cloudflare Pages provider register/verify/detach / DNS verify / SSL status / retry / fail-closed cleanup / owner signed-session API
- PR #354: settings UI → revision-safe page save → provider verify 연결 / canonical 상태 표시 / idempotent detach 재시도
- 대체된 오래된 draft #233~#235는 2026-10-02 closed

운영 반영 상태:

- production D1 migration `0015_page_domain_ownership.sql` 적용 완료
- production provider secret/env readiness 확인 완료
- production custom-host router는 canonical `page_domains` active ownership 기준으로 전환 완료
- 별도 외부 테스트 도메인을 새로 구매해야 하는 end-to-end DNS/SSL smoke는 현재 생략한다. 기존 운영 브랜드 도메인을 테스트용으로 재사용하지 않는다.

P5의 코드·DB·provider 운영 기반은 반영됐으며, 별도 테스트 도메인 확보가 필요한 live smoke만 후순위 검증 항목으로 남긴다.

### P7 — 웹 자동결제

P7 웹 결제: 실제 PG adapter 연동과 청구 활성화는 현재 홀드한다.

현재 self-serve billing은 **기반 구현 단계**이며 실제 청구는 비활성 상태다.

확정 정책 baseline:

- 페이지로 유료 플랜은 클래식 3,500원 / 프로 5,500원 두 개만 사용
- 플랜별 세부 entitlement는 owner 확정 전까지 UI·서버에서 임의로 만들지 않음
- 개인 도메인/SSL 별도 결제 상품은 미확정이므로 checkout 대상에서 제외
- 콜태그 `all_monthly`는 페이지로 클래식을 자동 포함하지 않음
- 실제 PG 청구 활성화 전까지 현재 문의형 진입을 유지

P7 기반 구현:

- `0016_pagero_web_billing_foundation.sql`: 주문 원장 + webhook 수신 원장
- 주문은 `owner_id + idempotency_key`로 중복 생성 차단
- 페이지로 상품 금액은 서버에서 클래식 3,500원 / 프로 5,500원으로 고정 검증
- 결제 확정은 범용 `INLET_API_TOKEN`이 아니라 웹 결제 전용 provider gate를 사용
- production `0016_pagero_web_billing_foundation.sql` 적용 완료
- provider를 임의 선택하지 않고 provider adapter registry는 기본 empty/fail-closed
- webhook 검증은 선택한 PG의 공식 서명 규칙을 provider adapter에서 구현하도록 분리
- 내부 normalized lifecycle은 결제 성공/실패, 갱신, grace, 취소, 부분/전액 환불 전이 계약을 보유
- 범용 webhook 수신기는 provider별 매핑 전에는 구독 상태를 변경하지 않음
- 읽기 전용 결제 history API가 order/payment event를 계정 단위로 반환
- 주문 쓰기와 실제 청구는 별도 kill switch로 기본 비활성
- 문의형 `/subscribe` 화면은 무료/클래식/프로만 노출하며 실제 checkout을 시작하지 않음

아직 필요한 항목:

- 실제 PG 선정
- 선택한 PG provider adapter: checkout SDK/API, 결제 검증, 공식 webhook signature parser
- recurring billing key/token 안전 저장 정책
- provider event → normalized lifecycle mapping + renewal / grace / cancel / refund 실제 반영
- receipt/history 사용자 화면
- 실제 청구 승인 후 운영 smoke

**실제 청구 활성화는 별도 승인 없이 실행하지 않는다.**

### P9 — 전체 접근성

P9 접근성 audit의 코드 보강과 자동 회귀 gate는 완료했다.

완료:

- keyboard-only 핵심 경로: dialog/tab/disclosure를 native control + 명시적 active semantics로 유지
- 모든 current modal 계열에 focus trap / Escape close / 이전 focus return 공통 계약 적용
- 200% zoom·짧은 viewport에서 modal을 dynamic viewport height + 내부 scroll로 유지
- dashboard/workspace의 focus-visible 표시 강화
- 작은 오류/보조 텍스트의 저대비 색상을 상향 조정
- workspace/settings navigation에 accessible name / aria-current / aria-controls 추가
- dialog title, alert/status, decorative icon semantics 보강
- mobile keyboard가 viewport 높이를 줄이는 경우 modal 상단 정렬·scroll 가능
- prefers-reduced-motion 대응
- `npm run accessibility:qa`에 위 계약을 release gate로 고정

실제 NVDA/VoiceOver 같은 보조기술 수동 spot check는 출시 검증 시 추가할 수 있으나 현재 코드 backlog blocker로 두지 않는다.

### P8 — 대량 데이터

P8-1~4의 코드/회귀 계약은 완료했다. production 실데이터 삭제는 실행하지 않았다.

완료:

- 10k / 50k lead fixture를 CI에서 생성하는 offline benchmark gate
- 최신 목록, deep keyset, 상태 필터, 전달 상태 필터, 월별 count, scoped text search의 query plan 검사
- lead inbox의 기본 pagination을 `created_at DESC, id DESC` keyset cursor로 전환
- 기존 숫자 offset cursor는 구버전 호환 입력으로만 유지하고 다음 페이지부터 keyset cursor를 반환
- 기존 `idx_leads_project_month`, `idx_leads_project_status`, `idx_leads_delivery_status` 사용 계약 고정
- CSV export는 count 없는 500건 keyset scan + ReadableStream으로 전환
- dynamic form 컬럼은 1차 shape scan 후 2차 row stream으로 유지
- 요청당 50,000건 safety ceiling을 두고 초과 시 필터 축소를 요구
- lead 180일 / delivery log 30일 / AI draft 30일의 bounded retention endpoint와 dry-run report
- 현재 event payload가 PII-free로 보장되지 않으므로 event 자동 보존기간은 180일 상한으로 보수 적용
- 기존 audit retention은 별도 endpoint/workflow에서 730일 기본 정책 유지
- PageRo data retention write는 전용 secret + `PAGERO_DATA_RETENTION_WRITE=1` + 승인 문구가 모두 있어야 실행
- `pagero:data-retention:p8:qa`를 `qa:all` release gate에 포함
- production 데이터/D1 write 없이 P8-1~4 구현/회귀 검증

남은 항목:

- P8-5 backup / restore 실제 복구 검증
- JSONL backup/quarantine retention 실행 연결
- 실제 사용량이 커진 뒤 production query plan 재확인

### E5 — A/B test

실사용 전환 데이터 이후 진행:

- page variant
- A/B test
- conversion comparison
- winning variant publish

### 편집기 안정화 — 상시 리스크 레지스터

**기준:** 현재 `main`의 실제 편집기·저장 경로를 점검한 내용. 기존 E1/E2/P6 완료 판정은 유지한다. 여기서 '위험'은 사용자에게 이미 발생했다고 확인된 장애를 뜻하지 않는다. 코드상 **확인된 취약 경로**와 아직 **실사용 재현이 필요한 시나리오**를 구분한다. 우선순위는 데이터 유실 가능성(P1) → 저장 오작동(P1) → 편집 체감(P2) 순서다. 이 표는 현재 작업 기준이며, 수정 후에는 회귀 테스트와 함께 해당 항목의 상태를 갱신한다.

**이미 반영된 보호 조건 (현재 main):**

- 저장된 같은 페이지의 공개 주소(slug)를 바꿔도 저장 작업의 대상 식별은 page ID 기준으로 유지한다. `src/runtime/pageOperationIdentity.js`.
- 브라우저가 `window.localStorage` 프로퍼티 접근부터 차단해도 임시 초안 코드가 예외로 중단되지 않고 저장 실패를 명시한다. `src/runtime/pageDraftStore.js`.
- A 페이지 저장 중 B로 이동해 B의 저장을 **명시적으로** 누른 경우, B가 여전히 활성 페이지라면 큐를 진행하고 A의 오래된 응답은 B에 반영하지 않는다. `src/runtime/usePageSaveAction.js`, `saveQueuePolicy.js`.
- 위 조건은 코드/오프라인 회귀 기준으로 반영됐다. 모든 브라우저·여러 탭·느린 네트워크의 실제 사용 시나리오가 전부 검증됐다는 뜻은 아니다.

| ID | 우선순위 | 위험 발생 조건 (패치 이전 포함) | 현재 상태 | 조치 및 추가 확인 기준 |
| --- | --- | --- | --- | --- |
| ED-R01 | **P1** | (패치 전) 일반 발행(`usePageSaveAction.js`)과 스타일 발행(`usePersistStyleSaveAction.js`)은 각각 별도의 `useRef` 대기열을 사용하고 **동일 페이지에 각각 `persistPage`**를 호출한다. 빠르게 번갈아 누르면 서버 revision 경쟁·충돌 UI가 발생할 위험이 있다. | **#404 패치 완료 · main 병합 · 전체 CI 통과**. 실사용 장시간/교차 탭 검증은 별도 | 두 발행 경로를 **페이지별 단일 직렬 쓰기 큐**로 통합. 일반→스타일 / 스타일→일반 동시 클릭 시 최종 변경 모두 저장되고 불필요한 충돌이 없어야 한다. |
| ED-R02 | **P1** | (패치 전) 스타일 큐는 `queuedStyleSaveRef`라는 boolean만 기록한다. A 스타일 저장 중 B로 이동한 다음 B 저장을 눌러도, A 결과가 `inactive-page`이면 `nextTrailingSaveRequest`가 큐를 중단한다. #402에 해당하는 일반 페이지 큐 보호가 스타일 경로에는 없다. | **#405 패치 완료 · main 병합 · 전체 CI 통과**. 실제 B→C 전환 검증은 별도 | 스타일 대기 요청에도 프로젝트·페이지 identity 기록. **현재 활성 B의 명시적 저장만** 이어서 처리하고 B→C로 이동하면 폐기. |
| ED-R03 | **P1** | (패치 전) 임시 초안은 탭별 `sourceId`를 붙이지만, 모든 탭이 **같은 `PAGE_DRAFTS_KEY` JSON envelope**를 읽어 수정 후 통째로 `setItem` 한다(`pageDraftStore.js`). 탭 A/B가 비슷한 시점에 읽고 쓰면 뒤의 쓰기가 앞 탭의 초안을 덮을 수 있다. 현재 다중 탭 QA는 **순차 쓰기** 검사다. | **#406 패치 완료 · main 병합 · 전체 CI 통과**. 탭 복제/다중 브라우저 조합은 별도 | 탭별 저장 키 분리 또는 재읽기/병합·변경 통지 프로토콜. 교차 탭 동시 초안 저장 100회에서도 A/B 복구본이 모두 남아야 한다. |
| ED-R04 | **P1** | (패치 전) 편집 대상 A가 비활성화된 뒤 A의 서버 저장이 실패하면, `usePageSaveAction.js` 및 스타일 저장 경로는 화면 분리를 우선하여 **해당 분기에서 복구 초안을 직접 확보하지 않고 반환**한다. 별도 자동 초안 flush가 실패했을 때 A 편집분을 잃을 수 있다. | **#407 패치 완료 · main 병합 · 전체 CI 통과**. 저장소 제한+전환 실사용 검증은 별도 | 비활성 **실패한 A의 원본**만 안전하게 초안 보존하고 현재 B 화면은 변경하지 않기. 네트워크 실패·페이지 전환·저장소 제한 조합에서 데이터 보존 판정. |
| ED-R05 | **P2** | `pageEditHistory.js`의 ID 없는 페이지 scope는 소유자·프로젝트가 같으면 모두 `unsaved`로 묶인다. 같은 작업공간의 여러 신규 임시 페이지에서 Undo/Redo 기록이 섞일 여지가 있다. | scope 규칙 확인, UI 재현 필요 | 신규 페이지별 임시 고유 ID를 history scope에 사용. 새 페이지 B에서 Undo가 A의 내용을 복구하지 않아야 한다. |
| ED-R06 | **P2** | 다른 탭·기기에서 발생한 저장 확인(`usePageRemoteFreshness.js`)은 **focus / visibilitychange 시점**에만 요청한다. 탭을 계속 띄운 상태에서는 원격 변경 알림이 늦을 수 있다. 서버의 revision 충돌 차단과는 별개인 사용성 위험이다. | 이벤트 트리거 확인, 실제 지연 측정 필요 | `BroadcastChannel`/storage 알림 또는 제한된 주기 확인을 검토. 원격 변경과 현재 편집분이 다른 경우 **자동 덮어쓰지 않고** 충돌 안내. |
| ED-R07 | **P2** | 일반 발행 대기열에서 `pageOverride`가 지정된 요청은 override 객체를 저장해 두었다가 재사용한다. 대기 중 동일 B 페이지의 추가 수정이 생기면 오래된 override 필드가 최신 내용을 덮을 가능성이 있다. | override 전달 코드 확인, 변경 필드 재현 필요 | override의 패치 의도와 클릭 당시 버전을 분리하거나 큐 소비 시 최신 페이지에 안전 병합. 저장 완료 후 마지막 입력값 일치. |
| ED-R08 | **P2** | 브라우저 저장소 사용 불가·용량 한도 초과 시 안내와 오류 처리는 존재하지만 **영속 임시 초안이 없는 상태 자체**는 남는다. 즉 이 상태에서 브라우저를 종료하면 서버 미발행 편집은 복원되지 않을 수 있다. | 실패 경고 동작 확인, 브라우저별 범위 검증 필요 | 안전한 수동 내보내기/복구 대안 및 저장 전 경고 강화. 저장소 실패를 '임시 보관 성공'으로 표시하지 않기. |
| ED-R09 | **P2** | `pageEditHistory.js`는 페이지 전체를 `structuredClone`/JSON 복제하여 Undo 기록 최대 50개를 보관한다. 이미지/블록이 많은 페이지에서 편집 지연·메모리 사용 증가 가능성이 있다. | 전체 스냅샷 구현 확인, 성능 계측 필요 | 100+ 블록·큰 이미지 페이지에서 Undo 50회·입력 지연 측정. 필요 시 필드 단위 patch history 또는 용량 제한. |
| ED-R10 | **P2** | `pagePersistFlow.js`는 발행 후 `setTimeout(() => setSaved(false), 1000)`으로 전역 저장 표시를 해제한다. 타이머 동안 페이지가 바뀌면 새 페이지의 저장 표시가 이전 페이지 타이머 영향을 받을 수 있다. | 타이머 코드 확인, UI 재현 필요 | 작업 대상 identity·타이머 정리 조건 추가. 페이지 전환 중 이전 저장 완료 표시가 현재 페이지에 나타나지 않을 것. |
| ED-R11 | **P1 / 검증 공백** | `scripts/editor-browser-regression-check.mjs`의 핵심 저장 응답은 **가상 API로 모킹**한다. 운영 배포의 공개 브라우저 체크는 비로그인 공개 경로다. 따라서 실제 로그인 편집기에서 **장시간 작업·다중 탭·느린 네트워크의 결합 시나리오**는 기존 CI만으로 검증됐다고 볼 수 없다. 인증메일 검증 완료와는 별개의 항목이다. | QA 커버리지 확인, 실사용 재현 테스트 미완료 | staging/테스트 계정 기반 실제 서버 발행·재접속·동시 저장을 묶어 수행. 사용자 운영 페이지/문의에 테스트 데이터 무단 쓰기 금지. |

**진행 상태:** ED-R01~R04는 #404~#407에서 코드 패치 및 CI 검증을 마쳤다. 운영 배포/실사용 브라우저 재현까지 완료했다는 의미는 아니다. 다음은 ED-R05~R10 개선 및 ED-R11 실사용 E2E 검증 공백 보완이다. '코드 패치'와 '실사용 완전 검증'을 혼동하지 않는다.

**수정 금지 경계:** `functions/index.js` 및 C63 메인 불변. 개인 도메인/실결제/실사용자 페이지 삭제와 혼합하지 않는다. 실제 운영 사용자 데이터 쓰기·실결제·production deploy는 별도 승인 범위를 따른다.

## 8. 현재 작업 우선순위

B3 production smoke는 현재 스킵한다.

다음 순서:

1. P7 실제 PG 연동은 현재 홀드
2. P8 대량 데이터
3. E5 A/B test
4. P5 외부 테스트 도메인 live smoke는 별도 테스트 도메인 확보 시 실행

AI 기능은 E4까지 구현되어 있다. 사용자가 다시 요청하기 전까지 AI 확장보다 위 backlog를 우선한다.

## 9. open PR 처리 규칙

작업 전 open PR을 반드시 확인한다.

- current main보다 오래된 stacked PR은 바로 병합하지 않는다.
- PageRo 개인 도메인 #233~#235는 #352~#354로 대체되어 closed다. 과거 설계 참고가 필요할 때만 읽는다.
- CallTag PR은 PageRo 작업과 섞지 않는다.
- 이미 main에서 대체된 PR은 close/재작성 여부를 먼저 판단한다.

## 10. QA / 배포

최소 QA:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

작업에 따라 추가:

- desktop / narrow desktop
- mobile 360 / 390 / 430
- keyboard/pointer
- console error 0
- horizontal overflow 0
- protected production-home diff 0

운영 배포, production D1 write, 실제 결제, custom-domain provider attach/detach, 실사용자 데이터 삭제는 사용자 승인 범위를 확인한다.

## 11. 작업 원칙

- 실제 import/route를 먼저 확인한다.
- 같은 기능을 새 병렬 component/CSS로 만들지 않는다.
- `*-final.css`, `*-fix.css` 식 patch layer를 추가하지 않는다.
- 한 PR에 UI와 billing/domain provider/schema를 섞지 않는다.
- 완료된 패치를 다시 고도화 명목으로 반복하지 않는다.
- 사용자가 지적한 실제 화면/버그가 있으면 문서보다 재현 결과를 우선한다.

## 12. 문서 사용 규칙

문서 전체 목록과 역할은 `docs/README.md`만 본다.

- 새 문서를 만들기 전에 기존 SOURCE/RUNBOOK에 흡수 가능한지 먼저 확인
- 날짜별 운영 스냅샷과 완료 패치 메모를 장기 보관하지 않음
- 인증 보안은 `ops-auth-security-policy.md` 단일 SOURCE 사용
- SES 운영 검증은 `ops-ses-auth-email-production-verification.md` 단일 RUNBOOK 사용
- 문서 추가/삭제 시 `docs/README.md` inventory를 같이 갱신
- `npm run docs:qa` 통과 필수

## 13. 다른 AI가 작업을 시작할 때

1. `AGENTS.md`
2. `docs/README.md`
3. `PAGERO_MAINTENANCE_HANDOFF_KO.md`
4. 이 문서
5. 필요한 영역의 실제 source
6. current main HEAD
7. open PR

이 순서로 확인한다.

**과거 대화 요약이나 오래된 PR 설명보다 current main source가 우선이다.**
