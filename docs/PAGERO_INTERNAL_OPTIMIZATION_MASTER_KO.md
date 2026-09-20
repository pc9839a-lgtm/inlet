# PageRo 내부 기능 최적화 마스터

- 문서 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-09-20 KST
- 저장소: `pc9839a-lgtm/inlet`
- 운영 기준 브랜치: `main`
- 현재 main HEAD: `053f4fe9cd3cef02e46e898570922d7ba347fb9a`
- 최근 production 검증 코드 SHA: `c899c3b7e4af76c25040b8cab0bfe0302fff2710`
- 현재 실행 단계: `P4 — 저장/Undo/Revision 연결 검증`
- 현재 문서 작업 브랜치: `docs/pagero-p4-execution-plan-20260920`
- 문서 최신 기준: current main + P3 production closeout + P4 실행계획
- 운영 도메인: `https://pagero.kr/`
- 범위: PageRo 내부 편집기, 워크스페이스, 설정, 저장/발행, 미디어, 도메인, 운영 기능
- 명시적 비범위: 운영 메인 랜딩 개편

이 문서는 PageRo 내부 기능의 현재 상태, 남은 작업, 작업 순서, 금지사항을 한곳에서 관리한다. 과거 편집기 패치 문서와 병렬 패치 문서는 이 문서로 대체한다.

## 0. 상태 해석 규칙

이 문서에서 아래 상태는 서로 다른 의미다. 절대 합쳐서 해석하지 않는다.

| 상태 | 의미 |
| --- | --- |
| 구현 완료 | 코드가 해당 브랜치에 존재 |
| QA 완료 | 자동/브라우저 검증을 통과 |
| PR 병합 | 대상 브랜치에 병합됨 |
| main 병합 | 운영 소스 브랜치 `main`에 포함 |
| 배포 완료 | Cloudflare Pages 운영 배포가 실행됨 |
| migration 적용 | 운영 D1에 승인된 migration write가 수행됨 |
| 운영 검증 | 실제 운영 URL/인증 화면/공개 페이지에서 확인 완료 |

**#236, #238, #239, #240과 P2 closeout에 이어 #242 P3 미디어 UX도 main 병합·운영 배포·readiness·production D1 save roundtrip까지 완료됐다. 다음 실행 단계는 P4 저장/Undo/Revision 연결 검증이다.**

### 0.1 현재 상태 대시보드

| 영역 | 현재 상태 | 기준 |
| --- | --- | --- |
| 운영 메인 | 동결 / 유지 | `main` + `functions/index.js` |
| 편집기 구조 1~6차 | main 반영 완료 | #213~#218 계열 |
| 저장/복구/undo/revision | main 반영 완료 | current main |
| 이미지/영상 재사용·미디어 보관함 | production verified / P3 완료 | #242 / P3 |
| 문서 통합/구 문서 제거 | production verified | #236 |
| 불필요 랜딩 소스 제거 | production verified | #236 + 폐기 #212 branch cleanup |
| 고정영역 모바일 44px | production verified | #236에 #237 squash 포함 |
| legacy/shared CSS 충돌 정리 | production verified | #238 |
| real-use 편집 전체 회귀 | production verified / P2 완료 | #239 + #240 / P2 |
| 개인 도메인 운영화 | draft stack | #233 → #234 → #235 |
| 웹 결제/구독 | 부분 구현 / 운영 lifecycle 미완료 | P7 |
| production deploy | #236/#238/#239/#240/#242 production verified | Cloudflare Pages |

### 0.2 2026-09-20 실행 체크포인트

현재 상태를 다시 확인한 결과:

- #236 문서통합/구 문서·불필요 랜딩 정리: main 병합 및 production verified
- #238 legacy/shared editor CSS 정리: production verified
- #239 + #240 real-use editor regression/P2: production verified
- #242 media UX/P3: production verified
- 현재 main HEAD: `053f4fe9cd3cef02e46e898570922d7ba347fb9a`
- 최근 명시적으로 production 검증된 기능 기준 SHA: `c899c3b7e4af76c25040b8cab0bfe0302fff2710`
- 따라서 **현재 main HEAD와 마지막 production-verified SHA를 같은 것으로 취급하지 않는다.**

다음 실행 단계는 P4다. P4에서는 새 저장 기능을 만드는 것이 아니라, 이미 존재하는 아래 기능 사이의 **상태 전이 충돌**을 검증한다.

1. editor mutation
2. local draft
3. undo/redo history
4. revision restore
5. save/publish request identity
6. stale response protection
7. conflict recovery
8. public readback

P4 완료 전에는 아래를 완료라고 쓰지 않는다.

- "저장 완벽"
- "revision 복원 완벽"
- "undo/redo 완벽"
- "발행 안정화 완료"

각 기능이 개별 QA를 통과했다는 사실과, 서로 연결된 상태 전이가 안전하다는 사실은 별도다.

### 0.2 2026-09-18 정리 작업 기록

완료된 정리:

- `docs/PAGERO_EDITOR_INTERACTION_PATCH_HANDOFF_KO.md` 제거
- `docs/pagero-home-copy-plan.md` 제거
- `docs/parallel-patch/README.md` 제거
- `docs/parallel-patch/remaining-patches.md` 제거
- `docs/parallel-patch/worker-1~5-*.md` 제거
- `src/screens/PageroExactHome.jsx` 제거
- `src/screens/PageroRestoredHome.jsx` 제거
- 폐기 PR #212 브랜치의 `functions/landing-preview.js` 제거
- stale PageRo PR #41, #49, #100, #162, #163, #232 close
- old parallel-patch 문서를 직접 읽던 integration QA를 이 마스터 문서 기준으로 변경
- fixed block 모바일 컨트롤 44px 패치 #237을 #236 후보 브랜치에 squash 병합

최종 합본 QA:

- `qa`: success
- `browser-regression`: success
- `editor-browser-regression`: success
- `form-browser-regression`: success
- `template-mobile-browser-regression`: success
- PR-triggered production deploy workflows: skipped

보호된 운영 메인 파일은 변경하지 않았다.

## 1. 최상위 원칙

### 1.1 운영 메인은 동결

`https://pagero.kr/` 메인은 현재 운영 기준본이다. 내부 기능 작업 때문에 디자인, 문구, 섹션, 메뉴, 푸터, 애니메이션, 생활정보 브리지, 로그인/시작 동작을 바꾸지 않는다.

운영 메인 보호 기준과 DOM 신호는 `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`를 따른다.

### 1.2 내부 기능이 작업 대상

현재 작업 대상은 다음이다.

- 편집기 블록 목록/선택/설정
- 위젯 추가/검색/최근 사용
- 모바일 미리보기와 공개 페이지 일치
- 공유/고정 UI/폼 입력 UX
- 타이머/위젯 편집기
- 실행 취소/다시 실행
- 임시보관/발행/충돌/복구
- 저장 버전과 복원
- 이미지/영상 업로드 및 재사용
- 미디어 보관함
- 설정
- 개인 도메인
- 계정/매니저/권한
- 접수함/통계
- 요금/결제/추천인/파트너/정산
- SEO/추적/전환
- 운영 QA/백업/배포/롤백

### 1.3 대체 랜딩 금지

사용자가 운영 메인 변경을 명시하지 않은 상태에서 다음을 만들거나 남겨두지 않는다.

- 전환형 메인 랜딩 미리보기
- 실험용 PageRo 메인 랜딩
- 구 랜딩 복제품
- 사용하지 않는 대체 Home 컴포넌트
- 운영에 연결되지 않는 landing preview function
- 폐기된 메인 개편 기획 문서

실험 랜딩이 잘못 만들어졌다면 닫는 것만으로 끝내지 않고, 실제 파일/브랜치의 사용하지 않는 소스도 제거한다.

