# 페이지로·콜태그 통합 결제·추천·파트너·정산

## 단일 계정 기준

페이지로와 콜태그는 인증 세션에서 확인한 동일한 `owner_id`를 결제·추천·파트너·정산의 공통 계정 키로 사용한다.

서비스별 금액을 브라우저에서 임의로 합산하지 않는다. 페이지로와 콜태그가 동일한 D1 원장을 조회하므로 같은 계정에서는 파트너 코드, 추천 가입 수, 예상 수익, 확정 수익이 일치해야 한다.

## 통합 원장

운영 기준 마이그레이션은 `migrations/0009_unified_billing_referral.sql`이다.

- `billing_accounts`: 기본 무료 기간과 가입 추천 혜택
- `billing_subscriptions`: 페이지로 웹 결제, 콜태그 결제, 가입 추천 이용권
- `referral_codes`: 계정별 파트너 코드
- `referrals`: 추천인 관계, 추천받은 계정당 1회
- `partner_commissions`: 페이지로·콜태그 파트너 수익 원장

별도의 페이지로 정산 원장이나 콜태그 정산 원장을 만들지 않는다.

## 요금제

### 페이지로

- 무료: 0원 (`pagero_free`, 화면 기본 제공)
- 클래식: 월 3,500원 (`pagero_monthly`)
- 프로: 월 5,500원 (`pagero_pro_monthly`)

### 콜태그

- 콜태그 통합: 월 6,000원 (`all_monthly`)

콜태그 화면에는 클래식·프로를 별도로 노출하지 않는다. 기존 `call_monthly`, `message_monthly` 데이터가 있더라도 사용자 화면에서는 콜태그 통합으로 정규화한다.

## 설정 메뉴

페이지 편집기 → 설정 → 서비스

- `요금제·결제`: 페이지로와 콜태그 요금제 및 현재 이용 상태
- `추천인`: 가입 당시 입력한 추천인 코드와 적용 상태
- `파트너`: 내 파트너 코드 복사, 추천 가입·유료 전환·수익 현황
- `정산`: 페이지로·콜태그 합산 정산 요약과 정산 페이지 이동

정산 페이지 주소:

- `https://calltag.pagero.kr/web/settlement`

## 추천인 정책

- 추천인 코드는 회원가입 화면에서만 선택 입력한다.
- 가입 완료 후에는 입력·변경할 수 없다.
- 유효한 추천인 코드를 입력하면 `페이지로 클래식 7일 이용권`을 지급한다.
- 이용권은 `billing_subscriptions`에 다음 값으로 저장한다.
  - `product_code = pagero_monthly`
  - `channel = referral`
  - `status = active`
  - `verification_state = promotional`
  - 가입 시각부터 7일 후 만료
- 프로모션 이용권은 유료 전환으로 집계하지 않는다.
- 본인 추천과 중복 추천 관계는 차단한다.
- 추천 혜택은 이메일 회원가입에서 적용한다. 추천 코드가 입력되면 Google 회원가입 버튼은 숨긴다.

## 파트너 정책

- 내 파트너 코드는 설정 → 파트너에서 복사한다.
- 추천받은 계정이 페이지로 또는 콜태그를 결제하면 결제 금액의 20%를 파트너 수익으로 기록한다.
- 페이지로와 콜태그 수익은 동일한 `referrer_owner_id`로 합산한다.
- 파트너 실적과 정산은 추천인 입력 화면과 분리한다.

## 추천 수익 서버 적립

`functions/api/billing/_commissions.js`가 결제금액의 20%를 서버에서 계산한다.

- 비율: `2000 bps` = 20%
- 페이지로 클래식 기준금액: 3,500원
- 페이지로 프로 기준금액: 5,500원
- 콜태그 통합 기준금액: 6,000원
- 적립 대상: `referrals.referrer_owner_id`
- 원장: `partner_commissions`
- 중복 방지: 채널과 결제 고유번호를 조합한 `payment_reference`
- 같은 결제를 반복 검증해도 한 번만 적립한다.

적립 경로:

- 콜태그 Google Play 신규 검증: `/api/billing/google/verify`
- 콜태그 Google Play 구매 복원: `/api/billing/google/restore`
- 웹 결제 제공자 확정: `/api/billing/web/confirm`

## 서비스별 결제 중복 방지

페이지로와 콜태그는 같은 계정을 쓰지만 서로 다른 서비스다.

- 페이지로 무료·클래식·프로 상태는 페이지로 결제만 판단한다.
- 콜태그 통합 상태는 콜태그 결제만 판단한다.
- 페이지로 추천 클래식 7일 이용권이 콜태그 통합 결제를 막지 않는다.
- 콜태그 Google Play 구독은 콜태그 웹 중복 결제만 차단한다.
- 콜태그 구독이 페이지로 클래식·프로 결제를 막지 않는다.

## 공용 API

### 구독

- `GET /api/billing/subscriptions`
- `GET /api/billing/entitlements`
- `POST /api/billing/web/precheck`
- `POST /api/billing/web/confirm`
- `POST /api/billing/google/verify`
- `POST /api/billing/google/restore`

### 추천·파트너

- `GET /api/referrals/me`: 내 파트너 코드와 가입 당시 등록 상태
- `POST /api/referrals/apply`: 가입 후 등록 차단 응답 `REFERRAL_SIGNUP_ONLY`
- `GET /api/referrals/summary`: 추천 가입, 유료 전환, 예상·확정 수익

## 화면 레이아웃

- 페이지 기본 입력 영역은 데스크톱에서 2열 전체 폭을 사용한다.
- 입력 높이는 56px 기준으로 확대한다.
- 매니저 마스터 정보, 매니저 목록, 빈 상태, 첫 매니저 추가 버튼은 동일한 가로 영역을 사용한다.
- 요금제·파트너·정산 화면은 통계와 액션을 넓은 그리드로 표시한다.
- 모바일에서는 모두 1열로 전환한다.

## QA

- `scripts/billing-referral-quality-check.mjs`
- `.github/workflows/billing-referral-qa.yml`

QA는 정확한 요금제 금액, 가입 전용 추천 코드, 클래식 7일 이용권, 가입 후 추천 차단, 20% 서버 적립, 서비스별 결제 중복 차단, 파트너·정산 메뉴 분리, 정산 링크, 페이지 기본·매니저 전체 폭 레이아웃을 검사한다.
