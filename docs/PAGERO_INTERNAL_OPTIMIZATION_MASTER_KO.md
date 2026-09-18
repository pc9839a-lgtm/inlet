# PageRo 내부 기능 최적화 마스터

- 문서 상태: 현재 실행 기준 / 단일 소스
- 갱신일: 2026-09-18 KST
- 저장소: `pc9839a-lgtm/inlet`
- 기준 브랜치: `main`
- 기준 HEAD: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`
- 운영 도메인: `https://pagero.kr/`
- 범위: PageRo 내부 편집기, 워크스페이스, 설정, 저장/발행, 미디어, 도메인, 운영 기능
- 명시적 비범위: 운영 메인 랜딩 개편

이 문서는 PageRo 내부 기능의 현재 상태, 남은 작업, 작업 순서, 금지사항을 한곳에서 관리한다. 과거 편집기 패치 문서와 병렬 패치 문서는 이 문서로 대체한다.

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

### P0 — 편집기 모바일 컨트롤 일관성

일반 화면순서 V2는 모바일 44px 터치 영역으로 보강됐다.

남은 문제:

- 고정 영역의 `.fixed-open-button`은 공용 legacy CSS에서 38x38px 강제
- `.switch-clean`은 46x28px이며 조작 hit area가 좁음
- `editor-final-clean.css`의 legacy `!important` selector가 신형 화면과 공용 컨트롤 일부에 계속 영향을 줌

원칙:

- 모바일에서 실제 조작 hit area 최소 44x44
- 시각적 스위치 크기 자체를 불필요하게 키우지 않아도 wrapper/hit target으로 44px 확보 가능
- 데스크톱 밀도는 유지
- 전체 CSS 재작성 금지

### P1 — 구/신 편집기 CSS 충돌 감사

현재 신형 화면순서는 `screen-order-v2-*`를 사용하지만 legacy selector가 남아 있다.

감사 대상:

- `screen-order-item`
- `screen-order-head`
- `screen-icon-action`
- `screen-title-wrap`
- `fixed-open-button`
- `switch-clean`

구분:

1. 현재 실제 DOM에서 사용
2. 공용 컨트롤 때문에 여전히 영향 있음
3. 완전 dead selector

dead selector 정리는 실제 참조가 없고 QA가 있는 경우에만 작은 단위로 한다.

### P2 — 편집 전체 real-use audit

아래 실제 사용자 흐름을 하나의 회귀 시나리오로 검증한다.

`페이지 열기 → 블록 추가 → 텍스트 수정 → 이미지 재사용 → 영상 재사용 → 순서 변경 → 노출 변경 → 스타일 변경 → undo/redo → 미리보기 → 계속 입력 → 발행 → 새로고침 → 공개 readback`

반드시 포함:

- 블록 추가 직후 선택
- 설정창 전환
- 빠른 연속 입력
- 저장 중 추가 입력
- undo/redo 후 발행
- revision 복원 후 추가 편집
- 페이지 이동/로그아웃/새로고침
- 공개/미리보기 parity
- 좁은 데스크톱 overflow
- 모바일 터치 타깃

### P3 — 미디어 UX 마감

- 이미지 선택기/영상 선택기/설정 미디어 보관함의 용어와 행동 통일
- 빈 상태/로딩/오류/재시도 일관성
- 사용 중 자산 삭제 이유를 짧고 명확하게 표시
- 좁은 PC/모바일에서 카드/action overflow 확인
- 실제 파일 수가 많을 때 pagination UX 확인

### P4 — 저장/Undo/Revision 연결 검증

서로 개별 구현된 기능이 한 흐름에서 충돌하지 않는지 확인한다.

특히:

- undo 직후 save
- redo 직후 save
- revision restore 직후 undo
- restore 후 publish
- save response 순서 역전
- conflict 발생 후 local draft 유지
- public readback 일치

### P5 — 개인 도메인 운영화

현재 `main`에는 기본 UI/hostname 저장/CNAME 안내/custom-host routing이 있다.

현재 draft stack:

- PR #233: canonical ownership core
- PR #234: Cloudflare provider + DNS/SSL operations
- PR #235: 현재 설정 UI와 server operations 연결

규칙:

- 오래된 PR #41 전체 재병합 금지
- #233 → #234 → #235 순서 유지
- production D1 migration은 별도 승인
- Cloudflare provider credential 적용은 별도 승인
- 운영 실제 도메인 연결 테스트는 별도 승인

### P6 — 설정 전체 사용성

설정 메뉴:

- 페이지 기본
- 미디어 보관함
- 개인 도메인
- 계정 정보
- 매니저 권한
- 요금제·결제
- 추천인
- 파트너
- 정산
- SEO 설정
- 추적 코드
- 전환 설정
- 버전 기록
- 페이지 복제
- 초기화

목표:

- PC에서 과도한 빈 공간 제거
- 모바일에서 메뉴/본문 이동 명확화
- 설명문 최소화
- 저장 상태/권한 제한 명확화
- owner-only 기능 오인 방지

### P7 — 웹 결제/구독

메뉴나 화면 존재와 실제 결제 완료를 혼동하지 않는다.

미완료 범위:

- checkout/billing key
- server-side entitlement mapping
- provider webhook
- idempotency
- 활성화/갱신
- 결제 실패/grace
- 해지
- 결제 이력
- 영수증/증빙
- admin override audit
- webhook replay safety

요금 정책은 `docs/PAGERO_PLAN_POLICY_KO.md`만 따른다.

### P8 — 대량 데이터/운영

- 수천~수만 접수 pagination
- 통계 대범위 조회 성능
- CSV 대용량
- blocked/spam history
- audit/delivery retention
- backup retention
- 실제 query/index 검증

### P9 — 접근성/모바일 최종 마감

- 키보드 탐색
- visible focus
- dialog focus trap
- Escape
- 44px touch target
- 360 / 390 / 430
- form keyboard viewport
- fixed UI collision
- accessible names
- contrast

## 4. 현재 실행 순서

현재 내부 최적화는 아래 순서로 진행한다.

1. 고정 영역 모바일 컨트롤 44px 보강
2. 공용 control/legacy CSS 충돌 최소 정리
3. 편집 전체 real-use browser regression 추가/보강
4. 발견된 실제 UX 오류를 작은 PR로 수정
5. 미디어 UX 마감
6. 저장/undo/revision/publish 연결 검증
7. 개인 도메인 stack 검토
8. 설정 전체 PC/모바일 UX
9. 웹 결제/구독
10. 대량 데이터/운영
11. 접근성/모바일 최종 pass
12. 배포/백업/롤백 closeout

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

## 7. QA 기준

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

## 8. 문서 정리 규칙

현재 소스 오브 트루스:

1. `AGENTS.md` — 저장소 최상위 안전 규칙
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md` — 운영 메인/배포 보호
3. `docs/PAGERO_PLAN_POLICY_KO.md` — 요금 정책
4. 이 문서 — 내부 기능 현황/실행순서

과거 완료 패치 지시서, 오래된 병렬 작업 문서, 폐기된 메인 랜딩 기획서는 current source로 유지하지 않는다.

## 9. 완료 보고 형식

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