## 2. 현재 내부 기능 기준선

다음은 현재 `main`의 baseline이며 재구현하지 않는다.

### 2.1 편집기 구조

- 페이지 옵션 / 화면 순서 상위 모드 분리
- 전역 설정과 일반 블록/고정 영역 분리
- 일반 블록 목록과 선택 블록 상세 설정 분리
- 선택 블록 설정 중복 렌더링 제거
- 고정 영역: 상단 메뉴 / 하단 고정 버튼 / 푸터
- 블록 표시/숨김
- 블록 드래그 정렬
- 위/아래 이동
- 복제/삭제

### 2.2 블록 추가

- 위젯 검색
- 카테고리
- 최근 사용 최대 5개
- 기존 add-block 흐름 유지

### 2.3 공개/미리보기 상호작용

- 상단 메뉴 자동 분산
- 모바일 네이티브 공유
- 공유 버튼 4방향 위치
- 상단/하단 fixed UI 충돌 회피
- 폼/예약 입력 중 fixed UI 자동 숨김
- 미리보기/공개 페이지 fixed UI parity
- 360 / 390 / 430px 회귀 테스트 기반

### 2.4 타이머

실제 저장 variant는 다음 5종을 유지한다.

- `minimal`
- `flat`
- `block`
- `line`
- `point`

기존 데이터 호환용 legacy mapping은 유지한다.

### 2.5 저장/발행/복구

- 저장 identity 및 stale response 방어
- 입력을 계속하는 동안 이전 저장 응답이 최신 편집본을 덮지 않도록 보호
- 브라우저 로컬 임시보관
- 발행과 임시보관 의미 분리
- 충돌 처리
- 페이지 전환/새로고침 관련 unsaved 보호
- 저장 버전 조회
- 과거 버전 편집본 불러오기
- 실행 취소/다시 실행
- `Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`

### 2.6 미디어

- 프로젝트 이미지 재사용
- 프로젝트 영상 재사용
- 미디어 보관함
- 이미지/영상 필터
- 파일 검색
- 자산 URL 복사
- 현재 페이지 사용 중 삭제 차단
- 과거 revision 참조 미디어 삭제 경고
- guarded delete API

## 3. 현재 확인된 미완료/개선 영역

### P0 — 편집기 모바일 컨트롤 일관성 — 후보 완료

일반 화면순서 V2는 모바일 44px 터치 영역으로 이미 보강되어 있고, #236 후보에는 고정 영역까지 보강됐다.

후보 반영 내용:

- 고정 영역 `.fixed-open-button`: 모바일 44x44 hit target
- 고정 영역 visibility switch: 실제 46x44 hit target
- switch 시각 track: 기존 46x28 유지
- 공용 `Switch`에 optional `className`을 추가해 fixed block에만 scoped override
- 데스크톱 크기/밀도 유지
- 전체 legacy CSS 재작성 없음

상태:

- 구현: 완료
- QA: 완료
- #236 반영: 완료
- main 병합: 완료
- 운영 배포: 완료
- production readiness / D1 save roundtrip: 통과

### P1 — 구/신 편집기 CSS 충돌 감사 — 후보 완료 (#238)

현재 실제 편집기 진입 경로는 다음이다.

`WorkspaceEditorScreen → WorkspaceLeftPanel → WorkspaceActivePanel → EditPanel → EditPanelLayout`

`EditWorkbench.jsx` 파일은 저장소에 남아 있지만 현재 `WorkspaceActivePanel`의 edit 탭 진입 경로는 `EditPanel`을 직접 사용한다. 따라서 새 편집기 구조 판단을 `EditWorkbench` 기준으로 하면 안 된다.

현재 일반 블록 화면순서의 실제 DOM은 `screen-order-v2-*` 계열이다.

- `screen-order-v2-item`
- `screen-order-v2-head`
- `screen-order-v2-drag`
- `screen-order-v2-title-wrap`
- `screen-order-v2-visibility-button`
- `screen-order-v2-action`
- `screen-order-v2-menu`

반면 `editor-final-clean.css`에는 과거 일반 블록용 selector가 함께 남아 있다.

#### 1차 selector 분류

| selector | 현재 판단 | 근거/조치 |
| --- | --- | --- |
| `.screen-order-item.block-item` | legacy 후보 | 현재 `ScreenOrderRow.jsx`는 `screen-order-v2-item` 사용. repo-wide 참조 최종 확인 후 제거 후보 |
| `.screen-order-head.block-head` | legacy 후보 | 현재 일반 블록 head는 `screen-order-v2-head`. 고정영역은 별도 `fixed-block-head` 사용 |
| `.screen-title-wrap` | legacy 후보 | 현재 일반 블록 title은 `screen-order-v2-title-wrap` |
| `.screen-drag-handle` | legacy 후보 | 현재 drag는 `screen-order-v2-drag` |
| `.screen-row-action-menu` | 고위험 legacy 후보 | `ScreenOrderRowActionMenu.jsx` 파일은 존재하지만 현재 `ScreenOrderRowActions.jsx`는 portal 기반 `screen-order-v2-menu`를 직접 렌더링. import 사용처 확인 후 정리 |
| `.screen-icon-action` | **현재 사용 중** | `IconAction` 공용 컴포넌트가 이 class를 생성하며 fixed block header에서 사용 |
| `.fixed-open-button` | **현재 사용 중** | `FixedBlockCardHeader.jsx`의 고정영역 열기/닫기 버튼 |
| `.switch-clean` | **현재 사용 중** | 공용 `Switch` 컴포넌트. fixed block/animation 등 여러 곳 영향 |
| `.fixed-block-head` | **현재 사용 중** | `FixedBlockCardHeader`, `AnimationOptionsHeader`에서 사용 |

#### 정리 원칙

- `legacy`라는 이름만 보고 `editor-final-clean.css`를 통째로 삭제하지 않는다.
- 일반 블록 V2 selector와 고정영역 공용 selector를 분리해서 본다.
- `.screen-icon-action`, `.fixed-open-button`, `.switch-clean`, `.fixed-block-head`는 현재 사용 중이므로 전역 삭제 금지.
- 일반 블록 구 selector는 repo-wide import/class reference 확인 + browser QA를 붙인 뒤 작은 패치로 제거한다.
- `ScreenOrderRowActionMenu.jsx` 같은 과거 컴포넌트는 import 0건이 확인되면 소스와 대응 CSS를 함께 제거하는 방향으로 본다.
- CSS cleanup PR에서는 저장/발행/API/public renderer 변경을 섞지 않는다.

#### P1 #238 반영 결과

- 실제 일반 블록 layout owner는 계속 `ScreenOrder.css`의 `screen-order-v2-*` 계열 유지
- `editor-final-clean.css`에서 구 일반 블록 selector 제거
- `editor-screen-order-polish.css`에서 동일 구 selector 중복 제거
- 현재 사용 중인 `.screen-icon-action`, `.fixed-open-button`, `.switch-clean`, `.fixed-block-head` 유지
- import 0건 dead chain 제거
  - `ScreenOrderRowActionMenu.jsx`
  - `screenOrderRowMenuItems.js`
  - `useScreenOrderRowMenu.js`
- `editor-options-layout-quality-check.mjs`에 legacy selector/source 재유입 금지 계약 추가
- 저장/발행/API/D1/public renderer 변경 없음

#238 QA:

- `qa`: success
- `browser-regression`: success
- `editor-browser-regression`: success
- `form-browser-regression`: success
- `template-mobile-browser-regression`: success
- production deploy workflows: skipped

상태:

- 구현: 완료
- QA: 완료
- #238: main 병합 완료
- #236 반영: 완료
- 운영 배포: 완료
- production readiness / D1 save roundtrip: 통과

### P2 — 편집 전체 real-use audit

