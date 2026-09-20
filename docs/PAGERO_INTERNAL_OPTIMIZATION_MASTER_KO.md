# PageRo 내부 기능 / 출시 마스터

- 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-09-20 KST
- 저장소: `pc9839a-lgtm/inlet`
- 운영 브랜치: `main`
- 현재 main HEAD: `053f4fe9cd3cef02e46e898570922d7ba347fb9a`
- 마지막 기능 production 검증 SHA: `c899c3b7e4af76c25040b8cab0bfe0302fff2710`
- 운영 도메인: `https://pagero.kr/`
- 현재 최우선: **유지보수 정리 → 출시 블로커 종료 → 편집기 제품성 개선**

이 문서는 과거 패치 일지를 보관하지 않는다. 현재 코드 상태, 실제 남은 문제, 실행 순서만 유지한다.

## 1. 현재 판정

| 영역 | 상태 | 비고 |
| --- | --- | --- |
| 운영 메인 | 보호 / 동결 | `functions/index.js` 기준 |
| 편집기 기본 구조 | main 반영 | 블록 목록 / 선택 설정 / 미리보기 |
| 저장 / trailing save | 구현·회귀 존재 | delayed save 중 최신 입력 보호 |
| Undo / Redo | 구현 | 일반 mutation history |
| Revision | 구현 | restore와 history 경계 추가 검증 필요 |
| 이미지/영상 재사용 | production 검증 이력 있음 | P3 기능 SHA `c899c3b7...` |
| 문의 폼 / 공개 페이지 | QA 존재 | form/public browser regression |
| 모바일 공개 페이지 | QA 존재 | 360 / 390 / 430 |
| 모바일 앱 화면 | 운영 중심 | 편집보다 접수함/통계 우선 |
| 개인 도메인 | 부분 구현 | provider/DNS/SSL 자동 lifecycle 미완료 |
| 웹 자동결제 | 미완료 | `pre_checkout`; 현재 문의형 checkout |
| 대량 데이터 | 기반 있음 | 대규모 운영 부하 검증은 후순위 |
| 전체 접근성 | 부분 검증 | 최종 audit 후순위 |

## 2. 현재 release blocker

### B0 — 유지보수 정리

현재 최우선이다.

원칙:

- import 0건 dead code 삭제
- repo 내부 수동 backup 파일 삭제
- 완료된 구현 명세/핫픽스 문서 삭제
- 동일 영역 source-of-truth는 1개만 유지
- 오래된 open PR은 current plan 여부를 판정해 정리
- 새 기능 전에 현재 실제 진입 경로를 먼저 확인
- `final`, `fix`, `hotfix`, `v2/v3` 이름의 병렬 기준 문서를 만들지 않음

현재 cleanup 작업:

- 브랜치: `chore/pagero-maintenance-reset-20260920`
- dead `EditWorkbench` 경로 제거
- 미사용 workbench CSS 제거
- repository backup marker 제거
- 과거 editor/UI/hotfix/deploy 문서 제거
- `docs/README.md`를 문서 인덱스로 추가
- 편집기 방향은 `PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md` 하나로 통합

### B1 — production save deployment gate

최신 main `053f4fe9...`의 QA 5종은 통과했다.

다만 Cloudflare production deploy run에서:

- Pages upload: 성공
- deployment metadata: 성공
- exact deployment readiness: 성공
- `pagero.kr/api/readiness`: 성공
- production save QA session mint: 404
- 최종 결과: `production_save_roundtrip_failed`

제품 저장 실패가 확인된 것이 아니라 배포 직후 custom-domain/rotated QA secret 경합으로 판단된다.

보강 PR:

- `#244 fix(pagero): harden production save QA during domain propagation`
- 404만 bounded retry
- PR QA 성공
- main 미병합
- production 재검증 미완료

**#244는 유지한다.**

### B2 — Revision restore ↔ Undo/Redo

일반 편집은:

`commitLocalPageDraft → recordPageEditMutation → pageEditHistory`

경로를 사용한다.

현재 버전 기록의 불러오기는 `setPage(pageFromRevisionDraft(...))`를 직접 호출하므로 history 경계를 우회한다.

확인/수정할 동작:

1. 수정
2. 과거 revision 불러오기
3. Undo
4. Redo
5. 추가 수정
6. 발행
7. 공개 readback

완료 기준:

- revision restore 직후 Undo 의미가 예측 가능
- 과거 unrelated history로 튀지 않음
- restore만으로 공개 페이지가 변경되지 않음
- 발행 후에만 public readback 변경
- local draft 자동 손실 없음

### B3 — 실제 신규 사용자 launch smoke

mock browser QA와 QA 전용 production save probe만으로 beta launch를 끝내지 않는다.

실제 운영 환경에서 한 번은 다음을 연속 검증한다.

`회원가입 → 이메일 인증 → 로그인 → 첫 페이지 생성 → 템플릿 선택 → 수정 → 발행 → 공개 URL → 테스트 문의 → 접수함 확인`

이 시나리오가 beta launch 최종 gate다.

### B4 — 미완료 기능 오해 방지

#### 개인 도메인

현재 main UI는 hostname 저장과 DNS 안내가 보이지만 provider registration / DNS verify / SSL lifecycle은 #233~#235 draft stack이다.

beta에서 완전 자동 기능처럼 보이게 하지 않는다.

선택:

- 준비중으로 명확히 표시
- 또는 운영 자동화 완료 전 진입 제한

#### 웹 결제

현재 서버 readiness:

- `web.available=false`
- `stage=pre_checkout`

`/subscribe`는 실제 PG 자동 checkout이 아니라 결제 문의 흐름이다.

beta에서는 자동결제처럼 오해할 문구를 사용하지 않는다.

## 3. Beta 출시 기준

다음이 모두 끝나면 P5~P9 전체 완료를 기다리지 않고 beta를 열 수 있다.

1. 유지보수 cleanup QA 통과
2. #244 production deployment gate 재검증
3. Revision restore ↔ Undo/Redo 연결 검증
4. 신규 사용자 production smoke 통과
5. 개인도메인/자동결제의 미완료 상태를 UI에서 명확히 처리
6. 공개 페이지 / 문의 제출 / 접수함 핵심 흐름 정상

과거 launch gate PR #166의 핵심 결론은 현재도 방향상 유효하다.

- beta: core 기능 기준 가능
- paid self-serve: web billing 완료 전 불가

오래된 #166 PR 자체를 current 구현 기준으로 사용하지 않는다.

## 4. Beta 이후 backlog

### P5 — 개인 도메인 운영화

draft stack:

`#233 → #234 → #235`

필요:

- canonical ownership
- Cloudflare provider attach/detach
- DNS verify
- SSL 상태
- 운영 migration
- 실제 테스트 도메인 smoke

### P6 — 설정 UX

새 설정 시스템을 만들지 않는다.

정리 대상:

- 메뉴 수
- owner/manager/client-admin 권한
- 저장형/즉시반영형 feedback
- narrow/mobile overflow
- destructive action

### P7 — 웹 결제

필요:

- 실제 PG checkout
- provider 검증
- recurring token/billing key
- webhook signature
- idempotency
- renewal / grace / cancel / refund
- receipt/history
- 운영 smoke

### P8 — 대량 데이터

실사용량이 커진 뒤:

- 10k / 50k 이상 leads
- query plan
- CSV streaming
- retention
- backup / restore

### P9 — 전체 접근성

현재 static QA를 최종 제품 audit와 혼동하지 않는다.

추가 검증:

- keyboard-only
- focus trap / return
- 200% zoom
- contrast
- screen reader semantics
- mobile keyboard viewport

## 5. 편집기 제품 방향

편집기 제품 방향은 아래 문서만 사용한다.

`docs/PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md`

핵심:

**광고용 문의 페이지를 빠르게 만들고, 문의를 바로 관리하고, 유입/전환까지 한곳에서 보는 도구.**

PageRo는 Framer/Wix의 디자인 자유도를 복제하는 범용 builder가 아니다.

편집기 개편 우선순위:

1. 유지보수 구조 정상화
2. shell 단순화
3. 구조/추가 + canvas + inspector
4. edit/style 중복 이동 제거
5. 완성형 section preset
6. 문의/전환 cockpit
7. AI first-page flow
8. 실사용 데이터 이후 A/B test

## 6. 현재 실제 편집기 경로

`WorkspaceEditorScreen → WorkspaceLeftPanel → WorkspaceActivePanel → EditPanel → EditPanelLayout`

이 경로가 current source다.

제거된 dead path를 다시 복구하지 않는다.

주요 owner:

| 영역 | 우선 파일 |
| --- | --- |
| editor shell | `src/screens/WorkspaceEditorScreen.jsx` |
| left workspace | `src/screens/workspace/WorkspaceLeftPanel.jsx` |
| active panel | `src/screens/workspace/WorkspaceActivePanel.jsx` |
| edit panel | `src/editor/EditPanel.jsx` |
| edit layout | `src/editor/EditPanelLayout.jsx` |
| block order | `src/editor/editPanelParts/ScreenOrder*.jsx/css` |
| save | `src/runtime/usePageSaveAction.js` |
| history | `src/runtime/pageEditHistory.js` |
| revision | `src/lib/pageRevisionRestore.js`, `PageRevisionHistorySection.jsx` |
| media | media context/picker/settings + `fileRepository.js` |
| settings | `src/panels/SettingsPanel.jsx`, `src/panels/settings/**` |
| production root | `functions/index.js` — 내부 작업에서 보호 |

## 7. 작업 단위

한 PR에 다음을 섞지 않는다.

- maintenance cleanup
- editor redesign
- save/API/schema
- domain provider
- billing provider
- production home redesign

권장 순서:

1. cleanup PR
2. release-blocker PR
3. editor shell PR
4. section/pattern PR
5. conversion cockpit PR

## 8. QA 기준

최소:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

편집기 변경 추가 확인:

- desktop
- narrow desktop
- public mobile 360 / 390 / 430
- keyboard
- pointer
- console error 0
- horizontal overflow 0
- protected production-home diff 0

## 9. 중단 조건

별도 승인 없이 실행하지 않는다.

- production D1 write
- 실제 결제/청구 활성화
- Cloudflare custom domain 실제 attach/detach
- 실사용자 데이터 파괴/대량 삭제
- production home 디자인/문구 변경
- production deploy

## 10. 문서 기준

PageRo current source:

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
4. 이 문서
5. `docs/PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md`
6. `docs/PAGERO_PLAN_POLICY_KO.md`

완료된 패치 문서를 다시 current source로 사용하지 않는다.
