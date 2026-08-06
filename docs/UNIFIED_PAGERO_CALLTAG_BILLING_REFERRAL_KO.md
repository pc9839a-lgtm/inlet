# 페이지로·콜태그 통합 결제·추천·정산

## 계정 기준

- 페이지로와 콜태그는 인증 세션의 `accounts.id`를 공통 계정 키로 사용한다.
- 이메일이 같더라도 별도 숫자를 합산하는 방식이 아니라, 서버에서 동일 계정 ID를 확인한 뒤 하나의 원장을 조회한다.
- 페이지로 설정 화면: `GET /api/account-finance`
- 페이지로 별칭: `GET /api/pagero/finance`
- 콜태그 앱 별칭: `GET /api/calltag/finance`
- 세 주소는 모두 같은 `functions/api/account-finance.js` 구현과 같은 D1 테이블을 사용한다.

## 설정 메뉴

페이지 편집기 → 설정 → 서비스

- `요금제·결제`
  - 페이지로 요금제
  - 콜태그 요금제
  - 서비스별 현재 구독 상태
  - 페이지로·콜태그 통합 정산 금액
- `추천인`
  - 내 추천인 코드 복사
  - 추천인 코드 등록
  - 추천 가입 수
  - 통합 추천 수익과 정산 가능 금액

## 요금제

### 페이지로

- 무료: 0원
- 스타터: 월 3,500원
- 프로: 월 9,900원

### 콜태그

- 무료 체험: 3일
- 클래식: 월 3,500원
- 프로: 월 5,500원

## 추천 정책

- 추천인 코드는 계정당 한 번만 등록할 수 있다.
- 본인의 추천인 코드는 등록할 수 없다.
- 추천인 코드를 등록한 계정은 무료 이용 기간 5일을 추가한다.
- 추천한 계정은 추천받은 사용자의 유료 결제 금액 중 20%를 추천 수익으로 적립한다.
- 페이지로 결제와 콜태그 결제에서 발생한 추천 수익은 서비스별로 기록하되 같은 계정의 통합 정산에 합산한다.

## 서버 원장

- `account_finance_profiles`: 추천 코드, 추천 등록 계정, 무료 기간 혜택
- `account_subscriptions`: 페이지로·콜태그 서비스별 구독
- `account_referrals`: 추천 관계와 20% 수익률
- `account_finance_ledger`: 결제, 환불, 추천 수익, 지급, 조정 내역

## 결제 시스템 연동

결제 제공자 또는 Google Play 서버는 API 토큰으로 다음 작업을 호출한다.

### 구독 상태 갱신

`POST /api/account-finance`

```json
{
  "action": "update-subscription",
  "accountId": "account-id",
  "service": "calltag",
  "planCode": "classic",
  "status": "active",
  "provider": "google-play",
  "providerSubscriptionId": "provider-id"
}
```

### 결제 완료 기록

```json
{
  "action": "record-charge",
  "accountId": "account-id",
  "service": "pagero",
  "amountKrw": 3500,
  "status": "paid",
  "providerRef": "unique-payment-id"
}
```

`record-charge`는 동일 `providerRef` 중복을 차단하고, 추천 관계가 있으면 추천인 계정에 결제 서비스 기준 20% 추천 수익을 자동 기록한다.

### 통합 정산 지급

```json
{
  "action": "record-payout",
  "accountId": "account-id",
  "amountKrw": 12000,
  "status": "paid",
  "providerRef": "payout-id"
}
```

지급은 `service=combined`로 기록한다. 화면은 서비스별 적립액과 페이지로·콜태그 합산 금액을 함께 표시한다.

## 배포 조건

- `migrations/0011_unified_account_finance.sql`을 운영 D1에 적용한다.
- `PAGERO_CHECKOUT_URL`, `CALLTAG_CHECKOUT_URL`을 결제 제공자 주소로 설정할 수 있다.
- 값이 없으면 현재 구독 페이지 경로를 사용한다.