아래 실제 사용자 흐름을 하나의 회귀 시나리오로 검증한다.

`페이지 열기 → 블록 추가 → 텍스트 수정 → 이미지 재사용 → 영상 재사용 → 순서 변경 → 노출 변경 → 스타일 변경 → undo/redo → 미리보기 → 계속 입력 → 발행 → 새로고침 → 공개 readback`

#### P2 테스트 매트릭스

| ID | 사용자 동작 | 기대 결과 |
| --- | --- | --- |
| E2E-01 | 기존 페이지 열기 | 저장된 블록/순서/전역설정이 그대로 로드 |
| E2E-02 | 블록 추가 | 추가된 블록이 목록에 생기고 바로 선택 가능 |
| E2E-03 | 선택 블록 텍스트 연속 수정 | 입력 중 값이 튀거나 이전 값으로 돌아가지 않음 |
| E2E-04 | 기존 이미지 재사용 | 선택한 자산이 블록에 반영되고 미리보기와 일치 |
| E2E-05 | 기존 영상 재사용 | 지원 영상이 블록에 반영되고 재생 가능한 상태 유지 |
| E2E-06 | 드래그/위아래 이동 | 블록 순서와 미리보기 순서가 동일 |
| E2E-07 | 표시/숨김 변경 | editor/preview/public 표시 상태가 정책대로 일치 |
| E2E-08 | undo → redo | 직전 편집 단위가 역/재적용되고 다른 블록을 덮지 않음 |
| E2E-09 | 미리보기 열기 후 편집 계속 | 미리보기가 편집 상태를 깨거나 selection을 초기화하지 않음 |
| E2E-10 | 발행 클릭 직후 계속 입력 | 발행 응답이 이후 입력을 덮지 않음 |
| E2E-11 | 새로고침 | 마지막 저장 상태와 로컬 복구 정책이 모순되지 않음 |
| E2E-12 | 공개 페이지 readback | 발행본과 공개 페이지가 일치 |
| E2E-13 | 좁은 데스크톱 | 좌측 패널/미리보기/설정에 가로 overflow 없음 |
| E2E-14 | 360/390/430 | 주요 조작부가 화면 밖으로 밀리지 않고 고정 UI 충돌 없음 |

실패 시 원칙:

- 실패한 단계만 최소 패치
- 그 전 단계까지 통과한 기능을 재설계하지 않음
- 저장/API/schema 변경이 필요해 보이면 먼저 재현 로그와 request/response 순서를 확인
- screenshot-only 성공을 기능 성공으로 보지 않음

#### P2 #239 production 반영 결과

실제 브라우저 회귀에 추가된 흐름:

- 블록 추가 → undo → redo
- 표시/숨김 변경
- 현재 `screen-order-v2` 메뉴를 통한 위로 이동
- 스타일 draft → 적용
- 미리보기 실행 후 같은 편집기에서 계속 입력
- 첫 발행 응답을 지연시킨 상태에서 추가 입력
- 늦은 첫 응답이 최신 입력을 덮지 않는지 확인
- 변경 중 저장 발생 시 automatic trailing save가 최신 입력을 저장하는지 확인
- 공개 검증 debounce가 이전 검증을 supersede하고 최신 저장본을 검증하는 흐름 확인
- 새로고침 후 마지막 저장 상태 확인
- 1180px narrow desktop overflow 검사
- 360 / 390 / 430 모바일 회귀 유지

#239에서 실제로 발견해 수정한 제품 오류:

- `screenOrderMovement.js`의 `moveUp/moveDown`이 event 인자를 강제하고 있었음
- 현재 portal overflow menu는 이동 action을 event 없이 호출하므로 `event.stopPropagation()`에서 이동이 중단됨
- 이동 action을 event-independent 함수로 변경해 실제 메뉴 이동 복구
- contract QA에 event 의존 재도입 금지 추가

저장 회귀에서 확인한 현재 정상 계약:

- 저장 중 추가 편집이 생기면 사용자가 발행 버튼을 다시 누르지 않아도 automatic trailing save 수행
- 연속 저장에서는 이전 public verification job을 최신 저장 검증이 supersede할 수 있음
- 따라서 save request 수와 public readback request 수를 1:1로 가정하지 않는다

#239 검증/배포 상태:

- `qa`: success
- `browser-regression`: success
- `editor-browser-regression`: success
- `form-browser-regression`: success
- `template-mobile-browser-regression`: success
- main 병합: 완료 — `58f0c6c285e1457df0faa32bc1e081e8efcb2553`
- Cloudflare production deploy: 완료
- exact deployment readiness: success
- `https://pagero.kr/api/readiness`: success
- production D1 save roundtrip: success

#### P2 #240 마지막 회귀 보강

영상 재사용 E2E:

- 실제 `YouTubeEditor` / `VideoLibraryPicker` 경로 사용
- `/api/files/list?kind=video` project/owner/slug scope 검증
- 기존 MP4 선택
- editor state의 `videoUrl` / `videoFileName` 반영 확인
- preview의 실제 `<video>`가 선택 URL을 사용하고 `readyState >= 1`인지 확인
- 명시적 발행 전 server save 0건 확인
- 발행 + public verification
- reload 후 URL/fileName/playable metadata 상태 유지 확인

pointer drag E2E:

- 직접 `drop` handler를 호출하지 않음
- Chrome CDP `Input.dispatchMouseEvent`로 실제 draggable handle에서 drop-zone까지 mouse press/move/release 수행
- drag 후 일반 블록 DOM 순서가 실제 변경되는지 확인
- 기존 메뉴 기반 위/아래 이동 E2E도 함께 유지

#240 QA:

- `qa`: success
- `browser-regression`: success
- `editor-browser-regression`: success
- `form-browser-regression`: success
- `template-mobile-browser-regression`: success

#240 QA 중 발견한 테스트 안정성 이슈와 조치:

- 영상 E2E 첫 실행에서 editor route 전환 직후 row click이 React rerender와 겹치는 간헐 실패 확인
- 재시도에서는 Chrome CDP가 navigation 순간 `Inspected target navigated or closed`를 반환하는 transient 오류 확인
- 기능 검증 조건을 완화하지 않고 영상 E2E의 navigation 대기만 보강
- `waitForBrowser`는 navigation/context-destroy transient 오류에 한해 재시도
- `clickSelector`는 element가 실제 DOM에 연결된 상태에서 최대 5초 동안 재확인
- 영상 URL/fileName, `readyState >= 1`, local-only, publish, public verification, reload 조건은 그대로 유지
- 안정화 후 전체 5개 QA 재통과

P2 상태:

- 기능 구현: 완료
- real-use browser QA: 완료
- E2E-01 ~ E2E-14: 완료
- #240 main 병합: 완료 — `f9a325d0e175f08f060445b2d04c06935f5bacbf`
- #240 운영 배포: 완료
- Cloudflare exact deployment: `https://473a2c22.inlet-8mr.pages.dev`
- exact deployment readiness: success
- `https://pagero.kr/api/readiness`: success
- production D1 save roundtrip: success
- P2 production verified: 완료

### P3 — 미디어 UX 마감

현재 미디어 기능은 존재하므로 새 보관함을 다시 만들지 않는다. 아래 UX 일관성만 마감한다.

#### P3 테스트 매트릭스

