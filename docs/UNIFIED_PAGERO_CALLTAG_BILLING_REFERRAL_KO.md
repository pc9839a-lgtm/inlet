# 페이지로·콜태그 통합 결제·추천·정산

## 단일 계정 기준

페이지로와 콜태그는 인증 세션에서 확인한 동일한 `owner_id`를 결제·추천·정산의 공통 계정 키로 사용한다.

별도 서비스별 잔액을 브라우저에서 더하는 방식이 아니다. 두 서비스가 동일한 D1 원장을 조회하므로 같은 계정에서는 구독 상태, 추천 코드, 추천 가입 수, 예상 수익, 확정 수익이 동일해야 한다.

## 기존 통합 원장

운영 기준 마이그레이션은 `migrations/0009_unified_billing_referral.sql`이다.

- `billing_accounts`: 무료 이용 기간과 추천 보너스
- `billing_subscriptions`: 페이지로 웹 결제와 콜태그 Google Play 결제를 채널만 구분해 함께 저장
- `referral_codes`: 계정별 추천인 코드
- `referrals`: 추천인 관계, 계정당 1회 등록, 무료 기간 5일 추가
- `partner_commissions`: 추천 수익 원장

새 결제 원장을 병렬로 만들지 않는다.

## 공용 API

### 구독

- `GET /api/billing/subscriptions`
- `GET /api/billing/entitlements`
- `POST /api/billing/web/precheck`
- `POST /api/billing/web/confirm`
- `POST /api/billing/google/verify`
- `POST /api/billing/google/restore`

페이지로 웹 결제와 콜태그 Google Play 결제는 모두 `billing_subscriptions.owner_id`에 저장된다.

### 추천인

- `GET /api/referrals/me`: 내 코드와 등록된 추천인 코드
- `POST /api/referrals/apply`: 추천인 코드 등록
- `GET /api/referrals/summary`: 추천 가입, 유료 전환, 이번 달 예상 수익, 누적 확정 수익

페이지로 설정 화면과 콜태그 앱은 같은 API와 같은 `owner_id`를 사용한다.

## 설정 메뉴

페이지 편집기 → 설정 → 서비스

### 요금제·결제

- 페이지로 월 3,500원 (`pagero_monthly`)
- 콜태그 클래식 월 3,500원 (`call_monthly`)
- 콜태그 프로 월 5,500원 (`all_monthly`)
- 현재 서비스별 구독 상태
- 무료 이용 잔여 기간
- 추천 정산 통합 현황

### 추천인

- 내 추천인 코드 복사
- 추천인 코드 등록
- 추천 가입 수
- 유료 전환 수
- 이번 달 예상 수익
- 누적 확정 수익

## 추천 정책

- 기본 무료 이용 기간: 3일
- 추천인 코드 등록: 무료 이용 기간 5일 추가
- 계정당 한 번만 등록 가능
- 본인 코드 등록 불가
- 첫 유료 결제 이후 등록 불가
- 추천 수익률: 결제 금액의 20%
- 페이지로와 콜태그에서 발생한 추천 수익은 동일한 추천인 `owner_id`로 합산

## 추천 수익 서버 적립

`functions/api/billing/_commissions.js`가 결제금액의 20%를 서버에서 계산한다.

- 비율: `2000 bps` = 20%
- 적립 대상: `referrals.referrer_owner_id`
- 원장: `partner_commissions`
- 중복 방지: 채널과 결제 고유번호를 조합한 `payment_reference`
- `payment_reference`는 원장에서 UNIQUE이므로 같은 결제를 반복 검증해도 한 번만 적립된다.
- 적립 후 추천 관계의 `first_paid_at`과 상태를 갱신한다.

적립 경로는 다음과 같다.

- 콜태그 Google Play 신규 검증: `/api/billing/google/verify`
- 콜태그 Google Play 구매 복원: `/api/billing/google/restore`
- 페이지로 웹 결제 제공자 확정: `/api/billing/web/confirm`

웹 결제 확정 API는 `X-Inlet-Api-Token` 또는 Bearer API 토큰을 요구하며, Google Play 구독이 이미 활성화된 계정의 웹 결제 확정을 차단한다.

## 결제 중복 방지

`POST /api/billing/web/precheck`는 기존 웹 또는 Google Play 구독이 활성 상태인지 확인한다.

- Google Play 구독이 있으면 웹 중복 결제를 차단한다.
- 웹 구독이 있으면 웹 재결제를 차단한다.
- Google Play 검증도 기존 웹 구독을 확인해 결제 채널 중복을 차단한다.
- 웹 결제 확정도 기존 Google Play 구독을 다시 확인한다.

## UI 연결

`src/lib/accountFinanceRepository.js`가 다음 응답을 한 화면 데이터로 조합한다.

- `/api/billing/subscriptions`
- `/api/referrals/me`
- `/api/referrals/summary`

설정 화면 자체에 별도 금액 저장 로직은 없다. 서버 원장 응답만 표시한다.

## QA

- `scripts/billing-referral-quality-check.mjs`
- `.github/workflows/billing-referral-qa.yml`

QA는 3일 무료 체험, 추천 +5일, 1회 등록, 본인 추천 차단, 결제 후 추천 차단, Google Play 검증, 웹 결제 확정, 20% 서버 계산, 결제 고유번호 중복 방지, 결제 채널 중복 방지, 공용 추천 원장 계약을 확인한다.
