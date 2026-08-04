# CallTag Google Play 미등록 결제 게이트

- 작성일: 2026-08-04
- 서버 PR: `pc9839a-lgtm/inlet` #69
- Android 연동: `pc9839a-lgtm/calltag` #40, v0.42.1
- 상태: Play Console 등록 전, 운영 결제 비활성

## 1. 목적

Google Play Console에 앱과 구독 상품이 등록되기 전에 Android Billing 코드가 배포되더라도 실제 구매·복원·검증이 시작되지 않도록 서버를 최종 차단점으로 둔다.

이 게이트는 앱 UI의 비활성화와 별개다. 변조된 앱이나 오래된 APK가 구매 검증 API를 직접 호출해도 서버가 거부해야 한다.

## 2. 운영 환경변수

```text
GOOGLE_PLAY_BILLING_ENABLED=0
GOOGLE_PLAY_PRODUCTS_READY=0
GOOGLE_PLAY_CLIENT_EMAIL=
GOOGLE_PLAY_PRIVATE_KEY=
```

기본값은 모두 결제 불가다.

- `GOOGLE_PLAY_PRODUCTS_READY=1`: Play Console에 앱·구독 상품·기본 요금제 등록과 판매 설정이 끝났음을 의미한다.
- `GOOGLE_PLAY_BILLING_ENABLED=1`: 내부 구매 검증까지 완료한 뒤 결제를 최종 공개하는 스위치다.
- 서비스 계정 이메일과 비공개 키는 Android Publisher API 검증용이며 저장소에 커밋하지 않는다.

## 3. 결제 가능 판정

다음 세 조건이 모두 참일 때만 `available=true`다.

1. `GOOGLE_PLAY_BILLING_ENABLED` 활성
2. `GOOGLE_PLAY_PRODUCTS_READY` 활성
3. Google Play 서비스 계정 환경변수 2개 등록

응답 예시:

```json
{
  "available": false,
  "stage": "pre_registration",
  "reasonCode": "PLAY_RELEASE_DISABLED",
  "message": "앱 결제 기능을 준비하고 있습니다."
}
```

서버는 서비스 계정 이메일·키 원문이나 설정 여부 세부값을 응답하지 않는다.

## 4. API 적용

### 이용권 조회

`GET /api/billing/entitlements`

기존 이용권 응답에 다음 필드를 포함한다.

```json
{
  "entitlement": {
    "billingAvailability": {
      "googlePlay": {
        "available": false,
        "stage": "pre_registration",
        "reasonCode": "PLAY_RELEASE_DISABLED",
        "message": "앱 결제 기능을 준비하고 있습니다."
      }
    }
  }
}
```

무료 3일, 추천 +5일, 웹 구독 중복 판정은 결제 준비 상태와 무관하게 정상 동작한다.

### 구매 검증

`POST /api/billing/google/verify`

준비 조건을 충족하지 않으면 Android Publisher API를 호출하기 전에 503으로 차단한다.

```json
{
  "ok": false,
  "error": "앱 결제 기능을 준비하고 있습니다.",
  "details": {
    "code": "PLAY_BILLING_NOT_READY"
  }
}
```

### 구매 복원

`POST /api/billing/google/restore`

구매 검증과 동일한 준비 게이트를 통과해야 한다. 준비 전에는 전달된 구매 토큰을 처리하거나 외부 API에 전송하지 않는다.

## 5. 안전 불변식

- 준비 전 Android Publisher API 호출 0건
- 준비 전 구매 승인 API 호출 0건
- 준비 전 `billing_subscriptions` 신규 Play 구독 기록 0건
- 구매 토큰 원문 D1 저장 금지
- 앱 UI 플래그만 신뢰하지 않음
- 웹 구독과 Play 구독 중복 차단 유지
- 결제 게이트 해제와 D1 migration 적용을 같은 작업으로 묶지 않음

## 6. 활성화 체크리스트

1. Play Console 개발자 계정과 앱 등록 완료
2. 패키지명 `kr.pagero.calltag` 일치 확인
3. 구독 상품 3개 등록
   - `call_monthly`
   - `message_monthly`
   - `all_monthly`
4. 기본 요금제·가격·판매 국가·세금 설정 확인
5. 내부 테스트 트랙에 서명 APK/AAB 업로드
6. Play Console API 액세스에 서비스 계정 연결
7. Cloudflare Production 환경변수 등록
8. `GOOGLE_PLAY_PRODUCTS_READY=1`
9. 라이선스 테스터 구매·복원·취소·재구독 검증
10. 서버 구매 검증과 acknowledgement 확인
11. 페이지로 웹 구독 보유 계정의 중복구매 차단 확인
12. 최종 승인 후 `GOOGLE_PLAY_BILLING_ENABLED=1`

## 7. 롤백

결제 오류가 확인되면 `GOOGLE_PLAY_BILLING_ENABLED=0`으로 변경한다.

이 조치는 신규 구매와 복원을 즉시 막지만 기존 서버 이용권과 고객 데이터는 삭제하지 않는다. 기존 유료 사용자의 권한 유지 여부는 구독 상태 동기화 정책에 따라 별도로 처리한다.

## 8. QA 계약

`scripts/billing-referral-quality-check.mjs`에서 다음을 검사한다.

- 두 개의 명시적 release flag 존재
- 미등록 단계 응답 존재
- 이용권 API에 결제 준비 상태 포함
- verify·restore가 외부 검증보다 먼저 readiness gate 실행
- `PLAY_BILLING_NOT_READY` 오류 코드 유지
- 응답에 자격증명 설정 세부값 미노출