| ID | 항목 | 기대 결과 |
| --- | --- | --- |
| MEDIA-01 | 이미지 선택기 빈 상태 | 빈 이유와 다음 행동이 한 화면에서 이해됨 |
| MEDIA-02 | 영상 선택기 빈 상태 | 이미지 선택기와 용어/버튼 체계가 일관됨 |
| MEDIA-03 | 로딩 | 중복 요청 없이 로딩 상태가 명확함 |
| MEDIA-04 | 오류/재시도 | 오류 원인 문구는 짧고 재시도 동작이 명확함 |
| MEDIA-05 | 검색 | 파일명/자산 키 검색 결과가 필터와 충돌하지 않음 |
| MEDIA-06 | 이미지/영상 필터 | 전체/이미지/영상 수량과 목록이 일치 |
| MEDIA-07 | 현재 페이지 사용 중 삭제 | 삭제 차단 이유가 즉시 보임 |
| MEDIA-08 | 과거 revision 참조 삭제 | 복원 시 미디어 손실 위험을 명확히 경고 |
| MEDIA-09 | 대량 자산 pagination | 더보기 중 중복 카드/순서 역전 없음 |
| MEDIA-10 | 좁은 PC/모바일 | 카드/action이 가로로 삐져나오지 않음 |

용어 원칙:

- 설정 화면은 `미디어 보관함`
- 선택기 동작은 `기존 이미지 선택` / `기존 영상 선택`처럼 행동 중심
- 자산 키 같은 내부 용어는 검색 보조 외에는 과도하게 노출하지 않음
- `사용 중`, `삭제`, `주소 복사`, `새로고침`의 의미를 화면마다 바꾸지 않음

#### P3 #242 구현 후보

현재 반영된 UX:

- 이미지 선택기 오류 상태에 `다시 시도` action 추가
- 영상 선택기 오류 상태에도 동일한 `다시 시도` action 추가
- pagination이 남아 있는 필터 수량은 `100+`처럼 부분 로드임을 표시
- 검색 결과가 없더라도 해당 종류에 아직 불러올 자산이 남아 있으면 전체 미디어를 검색한 것처럼 단정하지 않음
- 남은 자산이 있는 검색 실패에는 `더 불러오기` 후 재검색 안내
- 1080px 이하 narrow desktop에서 필터/검색 controls를 1열로 전환
- media grid는 narrow desktop 2열, 420px 이하 1열 유지
- 기존 현재 페이지 사용 중 삭제 차단 / revision 2차 확인 정책은 유지

추가된 실제 browser E2E:

- 설정 탭 → `미디어 보관함` 실제 진입
- 초기 목록 오류 → 오류 원인 표시 → `다시 시도`
- pagination이 남은 상태의 `전체 2+ / 이미지 1+ / 영상 1` 수량 표시
- 파일명 검색
- 이미지/영상 필터
- 이미지 더보기 cursor 요청
- 다음 page에 중복 asset이 있어도 카드 1개만 유지
- 현재 페이지 사용 중 asset의 삭제 버튼 disabled 확인
- revision-only asset 삭제 시 첫 요청은 override 없이 실패
- 과거 버전 손실 경고 후 두 번째 요청에만 `allowRevisionReferences=true`
- 980px narrow desktop에서 보관함/controls 가로 overflow 없음

#242 QA 결과:

- `qa`: success
- `browser-regression`: success
- `editor-browser-regression`: success
- `form-browser-regression`: success
- `template-mobile-browser-regression`: success
- media settings browser scope: `media-library-settings-browser-e2e`
- 실제 통과 flow: `error-retry / pagination-dedupe / revision-double-confirm / narrow-desktop`

#242 production 결과:

- 구현: 완료
- 정적 계약: 완료
- browser E2E: 완료
- PR QA: 완료 5/5
- main 병합: 완료 — `c899c3b7e4af76c25040b8cab0bfe0302fff2710`
- main 재QA: 완료 5/5
- Cloudflare production deploy: 완료
- exact deployment: `https://731fc398.inlet-8mr.pages.dev`
- exact deployment readiness: success
- `https://pagero.kr/api/readiness`: success
- production D1 save roundtrip: success
- production verified: 완료

P3 완료 판정 원칙:

- MEDIA-01~10 중 코드로 이미 충족된 항목도 browser/static 계약으로 고정
- #242 HEAD 전체 QA 5/5 통과
- main 병합 후 동일 QA 재통과
- Cloudflare production metadata/readiness 통과
- production D1 save roundtrip 통과
- 마지막 closeout에서만 P3를 production verified로 변경

### P4 — 저장/Undo/Revision 연결 검증

#### P4 1차 코드 감사 결과 — 2026-09-20

실제 연결을 끝까지 추적한 결과, `PageRevisionHistorySection`의 `setPage` prop 이름만 보면 raw React setter처럼 보이지만 운영 wiring은 다음과 같다.

`createWorkspacePanelProps.settingsPanelProps.setPage = setNormalizedPage`
→ `SettingsPanel`
→ `SettingsPanelBody`
→ `SettingsAdvancedAndReset`
→ `PageRevisionHistorySection`

`setNormalizedPage`는 내부에서 `commitLocalPageDraft`를 호출하고, 이 경로가 `recordPageEditMutation`과 local mutation counter를 함께 갱신한다. 따라서 현재 main 코드 기준 revision restore는 실제로 canonical local draft/history 경로를 통과한다.

1차 감사 결론:
- revision restore의 canonical mutation/history wiring 자체는 수정 필요 없음
- 잘못된 직접 server restore 호출 없음
- page identity/revision/credentials 보존 규칙 유지
- 교차 상태전이 회귀가 비어 있어 **revision restore ↔ undo/redo ↔ publish ↔ readback** 브라우저 시나리오를 추가
- 추가 감사에서 `useLocalWorkspacePersistence`의 사용자 편집 감지 selector가 legacy `.settings-panel`만 보고 현재 `.settings-v3-root`를 누락한 것을 확인
- 이 누락 때문에 버전 불러오기/설정 변경이 dirty/recovery intent로 잡히지 않을 수 있어 `.settings-v3-root`를 감지 범위에 추가
- browser E2E에서 revision restore 직후 native unsaved navigation guard까지 검증
- 후보 브랜치: `test/pagero-p4-save-history-transition-20260920`
- PR QA/main 병합/production verified 전에는 P4 완료로 표시하지 않음

#### P4 실행 절차

P4는 아래 순서로만 진행한다.

**A. 코드 경로 확인**
- `src/runtime/pageEditHistory.js`
- `src/runtime/usePageSaveAction.js`
- `src/runtime/pageDraftMutations.js`
- `src/runtime/pageEditMutations.js`
- `src/runtime/pageSaveFeedback.js`
- `src/runtime/saveStatusActions.js`
- `src/runtime/workspaceUnsavedGuard.js`
- `src/panels/settings/PageRevisionHistorySection.jsx`
- `src/lib/pageRevisionRestore.js`

**B. 기존 QA 확인**
- save identity
- network recovery
- draft recovery
- revision restore
- publish semantics
- editor browser regression

기존 QA가 있으면 중복 스크립트를 만들지 않고, **교차 상태전이가 빠진 부분만 추가**한다.

**C. 반드시 브라우저에서 재현할 순서**
1. 텍스트 A 입력
2. undo
3. redo
4. 발행
5. 바로 텍스트 B 추가 입력
6. 첫 발행 응답 대기
7. B가 유지되는지 확인
8. 과거 revision 불러오기
9. 추가 수정 C
10. undo/redo
11. 발행
12. 새로고침
13. 공개 페이지 readback 비교

**D. 실패 시 수집할 값**
- client mutation sequence
- save request id
- save mode
- request 시작 시 revision
- 응답 revision
- 응답 도착 순서
- 현재 editor state hash 또는 핵심 필드
- local draft 존재 여부
- history canUndo/canRedo
- restored revision id
- conflict payload
- public readback 결과

**E. 패치 원칙**
- 실패한 상태전이만 수정
- 저장 API shape 변경 금지, 실제로 필요한 경우 별도 PR
- D1 schema 변경 금지
- public renderer 변경 금지
- undo history 전체 재설계 금지
- revision restore를 자동 publish로 바꾸지 않음
- stale response 방어를 약화하지 않음

