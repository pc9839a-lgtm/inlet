# Pagero 편집기 상호작용 후속 패치 인수인계

- 문서 상태: 구현 대기
- 작성일: 2026-07-29
- 저장소: `pc9839a-lgtm/inlet`
- 작업 브랜치 기준: `integrate/pagero-runtime-main-sync-20260729`
- 문서 작성 기준 HEAD: `31b1051`
- 최근 공유 기능 분리 커밋: `3615963`
- 운영 도메인: `https://pagero.kr`

이 문서는 Pagero 내부 편집기와 공개 랜딩페이지 후속 패치를 다른 개발자가 안전하게 이어서 구현하기 위한 실행 명세다. 이 작업은 운영 루트 메인 개편이 아니다.

## 1. 최상위 보호 조건

현재 `https://pagero.kr/` 루트 메인은 정답 화면이다. 디자인, 문구, 구조, 동작을 변경하지 않는다.

### 절대 수정 금지

- `index.html`
- `src/main.jsx`
- `src/App.jsx`의 루트, 홈, 공개 메인 라우팅 부분
- `src/screens/PageroCanonicalHome.jsx`
- `src/screens/PublicHomeRoute.jsx`
- `src/screens/WayziStaticPages.jsx`
- `src/screens/HomeScreens.jsx`
- `src/screens/PageroExactHome.jsx`
- `src/screens/PageroRestoredHome.jsx`
- `src/styles/base-public*.css`
- `functions/index.js`의 `/` 처리와 frozen C63 메인 응답
- `server/index.mjs`의 `/` 처리
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- 공개 메인에 직접 영향을 주는 기타 파일

### 운영 루트 보존 신호

배포 전후에 아래 신호가 모두 동일해야 한다.

- `.pagero-exact-home` 정확히 1개
- `/c63-assets/index-pagero-main-fix-20260615.js`
- `/c63-assets/index-B0Q5rFVf.css`
- `.c63-life-nav-link` 정확히 1개
- `.c63-life-bridge` 정확히 1개
- `.c63-life-post` 정확히 4개
- `https://life.pagero.kr/` 링크
- `https://awards.pagero.kr/` 링크

### 추가 비기능 보호 범위

이번 패치에서 인증, 세션, 계정 권한, 페이지 소유권, D1 스키마, 저장 API, 접수/예약 payload, 통계 이벤트, 페이지 생성/삭제/복제 정책, SEO, 템플릿 기본 데이터는 변경하지 않는다. 모바일 전체 편집기도 새로 만들지 않는다.

## 2. 현재 구현 상태

완료된 공유 기능 분리는 되돌리지 않는다.

- 공유 설정은 하단 고정 버튼과 분리되어 있다.
- 페이지 전역 설정은 `page.share`를 사용한다.
- 공유 스위치는 편집기 `페이지 옵션`에 있다.
- 공개 화면과 미리보기에는 독립적인 `PageShareButton`이 있다.
- `bottombar.s.shareEnabled`를 복구하지 않는다.

## 3. 구현 우선순위

1. 상단 메뉴 자동 분산과 잘림 제거
2. 모바일 네이티브 공유
3. 공유 버튼 위치 선택과 고정 UI 침범 방지
4. 폼 입력 중 상단/하단 고정 UI 자동 숨김
5. 타이머 스타일 복원과 단색 테마 확장

한 항목씩 구현하고 매 항목마다 빌드와 브라우저 검증을 완료한다. 대규모 CSS 덮어쓰기로 한 번에 처리하지 않는다.

## 4. 패치 1: 상단 메뉴 자동 분산

### 문제

메뉴가 4개 이상이면 라벨이 잘리거나 폭이 불균형해지고 일부 메뉴를 누르기 어렵다.

### 구현 계약

- 메뉴 1~4개는 가용 폭을 동일하게 나눈 한 줄 배치가 기본이다.
- 메뉴 5개 이상은 최대 4열의 여러 줄로 자동 전환한다.
- 각 행의 남는 폭을 같은 행의 메뉴가 균등하게 나눈다.
- 말줄임표로 메뉴명을 숨기지 않는다.
- 긴 라벨은 최대 두 줄까지 줄바꿈한다.
- 가로 스크롤을 만들지 않는다.
- 로고가 있으면 로고 폭을 먼저 확보하고 메뉴 영역만 계산한다.
- 최소 `44px` 터치 높이를 유지한다.
- 추가, 삭제, 순서 변경 직후 미리보기에 반영한다.
- 기존 `pill`, `text`, `outline` 스타일을 유지한다.

### 권장 구현 지점

- `src/preview/renderers/LayoutBlocks.jsx`
- `src/editor/blockEditors/TopNavEditor.jsx`
- `src/styles/preview-workspace-topnav-menu.css`
- `src/styles/preview-workspace-topnav-override.css`

### 수용 기준

