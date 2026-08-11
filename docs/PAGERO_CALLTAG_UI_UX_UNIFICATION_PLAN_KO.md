# 페이지로 × 콜태그 UI/UX 통합 기준

작성일: 2026-08-11  
대상 저장소: `pc9839a-lgtm/inlet`  
참고 저장소: `pc9839a-lgtm/calltag`  
기준 백업 브랜치: `backup/pagero-before-calltag-ui-20260811-1833`  
페이지로 기준 복구 SHA: `ae99cb250bbef73a0f39a6ad21cb7f6f38fd53ff`

---

## 1. 목적

페이지로와 콜태그는 별개의 화면을 가진 서비스가 아니라 같은 제품군으로 운영한다. 따라서 페이지로의 편집, 접수함, 통계, 설정, 결제/정산 관련 화면은 콜태그 운영 웹의 UI 문법을 공통 디자인 시스템으로 사용한다.

이번 통합의 핵심 목적은 단순히 색상이나 버튼 모양을 비슷하게 만드는 것이 아니다.

1. 페이지마다 서로 다른 간격과 카드 규칙을 제거한다.
2. 한 화면을 고칠 때 다른 화면이 깨지는 CSS 충돌 구조를 제거한다.
3. 설명 중심 UI를 값/상태/액션 중심의 운영 UI로 바꾼다.
4. 콜태그와 페이지로를 같은 회사의 같은 제품군처럼 보이게 한다.
5. PC와 모바일 모두 하나의 반응형 규칙으로 동작하게 한다.
6. `fix`, `final`, `cleanup`, `regression` 식의 패치 CSS 누적을 끝낸다.

---

## 2. 현재 페이지로의 핵심 문제

### 2.1 CSS 레이어가 너무 많다

현재 `WorkspaceEditorScreen.jsx`에서 다수의 전역 스타일 파일이 순서대로 로드된다.

대표적으로 다음과 같은 파일들이 동시에 레이아웃에 개입한다.

- `editor-workspace-v2.css`
- `workspace-inbox-redesign.css`
- `workspace-inbox-fullwidth-fix.css`
- `operations-settings.css`
- `operations-settings-compact.css`
- `inbox-scroll-width-final.css`
- `stats-dashboard-safe.css`
- `stats-fullwidth-final.css`
- `stats-height-match-inbox.css`
- `ops-header-stats-cleanup.css`
- `operations-workspaces-unified.css`
- `operations-overflow-final.css`
- `operations-clipping-cleanup-final.css`
- `stats-regression-repair-final.css`
- `operations-height-parity-final.css`
- `settings-control-panel.css`

이 구조에서는 한 요소의 `height`, `overflow`, `grid-template-columns`, `padding`, `max-width`를 어느 파일이 최종적으로 소유하는지 즉시 판단하기 어렵다.

결과적으로 다음 현상이 반복된다.

- 공유 이미지 미리보기가 잘림
- 매니저 행이 잘림
- 링크 편집 상태 변경 시 높이가 무너짐
- 스크롤이 갑자기 막힘
- 설정/통계/접수함의 시작 높이가 다름
- 한 CSS 수정이 다른 화면에 회귀를 발생시킴

따라서 앞으로는 증상별 CSS 추가가 아니라 **소유권이 명확한 스타일 구조로 교체**해야 한다.

### 2.2 같은 제품인데 화면 문법이 다르다

현재 페이지로 안에서도 편집, 접수함, 통계, 설정이 서로 다른 제품처럼 보인다.

예:

- 카드 radius가 화면별로 다름
- 입력 높이가 다름
- 상단 헤더 높이가 다름
- selected tab 표현이 다름
- 본문 최대 폭이 다름
- 사이드바 메뉴 규칙이 다름
- 버튼 색과 높이가 다름
- 모바일 전환 방식이 다름

이 문제는 컴포넌트 단위 수정으로 해결하지 않고 공통 UI 토큰과 공통 레이아웃 시스템으로 해결한다.

### 2.3 설정 화면이 설명 중심이다

설정은 값을 보고 바로 수정하는 운영 화면이어야 한다.

금지 구조:

`설정 제목 → 설명 → 카드 → 카드 제목 → 카드 설명 → 필드 설명 → 저장 안내`

목표 구조:

`메뉴 → 값/상태 → 액션`

설명은 아래 경우에만 유지한다.