#### P4 완료 게이트

P4를 완료로 바꾸려면 다음이 모두 필요하다.

- SAVE-01~SAVE-10 전부 PASS
- 정적 contract PASS
- `qa:all` PASS
- authenticated editor browser regression PASS
- form/browser/template-mobile 회귀 PASS
- 보호 홈 diff 0
- 새로고침 후 서버 readback PASS
- 공개 페이지 readback PASS
- production 배포 여부 별도 기록
- production verified 여부 별도 기록



서로 개별 구현된 기능이 한 흐름에서 충돌하지 않는지 검증한다.

#### P4 상태 전이 검증

| ID | 순서 | 기대 결과 |
| --- | --- | --- |
| SAVE-01 | 수정 → undo → 발행 | undo된 상태가 발행되며 이전 수정이 되살아나지 않음 |
| SAVE-02 | 수정 → undo → redo → 발행 | redo된 최신 상태가 발행 |
| SAVE-03 | revision 불러오기 → 추가 수정 | 불러온 버전 위에서 정상 편집 |
| SAVE-04 | revision 불러오기 → undo | 복원 작업과 직후 편집 history 경계가 예측 가능 |
| SAVE-05 | revision 불러오기 → 발행 | 공개 페이지는 발행 전까지 유지, 발행 후에만 변경 |
| SAVE-06 | 저장 요청 A → 추가 입력 → 저장 응답 A | 응답 A가 추가 입력을 덮지 않음 |
| SAVE-07 | 저장 요청 A/B 응답 역전 | 더 오래된 응답이 최신 revision/state를 덮지 않음 |
| SAVE-08 | revision conflict 발생 | local draft 보존 + 사용자가 선택 가능한 복구 흐름 |
| SAVE-09 | conflict 해결 후 재발행 | 선택한 최종 상태만 공개 반영 |
| SAVE-10 | 발행 후 public readback | 서버 저장본과 공개 페이지 내용 일치 |

필수 관찰값:

- save request id
- save mode
- revision
- local draft 존재 여부
- latest editor state
- server returned state
- public readback

금지:

- save 성공 토스트만 보고 성공 판정
- revision 숫자만 올라갔다고 최신 입력 보존을 가정
- conflict에서 local draft를 자동 폐기
- revision restore를 즉시 public publish로 취급

### P5 — 개인 도메인 운영화

현재 상태는 **main baseline + 3단계 draft stack**으로 나눠서 본다.

#### P5 현재 구현현황

현재 `main`에 이미 존재하는 기능:

- 설정 화면의 개인 도메인 입력 UI
- `page.integrations.domain.hostname` 저장
- CNAME 대상 `inlet-8mr.pages.dev` 안내
- 저장된 hostname 기반 custom-host 공개 라우팅
- 기본적인 도메인 형식 검증
- HTTPS/SSL add-on 상태 표시와 결제 진입 연결

현재 draft stack:

- PR #233 — canonical ownership core
  - `0015_page_domain_ownership.sql`
  - `page_domains` canonical ownership/lifecycle mirror
  - apex / `www.` 동등 hostname canonical key
  - 중복 active ownership 차단
  - reserved hostname 차단
  - page insert/update/archive 시 ownership sync/release
- PR #234 — provider/DNS/SSL operations
  - Cloudflare Pages custom-domain 등록/확인/삭제
  - DNS CNAME 확인
  - SSL/provider 상태 저장
  - provider API origin 고정, redirect 차단, timeout
  - allowlisted DNS-over-HTTPS만 허용
  - provider cleanup 불가 시 fail-closed detach
- PR #235 — 현재 설정 UI와 server operations 연결
  - `/api/domains/check`
  - `/api/domains/manage`
  - availability check → page save → provider verify
  - provider detach → page save
  - canonical `page_domains` 상태를 UI에 표시

현재 상태:

- main baseline: 구현 완료 / 운영 중
- #233~#235: 구현 + PR QA 완료
- #233~#235 main 병합: 아직 아님
- `0015_page_domain_ownership.sql` 운영 적용: 아직 아님
- Cloudflare provider credential 운영 적용: 아직 아님
- 실제 DNS/SSL 연결 운영 검증: 아직 아님

규칙:

- 오래된 PR #41 전체 재병합 금지
- #233 → #234 → #235 순서 유지
- production D1 migration은 별도 승인
- Cloudflare provider credential 적용은 별도 승인
- 운영 실제 도메인 연결/교체/해제 테스트는 별도 승인
- provider 상태만 바꾸기 위해 `pages.page_json`을 직접 수정하지 않는다

#### P5 완료조건

개인 도메인을 완료로 판정하려면 아래가 전부 필요하다.

1. #233 → #234 → #235가 순서대로 현재 main에 재검증 후 병합
2. D1 migration read-only preflight에서 pending migration과 SHA 확인
3. 별도 승인 후 encrypted backup 생성
4. `0015_page_domain_ownership.sql` 운영 적용
5. backfill 후 중복 ownership / orphan claim 없음 확인
6. 최소권한 Cloudflare credential과 Pages project 설정
7. 통제된 테스트 서브도메인으로 실제 connect → DNS 대기 → SSL ready 검증
8. 동일 도메인 중복 연결 차단 검증
9. 도메인 교체 시 기존 provider detach 선행 검증
10. provider 오류/credential 누락 시 D1만 먼저 해제되지 않는지 검증
11. custom host 공개 readback이 올바른 page/project에 연결되는지 검증
12. 해제 후 기본 `pagero.kr/<slug>` 주소가 정상 유지되는지 검증

#### P5 테스트 매트릭스

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| DOMAIN-01 | 유효 도메인 availability check | 현재 project/page 기준으로 사용 가능 여부 반환 |
| DOMAIN-02 | 다른 project가 같은 canonical hostname 보유 | 중복 ownership 차단 |
| DOMAIN-03 | apex와 `www.` 변형 충돌 | 동일 canonical ownership으로 취급 |
| DOMAIN-04 | 예약 hostname 입력 | 저장/provider 호출 전에 차단 |
| DOMAIN-05 | 도메인 연결 | page save 성공 후에만 provider verify 실행 |
| DOMAIN-06 | DNS 미설정 | pending 상태 유지, 공개주소를 ready로 가장하지 않음 |
| DOMAIN-07 | DNS 정상 + SSL 준비 | canonical 상태가 connected/ready로 전환 |
| DOMAIN-08 | provider 등록 실패 | page/provider 상태가 모순되지 않고 재시도 가능 |
| DOMAIN-09 | 기존 도메인 → 새 도메인 교체 | 기존 provider detach 성공 전 새 claim으로 덮어쓰지 않음 |
| DOMAIN-10 | provider credential 누락 상태에서 해제 | orphan 가능성이 있으면 fail-closed |
| DOMAIN-11 | custom host 공개 요청 | 정확한 project/page만 렌더링 |
| DOMAIN-12 | 도메인 해제 | provider detach 후 hostname 제거, 기본 주소 정상 유지 |

### P6 — 설정 전체 사용성

설정 기능 자체는 이미 상당 부분 구현돼 있다. P6의 목적은 새 설정 시스템을 만드는 것이 아니라 **현재 메뉴 구조/권한/저장 UX를 실제 사용 흐름에서 마감**하는 것이다.

#### P6 현재 구현현황

현재 설정 내비게이션은 다음으로 분리돼 있다.

기본 영역:

- 페이지 기본
- 미디어 보관함
- 개인 도메인
- 계정 정보
- 매니저 권한

서비스 영역:

- 요금제·결제
- 추천인
- 파트너
- 정산

고급 영역:

- SEO 설정
- 추적 코드
- 전환 설정
- 버전 기록
- 페이지 복제
- 초기화

현재 확인된 권한/구조:

- 기본 설정 / 고급 설정 모드 분리
- client-admin 모드에서는 고급 설정 숨김
- edit 읽기 권한이 없으면 미디어 보관함 숨김
- manager 모드에서는 매니저 관리 숨김
- 요금제·추천인·파트너·정산은 owner finance access에 한정
- 계정/매니저/페이지 설정은 별도 section 컴포넌트로 분리
- revision history는 별도 설정 section으로 분리
- 페이지 복제는 별도 URL modal 사용
- 오류는 `role="alert"`, 상태 안내는 일부 `role="status"` 사용

현재 미완료 판단:

- 설정 전체를 한 사용자 세션에서 이동하는 browser E2E 기준 없음
- 좁은 PC/모바일에서 sidebar → 본문 이동성 전체 검증 필요
- 저장 가능한 section과 즉시 반영 section의 피드백 일관성 검증 필요
- owner/manager/client-admin별 숨김/비활성 정책을 한 matrix로 고정할 필요
- destructive action의 keyboard/focus 복귀까지 포함한 검증 필요

#### P6 완료조건

1. 모든 설정 메뉴가 desktop / narrow desktop / 360 / 390 / 430에서 접근 가능
2. section 전환 시 가로 overflow와 본문 잘림 없음
3. owner / manager / client-admin별 메뉴 노출이 정책과 일치
4. 저장 버튼이 필요한 section과 즉시 반영 section의 UX가 명확히 구분
5. 저장 중 / 성공 / 실패 상태가 중복 토스트나 모순 문구 없이 표시
6. section 전환 후 이전 draft가 의도치 않게 다른 section을 덮지 않음
7. 페이지 복제 / 초기화 / 소유권 이전 같은 위험 작업은 확인 절차가 명확
8. 오류 후 재시도가 가능하고 기존 입력이 보존
9. 키보드만으로 메뉴 이동/주요 입력/저장/취소 가능
10. 권한 없는 기능은 단순 CSS 숨김이 아니라 실제 action도 차단

#### P6 테스트 매트릭스

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| SETTINGS-01 | 기본 ↔ 고급 전환 | 선택 section과 본문이 정확히 동기화 |
| SETTINGS-02 | owner 로그인 | finance/manager/advanced 정책대로 노출 |
| SETTINGS-03 | manager 로그인 | owner-only 메뉴/action 접근 불가 |
| SETTINGS-04 | client-admin 모드 | advanced 영역 미노출, 허용된 기본 section만 접근 |
| SETTINGS-05 | 미디어 read 권한 없음 | 메뉴와 실제 보관함 action 모두 차단 |
| SETTINGS-06 | section 수정 후 다른 section 이동 | 저장/draft 정책대로 값 보존 또는 경고 |
| SETTINGS-07 | 서버 저장 실패 | 입력 보존 + 명확한 오류 + 재시도 가능 |
| SETTINGS-08 | 페이지 복제 | 새 URL 검증 후 복제, 원본 page 영향 없음 |
| SETTINGS-09 | 초기화 | 명시 확인 전 데이터 변경 없음 |
| SETTINGS-10 | narrow desktop | sidebar/content overflow 없음 |
| SETTINGS-11 | 360/390/430 | 메뉴 선택과 본문 이동이 한 손 조작 범위에서 가능 |
| SETTINGS-12 | keyboard only | focus 순서, Enter/Space, Escape가 예측 가능 |

### P7 — 웹 결제/구독

메뉴나 화면 존재와 실제 결제 lifecycle 완료를 혼동하지 않는다. 현재는 **조회/사전검사/확정용 서버 계약과 UI 진입은 존재하지만, 운영 결제 provider lifecycle 전체는 완료로 볼 수 없다.**

#### P7 현재 구현현황

현재 `main`에 존재:

- `BillingSettingsSection`
  - 무료 / 클래식 / 프로 요금제 표시
  - HTTPS·SSL add-on 표시
  - 현재 구독 상태 표시
- `accountFinanceRepository`
  - `/api/billing/finance` 조회
  - 구독/entitlement/referral/settlement 상태 정규화
  - `/api/billing/web/precheck` 호출
  - 허용된 웹 상품은 `/subscribe?product=...`로 이동
- `/api/billing/web/precheck`
  - 중복 활성 구독 방지
  - Google Play / referral / web 구독 충돌 판정
  - 프로 플랜의 domain 포함 여부 판정
- `/api/billing/web/confirm`
  - provider 인증 필요
  - payment reference / external subscription id 수신
  - D1 subscription/payment history 반영
  - entitlement/commission 연계
  - Google Play와 웹 중복 충돌 방어
- `/api/billing/finance`, `subscriptions`, `entitlements`, payment history 관련 서버 코드
- finance/referral 관련 QA workflow 존재

현재 완료로 볼 수 없는 범위:

- 실제 결제 provider checkout UI/SDK와 운영 credential 검증
- billing key 또는 recurring token lifecycle
- provider webhook endpoint와 event signature 검증
- webhook 중복/역순 event idempotency
- 자동 갱신
- 결제 실패 → grace → 만료 전이
- 사용자가 직접 해지하는 완결된 흐름
- provider-side 취소/환불 반영
- invoice/receipt/증빙 UX
- 운영 결제 실거래 smoke
- webhook replay safety
- admin override 전체 audit trail 운영 검증

#### P7 완료조건

1. `/subscribe`에서 실제 provider 결제 성공/실패/취소가 분리 처리
2. 결제 성공은 client callback만 믿지 않고 provider 검증 후 확정
3. 동일 payment reference / webhook event 재전송이 중복 entitlement를 만들지 않음
4. subscription 상태 전이 `active → grace → expired/cancelled`가 서버 기준으로 일관
5. 자동 갱신 성공 시 expires/next billing이 정상 갱신
6. 자동 갱신 실패 시 grace 정책과 기능 제한 시점이 문서 정책과 일치
7. 해지 시 즉시 권한 박탈 여부/기간 종료 후 만료 여부가 제품정책과 일치
8. Google Play 구독과 웹 구독이 이중 과금되지 않음
9. 프로 요금제와 domain add-on 중복 청구 차단
10. 결제 이력/영수증/증빙 조회 가능
11. provider webhook signature + replay + idempotency 검증
12. admin override는 actor/reason/before/after audit가 남음
13. 실제 운영 sandbox 또는 승인된 실거래 smoke 통과
14. `docs/PAGERO_PLAN_POLICY_KO.md`와 화면/서버 entitlement가 일치

#### P7 테스트 매트릭스

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| BILLING-01 | 무료 → 클래식 결제 사전검사 | 허용 후 checkout 진입 |
| BILLING-02 | 이미 웹 클래식 활성 | 중복 결제 차단 |
| BILLING-03 | Google Play 충돌 상품 | 웹 이중 결제 차단 |
| BILLING-04 | 프로 활성 + domain add-on 신청 | 포함 상품 중복 청구 차단 |
| BILLING-05 | provider 결제 성공 | 서버 검증 후 subscription/payment/entitlement 일치 |
| BILLING-06 | 같은 payment reference 재전송 | 중복 결제/중복 entitlement 없음 |
| BILLING-07 | webhook event 중복/역순 | 최신 유효 상태만 반영 |
| BILLING-08 | 갱신 성공 | nextBilling/expiresAt 연장 |
| BILLING-09 | 갱신 실패 | grace 정책 적용, 즉시 임의 만료 금지 |
| BILLING-10 | 해지 | 정책에 맞는 종료 시점까지 entitlement 유지/종료 |
| BILLING-11 | 환불/취소 | 결제 이력과 entitlement가 provider 상태와 일치 |
| BILLING-12 | admin override | actor/reason/before/after audit 존재 |

### P8 — 대량 데이터/운영