- 메뉴 1, 2, 3, 4, 5, 6, 8개를 검증한다.
- 360px, 390px, 430px에서 모든 메뉴가 보인다.
- 4개는 동일 폭 한 줄이며 5개 이상은 자동 줄바꿈된다.
- 가로 스크롤과 잘림이 없다.

## 5. 패치 2: 모바일 네이티브 공유

### 문제

모바일에서도 링크 복사만 실행된다. 카카오톡, 메시지, 메일 등 설치 앱을 고르는 운영체제 공유 시트가 열려야 한다.

### 구현 계약

- 사용자 에이전트 문자열로 모바일을 추측하지 않는다.
- `navigator.share`가 있으면 아래 payload로 먼저 호출한다.

```js
{
  title: page.seo?.title || page.title,
  text: page.seo?.description || page.title,
  url: canonicalPageUrl
}
```

- `navigator.canShare`가 있으면 payload 지원 여부를 확인한다.
- 네이티브 공유 미지원 환경에서만 클립보드 복사를 사용한다.
- 사용자가 취소한 `AbortError`는 오류나 자동 복사로 바꾸지 않는다.
- 복사 fallback이 실제 실행됐을 때만 복사 완료 피드백을 표시한다.
- URL은 `https://pagero.kr/{slug}` 공개 URL이어야 한다.
- 하단 고정 버튼과 독립적으로 동작한다.

### 권장 구현 지점

- `src/preview/LandingRenderer.jsx`
- 필요하면 `src/lib/`의 공유 전용 단일 유틸
- 공유 동작 QA

### 수용 기준

- iOS Safari와 Android Chrome에서 시스템 공유 시트가 열린다.
- 데스크톱에서는 링크가 복사된다.
- 공유 취소 시 오류 메시지가 없다.
- URL에 `/app`, `/dashboard`, 편집기 query가 없다.

## 6. 패치 3: 공유 버튼 위치 선택

### 데이터 모델

`page.share.position`은 아래 값만 허용한다.

- `top-left`
- `top-right`
- `bottom-left`
- `bottom-right`

기존 기본값은 `top-right`다. 알 수 없는 값도 `top-right`로 정규화한다.

### 편집기 UI

- 공유 스위치 아래에 위치 segmented control을 둔다.
- 라벨은 `좌측 상단`, `우측 상단`, `좌측 하단`, `우측 하단`이다.
- 변경 즉시 미리보기에 반영한다.
- 하단 고정 버튼 편집기에 공유 위치 설정을 넣지 않는다.

### 배치 규칙

- `env(safe-area-inset-top/bottom)`을 반영한다.
- 상단 메뉴가 있으면 top offset에 실제 메뉴 높이를 더한다.
- 하단 고정 버튼이 있으면 bottom offset에 실제 버튼 높이를 더한다.
- 콘텐츠와 최소 `12px` 외곽 여백을 둔다.
- 미리보기와 공개 화면이 같은 규칙을 사용한다.
- z-index를 무작정 키우지 않고 모달과 토스트의 레이어를 침범하지 않는다.

### 권장 구현 지점

- `src/lib/pageModel.js`
- `src/editor/editPanelParts/ShareOptionsCard.jsx`
- `src/preview/LandingRenderer.jsx`
- `src/styles/preview-bottom-share.css`

### 수용 기준

- 네 위치가 저장 및 새로고침 후 유지된다.
- 상단 메뉴, 하단 고정 버튼과 겹치지 않는다.
- iPhone safe area와 Android viewport 밖으로 나가지 않는다.
- 미리보기와 공개 화면 위치가 일치한다.

## 7. 패치 4: 폼 입력 중 고정 UI 자동 숨김

### 문제

상담폼과 예약폼 입력 중 상단 메뉴, 하단 버튼, 공유 버튼이 입력창과 모바일 키보드 영역을 가린다.

### 구현 계약

- 상담폼/예약폼의 `input`, `textarea`, `select`, 날짜/시간 control, contenteditable이 focus되면 입력 모드로 전환한다.
- 입력 모드에서 sticky/fixed 상단 메뉴, 하단 고정 버튼, 독립 공유 버튼을 숨긴다.
- blur 후 바로 복원하지 말고 짧게 지연한 뒤 `document.activeElement`를 확인한다.
- 다음 필드 이동 중 깜박이지 않아야 한다.
- 제출, 취소, 폼 외부 터치, 키보드 닫힘 후 원래 상태로 복원한다.
- 숨김은 짧은 opacity/transform 전환을 사용한다.
- 폼 검증, 값, 제출 payload, 통계 이벤트는 변경하지 않는다.
- 모달 폼이 닫힐 때 입력 모드를 반드시 해제한다.

### 권장 구현 지점

- `src/preview/LandingRenderer.jsx`
- `src/preview/renderers/FormBlocks.jsx`
- 작은 폼 상호작용 hook 또는 유틸
- `src/styles/preview-bottom.css`
- 상단 메뉴 및 공유 버튼 CSS