- DNS 값과 연결 방법
- 입력 포맷 안내
- 오류/검증 메시지
- 저장/연결 상태
- 결제 가격/포함 범위
- 삭제/초기화/소유권 이전 등 위험 작업 경고

일반적인 기능 설명, 반복 안내, 이미 메뉴명으로 알 수 있는 설명은 제거한다.

---

## 3. 콜태그 기준 UI

실제 참고 대상은 콜태그 랜딩의 검은 테마가 아니라 **콜태그 운영 웹 UI**, 특히 정산 대시보드다.

참고 파일:

- `pc9839a-lgtm/calltag/web/settlement.html`
- `pc9839a-lgtm/calltag/web/settlement.css`

콜태그 운영 웹의 기본 토큰:

```css
--bg: #f5f6f8;
--panel: #ffffff;
--text: #101217;
--muted: #6c727e;
--line: #e4e7ec;
--soft: #f7f8fa;
--accent: #315ee7;
--good: #147a50;
--warn: #946100;
--danger: #b42318;
```

주요 UI 특징:

- 페이지 배경은 밝은 회색
- 기능 영역은 흰색 패널
- 핵심 활성 탭/핵심 액션은 거의 검정
- 파란색은 포커스, 강조, 일부 핵심 액션에 제한적으로 사용
- 라벨은 작은 회색 텍스트
- 입력/버튼 높이는 대체로 36~46px 범위
- 카드 radius는 대체로 10~18px 범위
- 과한 그림자 사용 금지
- 정보 밀도는 높이고 설명문은 최소화
- 모바일에서는 KPI 2열, 테이블 카드화, 하단 내비게이션 등 명확한 반응형 전환 사용

---

## 4. 페이지로 공통 디자인 토큰

페이지로 전역 UI는 콜태그와 같은 제품군 토큰을 사용한다.

```css
:root {
  --product-bg: #f5f6f8;
  --product-panel: #ffffff;
  --product-text: #101217;
  --product-muted: #6c727e;
  --product-line: #e4e7ec;
  --product-soft: #f7f8fa;
  --product-accent: #315ee7;
  --product-accent-soft: #eef3ff;
  --product-good: #147a50;
  --product-good-soft: #eaf7f1;
  --product-warn: #946100;
  --product-warn-soft: #fff4df;
  --product-danger: #b42318;
  --product-danger-soft: #fff0ef;
}
```

### 간격 규칙

임의의 `13px`, `17px`, `23px`, `31px`을 화면마다 만들지 않는다.

주요 spacing 단계:

- 6px: 작은 내부 간격
- 8px: 버튼/탭 gap
- 10px: 입력/컨트롤 gap
- 14px: 카드/섹션 내부 기본 gap
- 18px: 카드 padding
- 24px: 큰 섹션 사이 간격

### 컨트롤 크기

- 작은 버튼: 36px
- 일반 버튼: 40~44px
- 입력/select: 46px
- segmented control: 40~44px
- 사이드 메뉴 row: 44~48px
- desktop topbar: 약 62px

### Radius

- input/button: 8~10px
- card/section: 12~14px
- 중요 hero/balance card: 최대 18px
- pill/status만 999px

---

## 5. 공통 화면 구조

페이지로의 편집/접수함/통계/설정은 같은 상단 제품 셸을 사용한다.

### 상단

구성:

`페이지명 + 현재 메뉴 + 저장상태 | 메인 | 미리보기 | 저장`

원칙:

- 메뉴별로 header 높이가 달라지지 않는다.
- 설명 문구를 상단에 반복하지 않는다.
- 저장 상태는 한 줄 badge 수준으로 표시한다.
- 저장 버튼은 모든 화면에서 동일한 위치와 크기를 사용한다.

### 메인 탭

`편집 / 스타일 / 접수함 / 통계 / 설정`

콜태그의 `main-nav`와 같은 segmented navigation 문법을 사용한다.

- 흰 배경
- 얇은 border
- 선택된 탭은 검정 배경 + 흰 글자
- 비선택 탭은 회색 텍스트
- 탭의 높이/패딩 동일

---

## 6. 화면별 UX 기준

### 6.1 편집

편집은 미리보기와 함께 사용하는 작업 도구이므로 다른 운영 탭과 달리 split view를 유지할 수 있다.

하지만 다음 규칙은 공통화한다.

