# 페이지로(Pagero) 수정·배포 인수인계 지침

> 대상 저장소: `pc9839a-lgtm/inlet`
>
> 운영 도메인: `https://pagero.kr/`
>
> 이 문서는 다음 개발자·AI 에이전트가 기존 운영 화면을 훼손하지 않고 수정하기 위한 최우선 작업 기준이다.

## 1. 가장 중요한 원칙

`https://pagero.kr/`의 현재 메인 화면은 **동결된 운영 기준본**이다.

내부 편집기, 관리자, 인증, API, SEO, 빌드, 라우팅 작업을 하더라도 아래 항목을 임의로 바꾸면 안 된다.

- 메인 디자인
- 메인 문구
- 메인 섹션 순서와 구조
- 메인 메뉴와 푸터
- 히어로 및 애니메이션
- 생활정보 연결 섹션
- 로그인·시작하기 버튼 동작
- PC·모바일 반응형 결과

사용자가 메인 변경을 명시적으로 요청하지 않은 작업은 모두 **메인 변경 금지 작업**으로 판단한다.

## 2. 현재 운영 기준본

- 운영 도메인: `https://pagero.kr/`
- 검증된 Cloudflare Pages 배포본: `https://8273caf2.inlet-8mr.pages.dev`
- 검증 기준 커밋: `f3121de`
- 운영 메인 루트 마커: `.pagero-exact-home`
- 동결 메인 JavaScript: `/c63-assets/index-pagero-main-fix-20260615.js`
- 동결 메인 CSS: `/c63-assets/index-B0Q5rFVf.css`
- 생활정보 연결 JavaScript: `/c63-life-bridge.js`
- 생활정보 연결 CSS: `/c63-life-bridge.css`
- 기준 메인 문구: `모바일 페이지를빠르게 만드세요`

### 운영 메인 필수 DOM 신호

배포 후보는 아래 조건을 모두 유지해야 한다.

- `.pagero-exact-home` 정확히 1개
- `.c63-life-nav-link` 정확히 1개
- `.c63-life-bridge` 정확히 1개
- `.c63-life-post` 정확히 4개
- `https://life.pagero.kr/` 링크 노출
- `https://awards.pagero.kr/` 링크 노출

생활비서 사이트에 새 글을 발행하는 것과 페이지로 메인의 생활정보 카드 수를 늘리는 것은 별개다. 사용자가 메인 노출 변경까지 명시하지 않았다면 `public/c63-life-bridge.js`의 4개 카드 구성은 유지한다.

## 3. 운영 루트의 실제 동작 구조

### 3.1 운영 `/`의 기준 파일

Cloudflare Pages 운영 루트 `/`는 일반 Vite `index.html`만으로 표시되는 구조가 아니다.

운영 메인 HTML은 현재 `functions/index.js`의 `C63_HOME_HTML`이 반환한다. 이 파일에서 동결된 C63 JavaScript·CSS와 생활정보 브리지를 직접 불러온다.

따라서 다음과 같이 판단하면 안 된다.

- `index.html`에 애드센스 태그가 없으니 누락이라고 판단
- `src/screens/PageroCanonicalHome.jsx`가 운영 메인과 다르니 운영 메인을 해당 컴포넌트로 교체
- 로컬 Vite `/` 화면만 보고 운영 메인이 정상이라고 판단

운영 메인의 최종 기준은 반드시 `functions/index.js`와 실제 Cloudflare Pages 미리보기·운영 URL이다.

### 3.2 일반 앱 진입

`src/main.jsx`는 경로를 구분한다.

- `/embed/*`: 임베드 앱
- 일반 공개 루트 조건: 공개 홈 컴포넌트
- 로그인·앱·대시보드·관리자·기타 경로: `App.jsx`

이 소스 라우팅은 로컬·빌드 환경에서 중요하지만, 운영 `/`는 Pages Function의 동결 메인이 우선한다. 라우팅을 수정할 때 양쪽 동작을 혼동하지 않는다.

## 4. 수정 금지 또는 고위험 파일

아래 파일은 사용자의 명시적 메인 변경 요청이 없는 한 수정하지 않는다.