### 수용 기준

- 상담폼 첫 필드 focus 시 고정 UI가 숨는다.
- 예약 날짜/시간 선택 중에도 숨는다.
- 필드 이동 중 깜박이지 않는다.
- 폼 밖을 누르면 원래 설정대로 복원된다.
- 모바일 키보드 상태에서 현재 필드와 제출 버튼 접근이 가능하다.
- 제출 데이터는 기존과 동일하다.

## 8. 패치 5: 타이머 스타일 복원과 단색 확장

### 구현 계약

- 기존 기본 스타일 1개를 그대로 유지한다.
- 기존 저장 키와 데이터를 깨뜨리지 않는다.
- 최소 4개의 추가 스타일을 제공한다.
- 신규 스타일은 단색만 사용하고 CSS gradient를 사용하지 않는다.
- 각 스타일은 숫자 구획, 구분선, 라벨 위치, 테두리, 진행 표시 중 최소 두 가지가 달라야 한다. 색만 바꾼 복제품은 금지한다.
- 권장 스타일은 `기본`, `플랫`, `블록`, `라인`, `포인트`다.
- 잉크/블랙, 블루, 그린, 레드/코랄, 페이지 accent 팔레트를 제공한다.
- 움직임은 사용자가 켠 경우에만 적용한다.
- `prefers-reduced-motion`에서는 움직임을 중지한다.
- 하단 고정 버튼의 작은 타이머는 별도 컴팩트 레이아웃을 유지한다.
- `혜택 마감까지` 같은 고정 문구를 강제로 삽입하지 않는다.

### 권장 구현 지점

- `src/editor/blockEditors/TimerEditor.jsx`
- 타이머 renderer가 위치한 `src/preview/renderers/**`
- 타이머 전용 preview CSS
- `src/lib/pageModel.js`의 허용 스타일 정규화

### 수용 기준

- 기존 페이지의 기본 타이머가 바뀌지 않는다.
- 신규 스타일은 형태 차이가 육안으로 명확하다.
- 신규 스타일에 gradient가 없다.
- 팔레트가 미리보기와 공개 페이지에 즉시 반영된다.
- 일/시/분/초가 작은 화면에서도 잘리지 않는다.
- 카운트다운과 종료 동작은 모든 스타일에서 동일하다.

## 9. 공통 UX 규칙

- 설명 문구를 늘리지 않는다.
- 토글은 이진 설정에만 사용한다.
- 위치와 스타일은 segmented control 또는 swatch를 사용한다.
- 아이콘은 기존 `lucide-react`를 사용한다.
- 카드 안에 카드를 중첩하지 않는다.
- 새로운 gradient를 추가하지 않는다.
- 편집기와 공개 페이지 결과가 일치해야 한다.
- `패널을 불러옵니다`, `편집기를 불러옵니다` 같은 로딩 안내 문구를 다시 노출하지 않는다.

## 10. 금지 작업

- `git reset`, `git revert`, `git clean`, `git checkout --`
- 보호 파일을 과거 버전으로 덮어쓰기
- `git add .`
- 대형 WIP 커밋 전체 cherry-pick
- 공유 기능을 하단 고정 버튼에 다시 결합
- fixed UI를 영구 비활성화해 폼 focus 문제를 회피
- 기존 타이머 저장 키 삭제
- 인증, 저장, D1, 라우팅 동시 리팩터링
- 사용자 승인 없는 운영 배포
- unrelated formatting 또는 대량 CSS 정리
- 기존 untracked 감사 파일 삭제

## 11. 권장 커밋 단위

1. `Fix: distribute top navigation items without clipping`
2. `Fix: use native mobile page sharing`
3. `Feat: add safe share button positions`
4. `Fix: hide fixed controls during form input`
5. `Feat: restore solid timer style variants`

각 커밋은 해당 패치 파일만 명시적으로 stage한다.

## 12. 필수 QA

```powershell
git diff --check
npm run runtime:qa
npm run build
```

브라우저에서는 360px, 390px, 430px 모바일과 태블릿/데스크톱에서 상단 메뉴 1/4/5/8개, 네이티브 공유, 공유 네 위치, 상담폼/예약폼 focus와 제출, 타이머 전 스타일, 가로 스크롤, 콘솔 오류, lazy chunk/CSS preload 오류를 검증한다.

배포 전후 루트 `/`의 보호 신호를 비교한다. 하나라도 다르면 배포를 중단하고 원인만 보고한다.

## 13. 완료 보고 형식

```text
작업 브랜치:
시작 HEAD:
완료 커밋:
구현한 패치 번호:
변경 파일:
보호 파일 diff:
runtime QA:
build:
preview URL:
운영 배포 여부:
운영 루트 보호 신호:
모바일 공유 검증:
폼 focus 검증:
남은 문제:
```