- header와 main tab 디자인은 접수함/통계/설정과 동일
- 입력 높이, 버튼, 카드 radius, border 색 동일
- 편집 카드 안에 또 카드 중첩 최소화
- block header 높이 통일
- 펼침/접힘 시 부모 overflow 때문에 내용이 잘리지 않도록 구성
- 상태 변경으로 container geometry가 바뀌지 않게 한다

### 6.2 링크 위젯

현재 반복 문제를 없애기 위한 고정 규칙:

- `이름`
- `이동: 위젯 / 링크`
- 이동이 링크면 `링크 URL`
- 이동이 위젯이면 `이동할 위젯`
- `표시: 없음 / 아이콘 / 썸네일`

원칙:

- `없음/아이콘/썸네일` 선택 여부와 관계없이 segmented control 자체 높이는 동일
- `없음`을 눌렀다고 부모 카드 높이가 비정상적으로 줄어들지 않음
- `overflow:hidden`은 실제 시각적 crop이 필요한 이미지 frame 외에는 사용하지 않음
- 링크 row와 상세 편집 영역을 한 DOM에서 무리하게 같은 높이로 제한하지 않음
- preview와 editor에서 동일한 데이터를 사용하되 각각의 레이아웃 소유권은 분리

### 6.3 접수함

현재의 기능 구조는 유지할 수 있다.

기본 구조:

`좌측 상태 메뉴 | 중앙 문의 목록 | 우측 문의 상세`

UI만 콜태그와 통일한다.

- 사이드 메뉴 44~48px
- active 상태는 `soft background + dark text`
- KPI는 동일한 card system
- 검색/월/유형/상태 필터 컨트롤 높이 44~46px
- 테이블 row 높이와 column 간격 고정
- 상세는 section border로 구분하되 card-on-card 최소화
- PC에서 3열, 작은 화면에서 1~2열로 자연스럽게 접힘

### 6.4 통계

통계를 독립된 디자인으로 만들지 않는다.

구조:

`기간/채널 → KPI → 추이/퍼널 → 세부 breakdown`

- 기간 탭 = 공통 segmented control
- 채널 필터 = 공통 segmented/filter control
- KPI = 콜태그 summary cell 규칙
- graph/card radius와 padding도 공통 토큰 사용
- 별도의 `stats-final`, `stats-regression`, `stats-height-match` 방식 금지

### 6.5 설정

설정은 가장 강하게 정보 밀도를 높인다.

기본 레이아웃:

`좌측 설정 메뉴 | 우측 현재 설정`

메뉴:

- 계정 정보
- 페이지 기본
- 개인 도메인
- 매니저 권한
- 요금제·결제
- 추천인
- 파트너
- 정산
- SEO 설정
- 추적 코드
- 전환 설정
- 페이지 복제
- 초기화

#### 계정/페이지 기본

기본적으로 row form을 사용한다.

예:

```text
이름          김도윤                      변경
이메일        user@example.com            변경
비밀번호                                  변경
```

페이지 기본:

```text
페이지명      모바일청첩장
페이지 주소   /dyjh
                                      저장
```

설명문은 넣지 않는다.

#### 도메인

Vercel류의 운영 UI처럼 다음만 우선 노출한다.

```text
도메인        example.com      미연결      연결
DNS
CNAME         @                inlet-8mr.pages.dev     복사
SSL                            상태/신청
```

DNS 값은 필수 운영 정보이므로 항상 표시 가능하다.

#### 매니저 권한

PC는 안정적인 table/list row를 사용한다.

```text
매니저               역할              상태          관리
홍길동                편집              활성          관리
user@example.com
```

원칙:

- row 높이에 편집 form을 억지로 포함하지 않는다.
- 역할/상태/관리 버튼은 한 행에서 잘리지 않는다.
- 관리 클릭 후 상세 편집은 row 아래의 별도 section 또는 side panel을 사용한다.
- 모바일에서는 카드 정보 구조로 변환한다.

#### SEO 이미지

파비콘과 공유이미지는 동일 컴포넌트 규칙을 강제로 공유하지 않는다.

파비콘:

- 1:1
- 작은 정사각형 preview
- 아이콘 asset 용도

공유 이미지:

- OG 비율 `1200:630`
- preview frame은 전체 이미지 확인이 가능해야 함
- `object-fit: contain`
- `cover`로 잘라서 보여주지 않음
- 수정/삭제 버튼이 이미지 자체를 가리지 않음
- desktop에서 지나치게 큰 배너로 확장하지 않음