### 운영 메인 직접 보호

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`의 루트·공개 홈 분기
- `src/screens/PublicHomeRoute.jsx`
- `src/screens/PageroCanonicalHome.jsx`
- `src/styles.css`의 공개 홈·`pagerol-*` 관련 스타일
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- `server/index.mjs`의 루트·정적 파일·라우팅 처리

### 편집기 작업 시 보호

편집기 수정은 다음 영역 안에서 필요한 최소 범위로 수행한다.

- `src/builder/**`
- `src/editor/**`
- `src/panels/**`
- `src/runtime/**`
- `src/screens/WorkspaceEditorScreen.jsx`

편집기 UI만 요청받은 경우 아래는 함께 바꾸지 않는다.

- API 응답 구조
- 인증 방식
- D1·저장소 스키마
- 공개 페이지 렌더링
- 운영 메인
- SEO 파일
- 배포 스크립트

## 5. 편집기 UI 수정 규칙

페이지로 편집기의 기본 사용 흐름은 아래와 같다.

`블록 추가 → 모바일 미리보기 확인 → 선택 블록 수정 → 저장·발행`

### 데스크톱 기본 구조

- 상단: 페이지명, 저장 상태, 미리보기, 발행
- 좌측: 블록 목록
- 중앙: 실시간 모바일 미리보기
- 우측: 선택한 블록의 내용·동작·스타일 설정

### UI 원칙

- 블록 목록과 상세 설정을 섞지 않는다.
- 블록 행에는 순서, 드래그, 아이콘, 이름, 노출 상태, 최소 동작만 둔다.
- 페이지 전체 설정과 개별 블록 설정을 분리한다.
- 한국어 라벨은 짧게 작성한다.
- 설명 문구를 과도하게 넣지 않는다.
- 카드 안에 카드를 반복하지 않는다.
- 테두리·필 형태 버튼을 남발하지 않는다.
- 버튼, 토글, 입력창, 모서리, 테두리 체계를 통일한다.
- 보조 동작은 메뉴 안으로 정리할 수 있지만 기존 필수 동작은 삭제하지 않는다.
- 모바일에서는 전체 편집기보다 접수·통계 확인을 우선한다.

### 편집기 패치 우선순위

1. 블록 목록
2. 선택 블록 설정 패널
3. 페이지·전역 설정 분리
4. 공통 입력·버튼·토글 정리
5. 패널 정리
6. 위젯 편집기 한 종류씩 수정

한 번에 여러 영역을 대규모로 재설계하지 않는다.

## 6. SEO·애드센스 파일 수정 허용 범위

메인 화면을 바꾸지 않는 SEO 작업은 아래 파일만 최소 수정할 수 있다.

- `public/robots.txt`
- `public/sitemap.xml`
- `public/ads.txt`
- `public/_headers`
- 필요 시 SEO 검증 스크립트

### 현재 `robots.txt` 기준

- 공개 루트는 크롤링 허용
- `/api`, `/app`, `/dashboard`, `/account`, `/admin`, `/invite`, `/login`, `/signup`, `/embed` 차단
- 사이트맵 주소는 `https://pagero.kr/sitemap.xml`

`robots.txt`는 반드시 순수 텍스트여야 한다. SPA의 `index.html` 내용이 섞이면 실패다.

### 현재 `sitemap.xml` 기준

현재 공개 사이트맵에는 아래 공개 페이지만 포함한다.

- `/`
- `/about`
- `/contact`
- `/privacy`
- `/terms`

로그인, 회원가입, 앱, 대시보드, 관리자, 초대, 임베드 경로는 사이트맵에 넣지 않는다.

`sitemap.xml`은 반드시 XML이어야 하며 SPA HTML이 반환되면 안 된다.

### 현재 `ads.txt` 기준

```text
google.com, pub-1906196934401001, DIRECT, f08c47fec0942fa0
```

게시자 ID를 임의로 변경하거나 중복 행을 추가하지 않는다.

### 내부 화면 검색 차단

`public/_headers`는 아래 경로에 `X-Robots-Tag: noindex, nofollow, noarchive`를 적용한다.

- `/login`
- `/signup`
- `/app` 및 하위 경로
- `/dashboard` 및 하위 경로
- `/account` 및 하위 경로
- `/admin`
- `/*/admin`
- `/invite` 및 하위 경로
- `/embed` 및 하위 경로

새 내부 운영 경로를 만들면 사이트맵 제외, robots 정책, `X-Robots-Tag`를 함께 검토한다.

## 7. SPA 및 정적 파일 규칙

- `public/_redirects`의 `/* /index.html 200` SPA fallback을 유지한다.
- `robots.txt`는 `text/plain`으로 제공한다.
- `sitemap.xml`은 `application/xml`로 제공한다.
- 루트와 HTML·핵심 앱 자산은 오래 캐시하지 않는다.
- 파비콘은 장기 캐시할 수 있다.
- 동결 C63 자산 이름을 임의로 변경하지 않는다.

SPA fallback 때문에 `robots.txt`나 `sitemap.xml`이 HTML로 대체되지 않는지 배포 산출물에서 반드시 검사한다.

## 8. 작업 절차

### 8.1 작업 전

1. 저장소와 브랜치가 `pc9839a-lgtm/inlet` / `main`인지 확인한다.
2. 최신 원격 상태를 가져온다.
3. 작업 목적과 수정 허용 파일을 먼저 정한다.
4. `AGENTS.md`와 이 문서를 읽는다.
5. 검증 기준 커밋 `f3121de` 대비 보호 파일 변경 여부를 확인한다.
6. 메인 변경 요청이 아니면 보호 파일을 수정 목록에서 제외한다.

### 8.2 구현 중

- 한 작업에서 unrelated 리팩터링을 하지 않는다.
- 자동 포맷팅으로 대형 파일 전체를 바꾸지 않는다.
- 파일 복원·재생성 과정에서 동결 자산을 덮어쓰지 않는다.
- 기존 API, 인증, 데이터 저장 동작을 추측으로 변경하지 않는다.
- 수정 범위를 벗어나는 문제가 발견되면 별도 보고하고 현재 작업에 섞지 않는다.

### 8.3 커밋 전

최소 확인 항목:

- 변경 파일 목록
- 보호 파일 diff 유무
- 빌드 성공
- 수정한 기능의 직접 테스트
- 메인 DOM 필수 신호 유지
- PC·태블릿·모바일 화면 확인
- `/robots.txt`, `/sitemap.xml`, `/ads.txt` 응답 형식 확인
- 내부 경로 `X-Robots-Tag` 확인

## 9. QA 및 배포 명령

### 로컬 실행

```bash
npm install
npm run dev
```

### 전체 QA

```bash
npm run qa:all
```

`qa:all`은 인증, API, 저장소, 렌더링, CSS, 빌드, 번들, 접근성, 배포 산출물 등 전체 검사를 순차 실행한다. 일부 검사만 통과한 상태로 운영 배포하지 않는다.

### 빌드

```bash
npm run build
```

배포 산출물 검사에는 다음 항목이 포함된다.

- `index.html` 존재
- `_redirects` SPA fallback 존재
- 참조되지 않는 오래된 JS·CSS 자산 없음
- JS·CSS 용량 제한
- `robots.txt` 존재 및 HTML 혼입 없음
- `sitemap.xml` 존재 및 정상 XML

### 미리보기 배포

```bash
npm run deploy:pages:preview
```

### 운영 배포

```bash
npm run deploy:pages
```

운영 배포는 사용자의 명시적 승인 후에만 수행한다.

## 10. 배포 직전 필수 비교

미리보기 배포에서 다음 해상도를 모두 확인한다.

- 데스크톱
- 좁은 데스크톱·태블릿
- 모바일

운영 기준본과 아래를 비교한다.

- 헤더 높이와 메뉴
- 히어로 문구와 줄바꿈
- 버튼 위치와 동작
- 애니메이션
- 섹션 순서
- 생활정보 섹션
- 푸터 링크
- 가로 스크롤 여부
- 중복 메인·중복 푸터 발생 여부
- 필수 DOM 마커 개수

하나라도 다르면 운영 배포를 중단한다.

## 11. Git 및 배포 안전 규칙

- `main` 강제 푸시 금지
- 검증 없이 여러 브랜치를 기계적으로 합치지 않기
- dirty worktree 상태에서 배포 금지
- 운영 트리를 만들기 위해 `reset`, `clean`, 무차별 파일 restore 사용 금지
- 보호 파일이 바뀐 상태로 SEO·관리자·편집기 패치를 함께 배포하지 않기
- 배포 전 최종 커밋 SHA를 기록하기
- 배포 URL과 운영 URL을 모두 확인하기

`1bd91160-8741-490f-8d85-402179a12bbc` 배포본은 필수 생활정보 브리지를 제거하므로 운영 배포 기준으로 사용하지 않는다.

## 12. 롤백 기준

아래 상황에서는 즉시 배포를 중단하거나 롤백한다.

- 운영 메인 디자인·문구·구조 변경
- `.pagero-exact-home` 중복 또는 누락
- 생활정보 브리지 누락
- 생활정보 카드가 4개가 아님
- 로그인·시작 버튼 오작동
- `robots.txt` 또는 `sitemap.xml`에 HTML 반환
- 내부 화면이 검색 허용 상태
- 빌드 자산 404
- 모바일 가로 스크롤 또는 주요 섹션 붕괴

롤백은 문제 커밋을 식별해 되돌리는 방식으로 수행한다. 검증되지 않은 파일 묶음을 과거 버전으로 통째로 덮어쓰지 않는다.

## 13. 작업 완료 보고 형식

다음 개발자는 작업 종료 시 아래 항목을 보고한다.

```text
작업 저장소: pc9839a-lgtm/inlet
작업 브랜치:
수정 목적:
수정 파일:
보호 파일 변경 여부: 없음 / 있음
전체 QA 결과:
미리보기 배포 URL:
운영 배포 여부:
운영 확인 URL: https://pagero.kr/
robots.txt 확인:
sitemap.xml 확인:
ads.txt 확인:
내부 경로 noindex 확인:
최종 커밋 SHA:
남은 문제:
```

## 14. 현재 확인된 주의점

- 기존 `AGENTS.md`에 보호 파일로 적힌 `functions/frozenHome.js`는 현재 저장소에 없다.
- 실제 운영 루트 동결 HTML은 `functions/index.js`에 있다.
- `index.html`만 보고 운영 루트를 판단하면 안 된다.
- `src/screens/PageroCanonicalHome.jsx`는 현재 운영 기준 C63 메인의 유일한 원본이 아니다.
- 생활비서 신규 글 발행과 페이지로 메인 생활정보 카드 변경을 혼동하지 않는다.

이 문서와 `AGENTS.md`가 충돌할 경우 더 엄격하게 운영 메인을 보호하는 규칙을 우선한다.