현재는 기본 pagination/export/retention 기반이 일부 존재한다. P8은 기능 유무보다 **실제 대량 데이터에서 query/index/메모리/다운로드가 버티는지**를 검증하는 단계다.

#### P8 현재 구현현황

현재 확인된 기반:

- 접수 조회
  - `fetchServerLeads()` cursor/limit 지원
  - 기본 limit 500
  - `withMeta` 시 `total / nextCursor / hasMore`
- 전체 접수 수집
  - `fetchAllServerLeads()`
  - 요청 limit 최대 5,000
  - 수집 max 최대 20,000
  - 기본 max 10,000
  - truncate 시 `partial / hasMore` 반환
- 차단 이력
  - 별도 pagination
  - `total / nextCursor / hasMore`
  - query plan/meta 전달 경로 존재
- CSV
  - client 전체 배열만 내보내는 방식이 아니라 서버 `/api/leads/export.csv` 경로 존재
- 운영
  - audit retention workflow 존재
  - stats quality check 존재
  - lead server smoke/QA 존재

현재 미검증:

- 10k / 50k / 100k 이상 접수에서 응답시간/메모리
- deep cursor/offset 비용
- 통계 장기간 범위 query plan
- CSV 대용량 streaming/timeout/memory
- blocked/spam history 장기간 조회
- audit/delivery retention 실제 운영 실행 결과
- production D1 index 사용 여부
- backup 크기 증가 시 복구시간
- 브라우저에서 대량 목록 렌더링 비용

#### P8 완료조건

1. 대표 데이터 규모를 1k / 10k / 50k 이상으로 정의하고 fixture/load test 보유
2. 접수 목록 첫 페이지와 다음 페이지 응답시간 예산 수립 및 통과
3. pagination 중 누락/중복/순서 역전 없음
4. filter/search/month/date/channel/delivery 조합에서 index 사용 확인
5. 통계 1일/30일/1년 범위 query plan과 시간 예산 확인
6. CSV 대용량 export가 browser memory에 전체 데이터를 올리지 않고 완료
7. export 실패/timeout 시 재시도 가능한 오류 반환
8. blocked/spam history가 장기 데이터에서도 pagination 유지
9. audit/delivery retention이 승인된 기간 기준으로 실제 삭제/보존
10. retention job 재실행이 idempotent
11. backup artifact 크기와 복원 절차 검증
12. 운영 query/index 검증 결과를 문서에 남김

#### P8 테스트 매트릭스

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| DATA-01 | 1k 접수 첫 페이지 | 시간 예산 내 응답, total/nextCursor 정확 |
| DATA-02 | 10k+ pagination 연속 탐색 | 중복/누락/순서 역전 없음 |
| DATA-03 | 50k+ filter/search | full scan 회피 여부와 query plan 확인 |
| DATA-04 | 월/기간 필터 | 경계 날짜 포함 규칙 일치 |
| DATA-05 | blocked history 대량 조회 | pagination과 total 정확 |
| DATA-06 | 30일/1년 통계 | 시간 예산 내 결과, 집계 정확 |
| DATA-07 | 대용량 CSV | timeout/메모리 폭증 없이 완료 |
| DATA-08 | CSV 중간 실패 | 사용자에게 재시도 가능한 오류 제공 |
| DATA-09 | retention dry-run | 삭제 대상/보존 대상 수량 확인 가능 |
| DATA-10 | retention 실제 실행 | 승인된 범위만 삭제, 재실행 안전 |
| DATA-11 | backup 생성/복원 smoke | 무결성 검증 가능 |
| DATA-12 | 브라우저 대량 목록 | 스크롤/필터 시 UI freeze 허용범위 내 |

### P9 — 접근성/모바일 최종 마감

현재 모바일 회귀와 일부 ARIA는 존재하지만, 제품 전체 접근성 완료로 판정할 전용 audit는 없다. P9는 **마지막 release gate**로 별도 수행한다.

#### P9 현재 구현현황

현재 확인된 기반:

- 360 / 390 / 430 템플릿 모바일 browser regression 존재
- 일반 블록 및 #236 후보의 fixed block에 44px touch target 보강
- 설정/결제 일부 영역에 `aria-label`
- 오류 `role="alert"`, 상태 메시지 `role="status"` 일부 적용
- 장식 아이콘에 `aria-hidden="true"` 사용 사례 존재
- 버튼 기반 설정 내비게이션과 `aria-pressed` 일부 적용
- unsaved guard / modal / keyboard shortcut 관련 기존 기능 존재

현재 미검증:

- 전체 앱 keyboard-only 탐색
- visible focus의 화면별 일관성
- 모든 dialog의 focus trap / 초기 focus / focus return
- Escape 동작 충돌
- 모든 icon-only button의 accessible name
- input label/description/error 연결
- 색 대비
- 모바일 키보드가 열린 상태의 viewport/fixed UI 충돌
- 200% zoom / narrow reflow
- screen reader landmark/heading 구조
- drag/reorder의 비포인터 대체 동작 전체 검증

#### P9 완료조건

1. keyboard-only로 로그인 → 대시보드 → 편집기 → 설정 → 발행 핵심 흐름 수행 가능
2. 모든 interactive control에 visible focus 존재
3. icon-only button에 accessible name 존재
4. dialog는 열릴 때 내부 focus, Tab trap, Escape close, 닫힌 후 trigger로 focus return
5. 입력 오류는 색상만이 아니라 텍스트/ARIA로 전달
6. 44px touch target 정책이 모바일 주요 조작에 적용
7. 360 / 390 / 430에서 horizontal overflow 없음
8. 모바일 키보드 open 상태에서 저장/확인 버튼과 입력 필드가 가려지지 않음
9. fixed top/bottom UI가 form focus와 충돌하지 않음
10. 200% zoom/reflow에서 기능 손실 없음
11. 텍스트/버튼/상태 색 대비가 기준 충족
12. drag/reorder에 keyboard 대체 조작 제공 또는 명확한 대체 버튼 유지
13. automated accessibility scan + 실제 keyboard/browser audit 둘 다 통과

#### P9 테스트 매트릭스

| ID | 시나리오 | 기대 결과 |
| --- | --- | --- |
| A11Y-01 | Tab으로 편집기 주요 조작 순회 | 논리적 순서 + focus 표시 |
| A11Y-02 | icon-only control | 스크린리더가 기능 이름을 읽음 |
| A11Y-03 | modal open/Tab/Escape/close | focus trap과 focus return 정상 |
| A11Y-04 | form validation error | 오류 문구와 해당 input 관계 명확 |
| A11Y-05 | block reorder keyboard | pointer 없이 순서 변경 가능 |
| A11Y-06 | 360px + keyboard open | input/action이 viewport 밖으로 밀리지 않음 |
| A11Y-07 | 390/430 fixed UI | form focus 중 fixed UI 충돌 없음 |
| A11Y-08 | 200% zoom | 가로 스크롤 최소화, 핵심 기능 손실 없음 |
| A11Y-09 | contrast audit | 텍스트/버튼/상태 대비 기준 충족 |
| A11Y-10 | settings keyboard-only | nav → form → save → feedback 흐름 가능 |
| A11Y-11 | public page keyboard | 링크/폼/공유 주요 동작 접근 가능 |
| A11Y-12 | automated scan | 중대/심각 접근성 위반 0건 |


## 4. 현재 실행 순서

현재 내부 최적화는 아래 순서로 진행한다.

