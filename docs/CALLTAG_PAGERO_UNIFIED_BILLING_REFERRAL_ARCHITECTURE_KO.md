# CallTag × PageRo 공통 결제·추천 구조

## 현재 구현 기준

- 서버 Draft PR: `pc9839a-lgtm/inlet#69`
- Android Draft PR: `pc9839a-lgtm/calltag#40`
- Android 버전: `0.42.2`
- 기본 무료기간: 3일
- 추천인 최초 등록: +5일
- Google Play Console: 미등록
- 파트너센터 모바일 웹: 현재 범위 제외

## 서비스 구분

- PageRo: 랜딩페이지 제작·문의 수집 웹서비스
- CallTag: 전화관리·문자자동화 Android 앱
- 두 서비스는 같은 계정을 사용할 수 있으나 별도 상품도 제공한다.
- 통합권은 어느 결제 채널에서 구매해도 두 서비스 범위를 활성화한다.

## 상품

| 코드 | 상품 | 월 금액 | 범위 |
|---|---:|---:|---|
| `pagero_monthly` | 페이지로 | 3,500원 | PageRo |
| `call_monthly` | 전화관리 | 1,900원 | CallTag 전화 |
| `message_monthly` | 문자자동화 | 990원 | CallTag 문자 |
| `all_monthly` | 통합권 | 6,000원 | PageRo + CallTag |

## 결제 채널

- `web`: PageRo 웹 PG
- `google_play`: CallTag Google Play Billing

결제 채널은 결제 출처이고, 상품 코드는 이용 범위이며, 최종 기능 권한은 서버 이용권 판정 결과다.

## 공통 이용권

핵심 API:

```text
GET /api/billing/entitlements
GET /api/billing/subscriptions
```

응답에는 다음이 포함된다.

- 서버 시각
- 현재 상품과 결제 채널
- 시작·종료·다음 결제 시각
- 무료기간 상태
- 기능별 접근 권한
- 만료 전·후 안내
- Google Play 공개 준비상태

## 무료기간과 만료

- 계정 생성 기준 기본 3일
- 추천인 코드 최초 등록 시 +5일
- 한 계정 최대 8일
- 앱 재설치로 초기화하지 않음
- 서버 시각을 정본으로 만료 판정

만료 후에도 고객·상담·메모·일정·템플릿·발송기록은 삭제하지 않는다. 신규 통화 후 정리와 문자 자동화 실행만 중지한다.

## 중복결제 방지

### 앱 결제 전

Android는 결제창을 열기 전에 서버 이용권을 다시 조회한다.

- 활성 웹 구독이 있으면 Play 결제 차단
- 활성 Play 구독이 있으면 추가 Play 구매 차단
- 서버 확인 실패 시 결제 미진행

### 웹 결제 전

```text
POST /api/billing/web/precheck
```

- 활성 Play 구독: `GOOGLE_PLAY_SUBSCRIPTION_ACTIVE`
- 활성 웹 구독: `WEB_SUBSCRIPTION_ACTIVE`
- 지원하지 않는 상품: `WEB_PRODUCT_INVALID`

사전 판정은 checkout을 생성하지 않는다.

## Google Play 미등록 게이트

다음 조건이 모두 충족돼야 결제 가능 상태다.

```text
GOOGLE_PLAY_BILLING_ENABLED=1
GOOGLE_PLAY_PRODUCTS_READY=1
GOOGLE_PLAY_CLIENT_EMAIL=<configured>
GOOGLE_PLAY_PRIVATE_KEY=<configured>
```

현재는 앞의 두 플래그를 0으로 유지한다.

- Android BillingClient 연결하지 않음
- 상품 조회하지 않음
- verify·restore API는 Publisher API 호출 전에 차단
- 구매 토큰 원문은 저장하지 않음

## 추천 구조

```text
GET  /api/referrals/me
POST /api/referrals/apply
GET  /api/referrals/summary
```

정책:

- 본인 추천 금지
- 한 계정 한 번만 등록
- 첫 유료 전환 이후 등록 금지
- 무료기간 +5일 최초 한 번
- 직접 추천 1단계
- 앱은 수익률을 직접 계산하지 않고 서버 ledger 결과만 표시

추천 공유 링크:

```text
https://pagero.kr/r/{추천코드}
```

설치된 앱에서는 코드를 자동 보관하고 로그인 후 등록한다. 미설치 사용자는 랜딩의 코드를 수동 입력할 수 있다.

## 파트너센터 제외

현재 구현하지 않는다.

- 모바일 웹 파트너센터
- 출금 신청
- 계좌·세금정보 등록
- 추천 회원별 정산 상세

앱에는 추천 회원 수, 유료 회원 수, 예상 수익, 확정 수익 요약만 유지한다.

## D1

Migration:

```text
migrations/0009_unified_billing_referral.sql
```

테이블:

- `billing_accounts`
- `billing_subscriptions`
- `referral_codes`
- `referrals`
- `partner_commissions`

## 후속 운영 작업

- 운영 D1 migration 승인·적용
- 서버 배포
- 웹 checkout/webhook 구현
- Play Console 앱·상품 등록
- 서비스 계정 연결
- 라이선스 테스터 검증
- RTDN 구현
- 결제·환불·유예·만료 reconciliation
- 파트너 commission ledger 생성

## 금지

- 운영 검증 전 Play 결제 flag 활성화 금지
- 서버 검증 없는 앱 권한 발급 금지
- 중복 결제 확인 전 checkout 생성 금지
- 구매 토큰 원문 장기 저장 금지
- 만료 시 고객 데이터 삭제 금지
- 파트너센터 구현 완료 표기 금지

## 상세 문서

- `docs/CALLTAG_GOOGLE_PLAY_PREREGISTRATION_GATE_KO.md`
- `docs/CALLTAG_ENTITLEMENT_LIFECYCLE_WEB_PRECHECK_KO.md`
