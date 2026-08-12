# CallTag Google Play Billing 서버 환경 — 2026-08-12

CallTag 서버 저장소: `pc9839a-lgtm/inlet` / `main`

## 현재 운영 Secret

필수:

```text
GOOGLE_PLAY_CLIENT_EMAIL=<service account client_email>
GOOGLE_PLAY_PRIVATE_KEY=<service account private_key>
```

실제 값은 Cloudflare Secret에만 저장한다. 저장소/문서/채팅에 원문을 넣지 않는다.

현재 서버 readiness는 위 credential이 구성되어 있고 명시적 중지 상태가 아니면 Google Play 결제를 사용 가능으로 판단한다.

긴급 중지:

```text
GOOGLE_PLAY_BILLING_DISABLED=1
```

과거의 `GOOGLE_PLAY_BILLING_ENABLED` / `GOOGLE_PLAY_PRODUCTS_READY` 수동 플래그는 현재 핵심 readiness 게이트가 아니다.

## 실제 운영 검증 완료

2026-08-12 운영 서버에서 다음을 확인했다.

- service account private key import/JWT 서명 성공
- Google OAuth access token 발급 성공
- Android Publisher API 접근 성공
- subscription catalog 조회 성공
- `call_monthly` 존재 확인
- `message_monthly` 존재 확인
- 실제 `call_monthly` 테스트 구매 서버 검증 성공
- 운영 D1 `channel=google_play / status=active / verification_state=verified`
- server acknowledgement 경로 유지

## 현재 Play 상품

- `call_monthly` — 사용
- `message_monthly` — 사용
- `all_monthly` — 현재 미생성, 검증/구매 허용 대상 아님

사용자 지시 전 `all_monthly`를 임의 생성하거나 허용 목록에 다시 넣지 않는다.

## private key 형식

서버 `importPrivateKey()`는 실제 줄바꿈 PEM과 `\n` 이스케이프 PEM을 처리한다.

형식 예시:

```text
-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

실제 키 값은 절대 문서에 기록하지 않는다.

## 서버 결제 검증 구조

`functions/api/billing/_shared.js`의 Google Play 검증은:

1. package `kr.pagero.calltag` 확인
2. productId `call_monthly` / `message_monthly` 확인
3. `purchases.subscriptionsv2.get` 조회
4. line item productId 일치 확인
5. 상태/expiry 검증
6. 다른 활성 결제 채널 충돌 차단
7. purchaseToken SHA-256 hash 저장
8. verified subscription upsert
9. 필요 시 서버 acknowledge
10. entitlement 반환

Cloudflare Pages에서 Google API 호출과 충돌했던 불필요한 fetch 옵션은 제거된 상태다.

## 다음 작업

신규 결제는 성공했다. 다음 서버 우선순위는 RTDN/Pub/Sub이다.

- renewal
- cancel
- expiry
- grace period
- account hold
- resume
- refund / voided purchase
- reconciliation

RTDN 알림을 받은 뒤 Android Publisher API를 다시 조회해서 최종 entitlement를 갱신한다.

## 절대 금지

- service account JSON 커밋 금지
- private key 로그/문서/PR/이슈 노출 금지
- purchaseToken 원문 장기 저장 금지
- Android 앱에서 Publisher API 직접 호출 금지
- 앱과 서버에서 acknowledge 중복 구현 금지
- 신규 구매 성공을 RTDN lifecycle 완료로 기록 금지
