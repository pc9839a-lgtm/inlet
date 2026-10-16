# PageRo 내부 기능 / 작업 기준

- 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-10-16 KST
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

### 실제 미해결 항목 — 2026-10-16 current-main 재점검

> **이 표만 미해결 작업의 우선순위로 사용한다.** `구현`, `main 병합`, `CI 성공`, `운영 배포`, `실제 검증`은 다른 상태다. 아래는 이미 수정된 코드를 재작성하는 목록이 아니다. 운영 로그/Cloudflare 환경을 확인하지 못한 경우 **미확인**으로 쓰며 장애 발생으로 단정하지 않는다.
>
> 검토 기준: 2026-10-16 조회 당시 current `main`(#425 포함) 및 해당 main QA 성공. 검토 시점 SHA는 Git history/Actions로 재조회하고, 이 문장에 적힌 특정 SHA를 향후 배포 기준으로 재사용하지 않는다. PR #415, #417~#419, #421~#422, #425 병합 확인. `main` branch `protected=false` GitHub API 확인. Cloudflare Pages 프로젝트 Git 설정 및 실제 제공 중인 배포 SHA는 별도로 확인하지 못함. **다른 GitHub Actions를 통한 자동 `inlet` 배포 경로와 성공 실행 이력은 확인**했다.

| ID | 우선순위 | 아직 해결되지 않은 내용 | 증거 / 현재 범위 | 완료 판정에 필요한 작업 |
| --- | --- | --- | --- | --- |
| DEP-00 | **P0 / 코드·실행 증거 확인** | **#417/#422 배포 승인 가드 외의 다수 workflow가 `inlet` 운영 배포를 직접 호출해 승인 체계를 우회** | 직접 `wrangler pages deploy --project-name inlet --branch main` 호출: `deploy-settings-finance-on-push.yml`, `deploy-settings-finance-on-pr.yml`, `deploy-auth-email-on-pr.yml`, `deploy-auth-email-on-issue.yml`, `capture-auth-email-live.yml`, `deploy-calltag-admin.yml`, `deploy-calltag-partner-settlement.yml`. `deploy-auth-storage-diagnostic.yml`·`hotfix-auth-verification-id.yml`는 `npm run deploy:pages`(동일 `inlet` 배포) 호출. #422 병합 이후 자동 `workflow_run` 배포 2건(2026-10-14)에서 실제 `Deploy assets and Pages Functions` step 성공 확인 | 프로젝트 `inlet`에 쓰기 가능한 **모든** workflow·script·Git 연동을 열거하고, 승인되지 않은 운영 업로드/Secret 변경을 차단. 단일 수동 승인 + 최신 main 동일 SHA QA + 운영 전 Cloudflare GET 검사 + job-level required reviewers 계약으로 통일. 자동 검증은 단일 `deploy-cloudflare.yml`가 아니라 **전체 workflow corpus**에서 직접·간접 Pages 배포를 검색하도록 확장. 운영 설정 수정·workflow 비활성화/삭제는 별도 승인 후 |
| DEP-01 | **P1 / 변경 위험** | CI 경로 일부는 운영에 직접 쓰는 명령 또는 운영 프로젝트 Secret 변경을 포함하지만 `main` workflow 코드 변경만으로 실행될 수 있음 | `calltag-admin-cloudflare-bootstrap.yml`의 `pages secret put`와 `deploy-auth-storage-diagnostic.yml`·`hotfix-auth-verification-id.yml`의 `push` trigger 확인. 실제 Secret 변경 실행 발생 여부는 별도 검증 | 모든 운영 변경 작업의 event/branch/environment/approval/QA SHA/쓰기 목적지 점검. 민감 작업은 별도 수동승인으로 제한하고 read-only 점검과 분리. Secret 실제 값은 조회·문서화 금지 |
| OPS-01 | **P1 / 운영 확인** | Cloudflare Pages `inlet` 프로젝트의 Git 자동 Production 배포가 실제 OFF인지 **미확인** | #417 GitHub 자동배포 차단, #422 Cloudflare GET 검사·fail-closed 코드까지 **main 병합**. Cloudflare 실설정 조회 실행은 미확인. **DEP-00의 다른 GitHub Actions 업로드 차단과 별개 문제** | 승인된 수동 `PageRo Cloudflare Auto-deploy Safety` `audit` 실행→실제 `production_deployments_enabled=false` 또는 Git source 없음 증빙. 켜져 있으면 별도 승인 후 `disable`. 기존 코드 다시 만들지 않기 |
| OPS-02 | **P1 / 접근 통제** | GitHub `main` branch 보호가 꺼져 있음; `production` environment required reviewers 설정도 **미검증** | GitHub branch API에서 `protected=false` 확인. 규칙셋/Environment 우회 조건은 미확인. #417의 수동 gate는 단일 workflow에만 적용되며 다른 업로드 경로가 존재 | 운영 승인 없는 직접 push/우회 배포를 막는 ruleset·required QA 및 production reviewers 실제 설정/검증. 구성 실패 시 승인 없는 운영 배포 금지 |
| OPS-03 | **P1 / 복원 증빙** | 실제 운영 D1 암호화 `backup-only` 산출물과 복호화→격리 SQLite 복원 **성공 실행 증빙 미확인** | #418 백업 전용 workflow, #422 AES/HMAC·SQL·SQLite 검증 **코드 병합**. 코드/QA 성공≠운영 백업 artifact 및 복원 실행 | `verified-live` 암호화 백업 run ID→승인된 `PageRo D1 Encrypted Backup Offline Restore` 실행→해시/HMAC·integrity/FK/핵심 테이블 카운트 artifact 확인. 운영 D1 쓰기 없음 |
| OPS-04 | **P1 / 실제 D1 복구** | Cloudflare **disposable D1** 데이터베이스 import/read/write/cleanup 복구 훈련 성공 증빙 없음 | #422 복원 범위는 임시 **SQLite**까지이며 `remoteDisposableD1Restore=not-run`. 과거 stacked #368은 현 main과 독립적으로 정합성 검토 필요 | 별도 승인·일회용 D1·개인정보 취급 승인 확보 후 SQL restore, migration/테이블 수, 테스트 데이터 read/write, cleanup 증빙. 운영 D1로 시험 복원 금지 |
| OPS-05 | **P1 / 운영 반영 확인** | #421 관리자 폐기 세션 검증 및 #425 메인 Pretendard 패치의 **운영 반영 여부 미확인** | 두 PR 모두 main 병합, 최신 main QA 성공. PR 설명상 병합만으로 production deploy 하지 않음 | Cloudflare 배포 이력에서 배포된 SHA 확인 후 기존 관리자 세션 거부·실제 웹폰트 로딩을 읽기 전용 검증. production deploy는 별도 승인 |
| ED-V01 | **P1 / 실사용 검증** | 실제 Cloudflare staging 로그인 편집기 Chrome **두 탭·30분 입력·3G/500ms·저장 중 전환·readback** 검증 미실시 | ED-R01~R10 코드 패치 완료. #415로 ED-R08~R11 통합 코드 main 병합 및 로컬 서명 세션 HTTP QA 추가. **실제 staging 브라우저 결과는 별도** | 격리된 staging·테스트 계정에서 브라우저 검증 및 데이터 무손실 증빙. 운영 고객 계정·페이지 사용 금지 |
| B3 | **P1 / 사용자 보류** | 신규 가입→SES 인증메일 수신→로그인→첫 페이지 발행→문의 접수함→정리 **production E2E 미실행** | `ops-pagero-production-launch-smoke.md`: 사용자 요청으로 명시적 **스킵**. 기존 QA 성공을 이 항목의 통과로 대체하지 않음 | 사용자가 실행을 다시 승인하고 독립 테스트 이메일/전화번호를 준비할 때만 실행. 그 전에는 의도된 보류로 표기 |
| P8-R | **P2 / 데이터 보존** | JSONL 백업 30일 및 격리(quarantine) 14일 보존기간의 **실행·정리 연결 미완료** | `ops-pii-retention-export-policy.md` 구현 작업으로 명시. #419로 D1 leads/audit 자동 **삭제 위험은 해결**됐으므로 되돌리지 않음 | JSONL 보존 정책에 맞는 최소권한·dry-run/승인 실행, 백업·격리 파일 정리 증빙. production 삭제는 별도 승인 |
| P5-V | **P2 / 선택적 검증** | 개인 도메인 **실제 외부 DNS/SSL attach→verify→detach E2E 미실행** | #352~#357 및 production migration/provider 기반은 완료. 미실행 이유는 별도 테스트 도메인 부재 | 기존 브랜드 도메인은 건드리지 않고 전용 테스트 도메인 확보 후 승인 범위 내 검증 |
| INT-V | **P2 / 외부 연동 검증** | SES 실메일, 외부 CRM webhook, 광고 매체 전환 진단, 유료 AI API의 실제 계정별 live 증빙이 통합 확정되지 않음 | `ops-live-integration-matrix.md`: mock/pass와 `skipped-live`를 구분하도록 정의. **모든 기능 장애라는 의미 아님** | 활성 기능에 한해 각 provider 실행 결과와 `skipped-live` 허용·책임자를 기록. 비활성 기능을 배포 blocker로 자동 승격하지 않음 |
| P8-Q | **P3 / 규모 증가 시** | 실제 운영 리드 규모에서 index/query plan·CSV 응답 품질 재검증 필요 | 10k/50k 오프라인 fixture, keyset, CSV streaming은 구현 완료 | 실제 부하가 기준치를 충족하면 읽기 전용 production explain/성능 점검 |
| DOC-01 | **P2 / 작업 중 정리** | 완료 PR이 여전히 열린 개별 PR #411~#414 및 오래된 stacked #368~#370으로 보이는 **중복/정합성 위험** | #415 통합 PR이 main 병합됨. #368→#369→#370은 오래된 base를 참조하는 open stack. 코드 완성 여부를 열린 PR 수로 판단 금지 | head/base와 main diff를 비교해 superseded PR은 중복 병합하지 않고 검토 후 close; E5 구현 필요 시 current main에서 별도 재구성 |

**일부러 제외한 완료 항목:** E0~E4, P6, P9 코드/QA, P5 코드·migration/provider 기반, P8 10k/50k benchmark·keyset·CSV streaming·D1 bounded retention, ED-R01~R10의 수정 코드, #417 GitHub 수동 배포 gate, #418 암호화 백업 코드, #419 예약 실데이터 삭제 방지 코드, #421 관리자 폐기 세션 검증 코드, #422 Cloudflare 검사·SQLite 복원 검사 코드. **운영 미검증은 해당 코드의 재구현 사유가 아님.**

**계획 보류(결함으로 취급 금지):** P7 실제 PG 선정/청구 ON은 사용자 승인 전 홀드. E5 A/B 실험은 실사용 전환 데이터 이후, 현 open stacked #369~#370을 current main에 자동 병합하지 않음. B3와 P5 전용 외부 도메인 smoke도 별도 승인/준비 전 자동 실행하지 않음.

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

### 편집기 저장·복구 — 완료 코드와 검증 공백

- ED-R01~ED-R04는 #404~#407에서 코드 보완·main 병합, 회귀 QA 완료.
- ED-R05~ED-R07은 #408~#410에서 코드 보완·main 병합, 회귀 QA 완료.
- ED-R08~ED-R11은 통합 #415로 main 병합. #411~#414 단독 PR은 아직 open이지만 **중복 병합하거나 신규 작업처럼 재개하지 않는다.**
- ED-R11의 격리 JSONL + signed-session 실제 로컬 HTTP API QA가 추가됐다. 이를 **실제 Cloudflare D1/staging 장시간 2탭 Chrome 검증**으로 오인하지 않는다.
- 미해결 항목은 위 단일 등록표의 **ED-V01**에만 유지. 과거 ED-R01~R11 상세 위험표와 개별 패치 기록은 Git history/PR #403~#415에서 확인한다.

## 8. 현재 작업 우선순위

B3 production smoke와 P7 실제 PG 연동은 현재 사용자 요청/정책상 보류한다. 미완료가 곧 운영 장애는 아니다.

우선 순서:

1. **DEP-00 P0**: `inlet` 운영 배포 승인 우회 경로 전체 차단 설계 및 별도 승인 후 코드/환경 패치
2. **OPS-02 / DEP-01 P1**: main ruleset, environment reviewer 및 운영 쓰기 workflow 계약 통일
3. **OPS-01 / OPS-05 P1**: Cloudflare Git 설정 + 실제 운영 배포 SHA/버전 읽기 전용 검증
4. **OPS-03 / OPS-04 P1**: 암호화 백업 실행 증거 → 임시 SQLite → 승인된 disposable D1 복구 drill 순서
5. **ED-V01 P1**: 스테이징 로그인 편집기 다중 탭·실브라우저 검증
6. **P8-R / INT-V P2**: JSONL 보존기간 및 사용 중 외부 서비스 실환경 확인
7. **P5-V / P8-Q P2~P3**: 테스트 도메인/규모 조건 충족 시 확인
8. **E5 A/B test**: 실사용 데이터 및 설계 승인 후에만 재개, 오래된 stacked PR 자동 병합 금지

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