### 6.6 결제/정산

콜태그 정산 UI를 직접 기준으로 사용한다.

핵심:

- 현재 상태를 먼저 보여준다.
- 가격/다음 결제/결제수단/최근 결제를 한눈에 본다.
- 설명 카드 대신 실제 값과 액션을 배치한다.

페이지로 가격 정책을 임의로 변경하지 않는다.

현재 서비스 정책상 유지할 값:

- 페이지로 무료: 0원
- 페이지로 클래식: 3,500원/월
- 페이지로 프로: 5,500원/월
- SSL: 1,000원/월
- 프로는 SSL 포함
- 통합권: 6,000원/월
- 통합권에는 페이지로 클래식 + 콜태그 통화관리 + 문자 자동화 포함
- 콜태그 웹에서 별도 1,900원/990원 구매 CTA 노출 금지

---

## 7. 모바일 기준

콜태그 운영 UI의 모바일 전략을 페이지로에도 적용한다.

### 기본 원칙

- desktop layout을 단순 축소하지 않는다.
- 720~820px 이하부터 실제 정보 구조를 재배치한다.
- KPI는 2열
- table은 모바일 card/label 형태로 전환
- 긴 sidebar는 상단 horizontal menu 또는 전용 drawer로 전환
- 주요 운영 navigation은 필요 시 하단 fixed navigation 사용
- touch target 최소 약 40~44px
- 가로 스크롤은 데이터 테이블처럼 불가피한 경우에만 허용

### 금지

- desktop 3열을 억지로 좁혀서 유지
- 버튼 글자가 잘리는 상태
- 입력이 부모 밖으로 넘치는 상태
- 설정 sidebar 때문에 본문 폭이 200px 수준으로 줄어드는 상태

---

## 8. CSS 아키텍처 재정비

### 목표

최종적으로 스타일 소유권을 다음 정도로 단순화한다.

```text
product-ui-tokens.css          공통 제품 토큰
workspace-shell.css            공통 header/tab/workspace
editor-workspace.css           편집 전용
inbox-workspace.css            접수함 전용
stats-workspace.css            통계 전용
settings-workspace.css         설정 전용
```

컴포넌트가 복잡한 경우 내부 component css는 허용하지만, 동일 selector를 여러 파일에서 다시 덮지 않는다.

### 제거 대상 패턴

다음 이름과 목적의 CSS를 더 만들지 않는다.

- `*-fix.css`
- `*-final.css`
- `*-final2.css`
- `*-cleanup-final.css`
- `*-regression-repair.css`
- `*-height-match.css`
- `*-overflow-final.css`

기존 파일은 한 번에 삭제하지 않고 화면별로 owner CSS로 통합한 뒤 제거한다.

### !important 정책

현재처럼 거의 모든 규칙에 `!important`를 사용하는 방식은 중단한다.

허용:

- 외부/legacy inline style을 제거하기 전 임시 호환
- 명확한 utility override

금지:

- 일반 레이아웃 전체
- 입력/버튼 크기
- 반복되는 specificity 싸움 해결 목적

---

## 9. 구현 순서

### Phase 0 — 안전장치

완료:

- 기준 SHA 보존: `ae99cb250bbef73a0f39a6ad21cb7f6f38fd53ff`
- 백업 브랜치: `backup/pagero-before-calltag-ui-20260811-1833`

### Phase 1 — 공통 토큰과 workspace shell

1. 콜태그 공통 색상/spacing/control token 생성
2. header 높이 통일
3. 편집/스타일/접수함/통계/설정 main navigation 통일
4. 페이지 전체 background/content width 규칙 통일
5. 기존 header/tab 관련 override 제거

### Phase 2 — 설정

설정을 먼저 안정화한다.

1. 페이지 기본 간격
2. 계정 row
3. 도메인
4. 매니저 권한
5. 요금제/결제
6. SEO 이미지
7. 추적/전환
8. 초기화

설정은 `settings-workspace.css` 하나가 전체 layout을 소유하게 한다.

### Phase 3 — 편집

1. block card/header
2. 링크 editor
3. 버튼/입력/segmented control
4. preview와 editor 간 geometry 안정화
5. 이미지 asset picker

### Phase 4 — 접수함

