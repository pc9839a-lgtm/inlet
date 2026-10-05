# 페이지로·콜태그 통합 결제·추천·파트너·정산

- 상태: SOURCE / 통합 결제·추천·정산 기준
- 갱신일: 2026-10-02 KST
- 원칙: 날짜가 붙은 과거 Google Play 운영 스냅샷보다 이 문서와 현재 서버 코드를 우선한다.

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

## 문서 기준

과거의 날짜별 Google Play billing 환경 스냅샷은 삭제했다. 현재 제품명·가격·허용 상품은 이 문서, `PAGERO_PLAN_POLICY_KO.md`, 현재 `functions/api/billing/**` 구현을 함께 확인한다.

과거 문서에 남아 있던 상품 생성 여부, 특정 배포 SHA, 일회성 운영 검증 결과를 현재 정책으로 재사용하지 않는다.

## 요금제

### 페이지로

- 무료: 0원 (`pagero_free`, 화면 기본 제공)
- 클래식: 월 3,500원 (`pagero_monthly`)
- 프로: 월 5,500원 (`pagero_pro_monthly`)

### 콜태그

- 콜태그 통합: 월 6,000원 (`all_monthly`)

콜태그 화면에는 클래식·프로를 별도로 노출하지 않는다. 기존 `call_monthly`, `message_monthly` 데이터가 있더라도 사용자 화면에서는 콜태그 통합으로 정규화한다.

### 아직 결제 상품으로 확정하지 않은 항목

- 개인 도메인·HTTPS·SSL의 플랜 포함 여부와 별도 요금은 아직 owner 확정 전이다.
- `pagero_domain_monthly` 같은 별도 도메인 결제 상품을 checkout/confirm에 노출하거나 승인하지 않는다.
- 프로 요금제에 SSL이 포함된다고 가정하지 않는다.
- 콜태그 `all_monthly` 구독이 페이지로 클래식을 자동 포함한다고 가정하지 않는다.
- 위 권한은 `PAGERO_PLAN_POLICY_KO.md`에 따라 owner가 별도로 확정한 뒤 서버 entitlement로 구현한다.

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

## 페이지로 웹 결제 P7 기반

페이지로 웹 자동결제는 provider를 아직 확정하지 않았고 실제 청구도 비활성 상태다.

현재 기반 계약:

- 주문 원장: `billing_web_orders`
- webhook 수신 원장: `billing_webhook_events`
- PageRo 웹 주문 상품: `pagero_monthly`, `pagero_pro_monthly`
- 주문 금액은 서버 고정값 3,500원 / 5,500원으로 검증
- 주문 idempotency: `owner_id + idempotency_key`
- webhook idempotency: `provider + event_id`
- webhook 검증은 실제 PG를 선택한 뒤 provider 전용 adapter가 해당 PG의 공식 서명 규칙으로 처리한다. 범용 가짜 헤더 규칙을 제품 계약으로 가정하지 않는다.
- provider adapter가 없으면 readiness는 `provider_adapter_missing`으로 fail-closed 처리한다.
- 내부 normalized lifecycle은 결제 성공/실패, 갱신, grace, 취소, 부분/전액 환불 상태 전이를 별도 계약으로 관리한다.
- 실제 provider 활성화 전에는 generic webhook이 구독 entitlement를 직접 변경하지 않는다.
- 읽기 전용 `GET /api/billing/web/history`는 web order와 payment event를 같은 계정 범위로 반환한다.
- `INLET_WEB_BILLING_ORDER_WRITE_ENABLED`와 `INLET_WEB_BILLING_CHARGING_ENABLED`가 모두 명시적으로 준비되지 않으면 실제 결제로 진행하지 않는다.

production `0016_pagero_web_billing_foundation.sql`은 적용 완료됐다. 현재 production 원장의 web order / webhook event는 0건이며 실제 PG 활성화는 별도 운영 단계다.

## 공용 API

### 구독

- `GET /api/billing/subscriptions`
- `GET /api/billing/entitlements`
- `POST /api/billing/web/precheck`
- `POST /api/billing/web/confirm`
- `GET /api/billing/web/history`
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