1. ~~고정 영역 모바일 컨트롤 44px 보강~~ — #236 production verified
2. ~~공용 control/legacy CSS 충돌 최소 정리~~ — #238 production verified
3. ~~편집 전체 real-use browser regression 추가/보강~~ — #239 + #240 production verified / P2 완료
4. ~~발견된 실제 UX 오류를 작은 PR로 수정~~ — #239 move action wiring 수정 및 production 반영
5. 미디어 UX 마감
6. 저장/undo/revision/publish 연결 검증
7. 개인 도메인 stack 검토
8. 설정 전체 PC/모바일 UX
9. 웹 결제/구독
10. 대량 데이터/운영
11. 접근성/모바일 최종 pass
12. 배포/백업/롤백 closeout

## 4.1 내부 기능 파일 지도

다음 AI는 먼저 이 경계를 기준으로 탐색한다.

| 영역 | 우선 확인 파일/폴더 | 주의 |
| --- | --- | --- |
| 편집기 조립 | `src/editor/EditPanel.jsx`, `src/editor/EditPanelLayout.jsx` | 목록/상세/전역 설정 구조 유지 |
| 화면 순서 | `src/editor/editPanelParts/ScreenOrder*.jsx/css` | V2 selector 기준 |
| 고정 영역 | `GlobalFixedBlocks.jsx`, `FixedBlockCard*.jsx`, `FixedBlocksSection.css` | topnav/bottombar/footer |
| 공용 편집 컨트롤 | `editorControls.jsx`, `compactControls.jsx` | 전역 변경 전 사용처 확인 |
| legacy editor CSS | `src/styles/editor-final-clean.css` | `!important` 영향 확인 후 최소 수정 |
| 위젯 편집기 | `src/editor/blockEditors/**` | 한 위젯씩 수정 |
| 모바일/공개 렌더링 | `src/preview/**`, preview 관련 styles | editor-only 작업과 섞지 않음 |
| 저장/발행 | `src/runtime/usePageSaveAction.js`, save/status helpers | identity/revision 보호 유지 |
| undo/redo | `src/runtime/pageEditHistory.js` | restore/save와 상호작용 검증 |
| revision | `PageRevisionHistorySection.jsx`, `pageRevisionRestore.js` | 공개 페이지 즉시 변경 금지 |
| 미디어 | `EditorMediaLibraryContext.jsx`, picker, `MediaLibrarySettings.jsx`, `fileRepository.js` | 사용 중 자산 보호 |
| 설정 | `src/panels/SettingsPanel.jsx`, `src/panels/settings/**` | owner-only 구분 유지 |
| 개인 도메인 | domain settings/repository + #233~#235 | migration/provider 작업 분리 |
| 운영 메인 | `functions/index.js` + C63 assets | 내부 작업에서 수정 금지 |

### 4.2 작업 시작 체크리스트

다음 AI는 PageRo 내부 기능 작업을 시작할 때 반드시 순서대로 한다.

1. `AGENTS.md` 확인
2. `PAGERO_MAINTENANCE_HANDOFF_KO.md` 확인
3. 이 마스터의 상태 대시보드 확인
4. 현재 `main` HEAD와 열려 있는 관련 PR 확인
5. 작업이 이미 구현됐는지 먼저 검색
6. 재현 가능한 문제만 패치
7. 보호 홈 파일을 수정 대상에서 제외
8. 작은 브랜치/PR로 작업
9. 직접 contract + 전체 QA + browser QA
10. main 병합/배포/migration/운영검증 상태를 각각 따로 보고

### 4.3 패치 중단 조건

아래는 구현을 멈추고 별도 승인 또는 정보가 필요한 경우다.

- production D1 write
- 실제 결제 provider 활성화/청구
- Cloudflare custom domain 실제 연결/삭제
- 운영 메인 디자인/문구 변경
- 실사용자 데이터 파괴 또는 대량 삭제
- 기존 제품정책에 없는 요금제/권한 결정

그 외의 현재 내부 UX/CSS/회귀 문제는 가능한 범위에서 재현 후 작은 패치로 처리한다.

## 5. 작업 단위 원칙

한 PR에서 여러 제품 영역을 대규모로 바꾸지 않는다.

권장 단위:

- CSS hit target 한정
- shared control 한정
- 특정 editor interaction 한정
- 특정 settings section 한정
- 특정 save/recovery contract 한정
- 특정 media behavior 한정

기능이 이미 구현돼 있으면 먼저 재현하고, 재현되는 문제만 수정한다.

## 6. 절대 금지

- 운영 메인 재설계
- 대체 PageRo 랜딩 생성/보관
- 닫힌 오래된 editor PR 전체 재병합
- 오래된 landing component를 current source처럼 복원
- 인증/API/D1/공개렌더링을 UI 패치와 동시 리팩터링
- `git reset`, `git clean`, 강제 `main` push
- 승인 없는 production deploy
- 승인 없는 production D1 write
- 저장 키/schema를 임의 변경
- 실제 기능이 없는 UI를 데모로 추가

## 7. 유지해야 할 기존 제품·운영 계약

과거 병렬 작업 문서를 삭제해도 아래 계약은 유지한다.

- 중복 이메일/연락처 검증은 서버 기준을 유지한다.
- 연락처/이메일은 중복 판단의 주 키이며, client id/cookie는 우발적 반복 제출 방지 보조 수단이다.
- IP는 짧은 시간대의 abuse/rate-limit 신호로만 사용하고 고객 identity로 취급하지 않는다.
- 현재 승인된 템플릿은 개인회생 상담, 모바일 청첩장, 부동산 분양 3종만 유지한다.
- 페이지 복제 시 새 URL 설정 흐름을 유지한다.
- 템플릿 자체 복제 기능은 현재 요구사항이 아니다.
- live credential이나 fixture가 없으면 `skipped-live` / `not verified`로 기록하고 성공으로 가장하지 않는다.
- 내부 편집기 카피는 짧게 유지하고 과도한 사용설명 문구를 추가하지 않는다.

## 8. QA 기준

최소 release-blocking:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

내부 편집기 패치 시 추가 확인:

- 보호 홈 파일 diff 없음
- desktop
- narrow desktop/tablet
- 360px
- 390px
- 430px
- keyboard
- pointer/touch equivalent control
- console error 없음
- horizontal overflow 없음

## 9. 문서 정리 규칙

현재 소스 오브 트루스:

1. `AGENTS.md` — 저장소 최상위 안전 규칙
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md` — 운영 메인/배포 보호
3. `docs/PAGERO_PLAN_POLICY_KO.md` — 요금 정책
4. 이 문서 — 내부 기능 현황/실행순서

과거 완료 패치 지시서, 오래된 병렬 작업 문서, 폐기된 메인 랜딩 기획서는 current source로 유지하지 않는다.

## 9.1 다음 AI가 하면 안 되는 오해

- `main`에 파일이 있다고 운영 배포됐다고 쓰지 않는다.
- PR QA 성공을 production verified로 쓰지 않는다.
- `skipped-live`를 성공으로 쓰지 않는다.
- 닫힌 오래된 PR이 열려 있었다는 이유만으로 재병합하지 않는다.
- 이름에 `Home`, `Exact`, `Canonical`, `Restored`가 들어간다고 운영 메인 원본이라고 추정하지 않는다.
- 실제 사용처 검색 없이 CSS selector를 삭제하지 않는다.
- 공용 `Switch`, `IconAction`, input 스타일을 한 화면 문제 때문에 전역 변경하지 않는다.
- 개인 도메인 #233~#235를 순서 없이 합치지 않는다.
- 결제 메뉴가 있다는 이유로 결제 기능이 완료됐다고 쓰지 않는다.

## 10. 완료 보고 형식

```text
작업 브랜치:
시작 HEAD:
작업 목적:
변경 파일:
보호 홈 파일 변경:
직접 검증:
전체 QA:
브라우저 QA:
미리보기:
main 병합:
운영 배포:
D1 migration:
운영 검증:
남은 문제:
```

`code complete`, `QA complete`, `merged`, `deployed`, `migration applied`, `production verified`는 반드시 별도로 기록한다.