현재 기능 DOM을 최대한 유지하고 CSS owner를 하나로 합친다.

### Phase 5 — 통계

현재 다중 stats CSS import와 override를 단일 owner로 정리한다.

### Phase 6 — 모바일

desktop 완료 후 각 화면을 720~820px 기준으로 별도 검증한다.

---

## 10. 화면 검수 체크리스트

모든 작업은 코드만 보고 완료 처리하지 않는다.

### 공통

- [ ] 페이지 상단 시작 높이가 탭마다 동일한가
- [ ] content 좌우 기준선이 맞는가
- [ ] 버튼 높이가 같은가
- [ ] input/select 높이가 같은가
- [ ] active tab 문법이 동일한가
- [ ] 카드 radius와 border 색이 동일한가
- [ ] 불필요한 설명문이 없는가
- [ ] 스크롤이 마지막 내용까지 정상 동작하는가
- [ ] 부모 `overflow:hidden` 때문에 자식이 잘리지 않는가
- [ ] 100%, min-width, max-width 충돌이 없는가

### 설정

- [ ] 페이지 기본 필드 라벨 시작점이 동일한가
- [ ] 저장 버튼 위치가 안정적인가
- [ ] 매니저 추가 후 row가 잘리지 않는가
- [ ] 매니저 관리 버튼이 항상 보이는가
- [ ] 공유 이미지가 전체 비율로 보이는가
- [ ] 파비콘과 공유 이미지 규칙이 분리되어 있는가
- [ ] 도메인 DNS 값이 잘리지 않는가

### 편집 링크

- [ ] `없음` 선택 시 카드 높이가 무너지지 않는가
- [ ] 아이콘 선택 시 upload UI가 잘리지 않는가
- [ ] 썸네일 선택 시 preview가 정상 표시되는가
- [ ] 링크/위젯 전환 시 이전 모드의 UI가 남지 않는가
- [ ] 왼쪽 편집 영역의 하단까지 스크롤 가능한가

### 모바일

- [ ] 390px 폭 기준 가로 넘침이 없는가
- [ ] 44px 수준의 touch target을 확보했는가
- [ ] table이 읽을 수 있는 카드/row로 변환되는가
- [ ] fixed navigation이 콘텐츠를 가리지 않는가

---

## 11. 앞으로의 금지사항

1. 캡처 한 장의 문제를 보고 바로 새 CSS 파일을 추가하지 않는다.
2. 기존 owner를 확인하지 않고 `!important`로 덮지 않는다.
3. 화면 하나만 맞추기 위해 전역 selector를 수정하지 않는다.
4. `overflow:hidden`으로 레이아웃 오류를 숨기지 않는다.
5. 고정 `height`로 내용 잘림을 해결하지 않는다.
6. 콜태그와 페이지로에 같은 목적의 컨트롤을 서로 다르게 만들지 않는다.
7. 설정에 반복 설명을 추가하지 않는다.
8. 카드 안에 카드 구조를 기본 패턴으로 사용하지 않는다.
9. desktop 기준만 확인하고 완료 처리하지 않는다.
10. Cloudflare recorder에서 정확한 `sourceSha`와 `outcome=success`를 확인하기 전에 운영 반영 완료라고 말하지 않는다.

---

## 12. 최종 목표 화면 감각

페이지로는 기존의 ‘페이지 제작 도구’ 느낌만 강한 UI에서 벗어나, 콜태그와 같은 **업무용 SaaS 제품군**으로 보이게 한다.

사용자가 받아야 하는 인상은 다음과 같다.

- 설명을 읽지 않아도 바로 조작 가능
- 메뉴 간 이동해도 같은 제품처럼 보임
- 흰 패널과 회색 배경으로 정돈됨
- 검정 active/action으로 명확함
- 파란색은 필요한 곳에만 사용
- 데이터와 실제 설정값이 중심
- PC에서 정보 밀도가 충분함
- 모바일에서 억지 축소가 아니라 재배치됨
- 한 화면 수정이 다른 화면을 망가뜨리지 않음

이 문서를 페이지로 UI/UX 개편의 기준 문서로 사용한다.

향후 UI 관련 변경은 ‘이 화면만 당장 보이게 고친다’가 아니라 **콜태그 공통 제품 디자인 시스템 + 단일 CSS 소유권 + 반응형 검수** 세 가지를 동시에 만족해야 한다.
