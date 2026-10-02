# PageRo 내부 기능 / 작업 기준

- 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-10-02 KST
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

current-main 코드 재구성 완료:

- PR #352: canonical `page_domains` ownership / backfill / collision / release / schema QA
- PR #353: Cloudflare Pages provider register/verify/detach / DNS verify / SSL status / retry / fail-closed cleanup / owner signed-session API
- PR #354: settings UI → revision-safe page save → provider verify 연결 / canonical 상태 표시 / idempotent detach 재시도
- 대체된 오래된 draft #233~#235는 2026-10-02 closed

아직 운영 완료가 아닌 항목:

- production D1 migration `0015_page_domain_ownership.sql` 적용
- production provider secret/env readiness 확인
- 실제 테스트 도메인 attach → DNS verify → SSL active → detach smoke
- production custom-host router를 canonical `page_domains` 기준으로 전환할지 migration/smoke 후 최종 검증

위 항목은 production write 또는 실제 provider side effect가 있으므로 별도 승인 전 실행하지 않는다.

### P7 — 웹 자동결제

현재 self-serve billing 미완료.

필요:

- 실제 PG checkout
- provider 검증
- recurring billing key/token
- webhook signature
- idempotency
- renewal / grace / cancel / refund
- receipt/history
- 운영 smoke

실제 청구 활성화는 사용자 승인 없이 하지 않는다.

### P9 — 전체 접근성

남은 최종 audit:

- keyboard-only
- focus trap / focus return
- 200% zoom
- contrast
- screen reader semantics
- mobile keyboard viewport

### P8 — 대량 데이터

실사용량 증가 후 진행:

- leads 10k / 50k
- query plan
- CSV streaming
- retention
- backup / restore

### E5 — A/B test

실사용 전환 데이터 이후 진행:

- page variant
- A/B test
- conversion comparison
- winning variant publish

## 8. 현재 작업 우선순위

B3 production smoke는 현재 스킵한다.

다음 순서:

1. P5 개인 도메인 production migration/provider smoke 승인 후 운영 검증
2. P7 웹 결제
3. P9 접근성 audit
4. P8 대량 데이터
5. E5 A/B test

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
