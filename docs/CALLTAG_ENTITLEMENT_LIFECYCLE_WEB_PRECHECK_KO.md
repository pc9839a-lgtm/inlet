# CallTag 이용권 수명주기·웹 결제 사전 판정

## 적용 범위

연결 PR:

- 서버: `pc9839a-lgtm/inlet` Draft PR #69
- Android: `pc9839a-lgtm/calltag` Draft PR #40
- Android 버전: `0.42.2` / versionCode `62`

이번 단계에서는 파트너센터 모바일 웹을 개발하지 않는다.

## 이용권 정본

이용권 상태는 서버 D1을 정본으로 사용한다.

`GET /api/billing/entitlements`는 다음 값을 반환한다.

- `serverNow`: 서버 현재 시각
- `active`: 현재 유효 이용권 여부
- `status`: trial / active / grace / cancelled / expired / inactive
- `productCode`: call_monthly / message_monthly / all_monthly
- `channel`: none / web / google_play
- `endsAt`
- `nextBillingAt`
- `remainingDays`
- `featureAccess`
- `notice`
- `billingAvailability`

## 무료기간

- 기본 무료기간: 3일
- 추천인 최초 등록 혜택: +5일
- 계정당 최대 무료기간: 8일
- 앱 삭제·재설치로 무료기간을 다시 시작하지 않음
- 기기 날짜 변경으로 무료기간을 연장하지 않음

서버는 응답 생성 시각을 `serverNow`로 반환한다. Android는 서버 시각과 당시 기기 시각을 함께 저장하고 경과시간을 더해 오프라인 상태에서도 예상 서버 시각을 계산한다.

## 만료 후 데이터 정책

무료기간 또는 유료 이용권이 만료돼도 다음 데이터는 삭제하지 않는다.

- 고객 정보
- 상담 이력
- 메모
- 일정과 할 일
- 문자 템플릿
- 기존 문자 발송 내역
- 백업 데이터

서버 `featureAccess` 기본 계약:

```json
{
  "customerDataRead": true,
  "customerDataWrite": true,
  "consultationHistoryRead": true,
  "callManagement": false,
  "messageAutomation": false
}
```

`callManagement`와 `messageAutomation`은 유효한 상품 범위에서만 true가 된다.

## 만료 안내

### TRIAL_ENDING_24H

종료 시각이 24시간 이내인 무료 이용권에 반환한다.

안내 원칙:

- 종료 예정 사실
- 고객·상담 기록 유지
- 통화 후 정리와 문자 자동화만 중지
- 이용권 확인 경로 제공

### TRIAL_EXPIRED

무료기간이 종료된 계정에 반환한다.

안내 원칙:

- 고객 기록은 계속 열람 가능
- 신규 통화 후 정리 중지
- 신규 자동문자·단체문자 중지
- 이용권 활성화 시 자동화 재개

## 상품별 기능

### call_monthly

- 통화 종료 후 고객 정리
- 부재중·미응답 후속 관리
- 전화 기반 고객관리

### message_monthly

- 통화 후 자동문자
- 예약·후속 문자
- 그룹·단체문자

### all_monthly

- 전화관리
- 문자자동화
- 페이지로 통합 범위

읽기 전용 기록 화면과 템플릿 확인은 만료 후에도 유지한다. 실제 전송·자동화 실행 시점에는 Android에서 이용권을 다시 확인한다.

## 웹 결제 사전 판정

엔드포인트:

```text
POST /api/billing/web/precheck
```

입력:

```json
{
  "productCode": "all_monthly"
}
```

허용 상품:

- pagero_monthly
- all_monthly

서버는 checkout을 만들기 전에 동일 계정의 활성 웹·Google Play 구독을 확인한다.

차단 코드:

- `GOOGLE_PLAY_SUBSCRIPTION_ACTIVE`
- `WEB_SUBSCRIPTION_ACTIVE`
- `WEB_PRODUCT_INVALID`

이 API는 결제창이나 구독을 생성하지 않는다. 실제 웹 PG checkout과 webhook은 후속 범위다.

## 결제 준비상태

엔드포인트:

```text
GET /api/billing/readiness
```

반환 범위:

- Google Play 공개 가능 여부와 단계
- 웹 checkout 준비 단계
- 서버 시각

서비스 계정 이메일·비공개 키·Secret 값은 응답하지 않는다.

현재 Google Play 상태:

```text
GOOGLE_PLAY_PRODUCTS_READY=0
GOOGLE_PLAY_BILLING_ENABLED=0
```

따라서 Android는 BillingClient 연결과 상품 조회를 시작하지 않는다.

## 추천 링크 자동 귀속

공유 링크:

```text
https://pagero.kr/r/{추천코드}
```

서버 라우트:

```text
functions/r/[code].js
```

동작:

1. 추천코드를 화면에 표시한다.
2. 설치된 CallTag 앱의 `calltag://referral?code=...` 실행을 시도한다.
3. 앱은 로그인 전에도 코드를 최대 30일 보관한다.
4. 로그인 후 `POST /api/referrals/apply`를 자동 호출한다.
5. 자동 등록에 실패해도 사용자는 코드를 직접 입력할 수 있다.

해당 랜딩은 `noindex,nofollow`로 검색 노출 대상이 아니다.

## 파트너센터 제외

이번 단계에서 구현하지 않는 항목:

- 파트너센터 모바일 웹 UI
- 파트너센터 이동 버튼
- 추천 회원별 상세 화면
- 정산 계좌 등록
- 출금 신청
- 세금계산서·원천징수 처리

현재 앱에는 다음 요약만 유지한다.

- 추천 회원 수
- 유료 이용 회원 수
- 이번 달 예상 수익
- 누적 확정 수익

서버 응답은 다음과 같이 파트너센터 비활성 상태를 명시한다.

```json
{
  "partnerCenterAvailable": false,
  "partnerCenterUrl": ""
}
```

## 운영 반영 전 확인

- 운영 D1 migration 승인
- 서버 API 배포
- serverNow와 만료 전환 실검증
- 무료기간 3일·추천 +5일 실계정 검증
- 웹/Play 중복구독 fixture 검증
- 추천 링크 앱 설치 상태 검증
- 기존 고객·상담·문자 데이터 비삭제 확인
- Google Play 등록 전 release flag 0 유지

## 금지 사항

- Draft PR에서 운영 배포 금지
- 운영 D1 migration 실행 금지
- Google Play 결제 flag 활성화 금지
- 웹 checkout 공개 금지
- 만료 계정의 고객 데이터 삭제 금지
- 파트너센터가 구현됐다고 표시 금지
