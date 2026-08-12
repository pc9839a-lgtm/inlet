# CallTag Google Play Billing 서버 환경변수 — 2026-08-12

CallTag Android 결제 검증 서버는 `functions/api/billing/_readiness.js`와 `functions/api/billing/_shared.js` 기준으로 아래 환경변수를 사용한다.

## 운영 변수

```text
GOOGLE_PLAY_BILLING_ENABLED=0
GOOGLE_PLAY_PRODUCTS_READY=0
GOOGLE_PLAY_CLIENT_EMAIL=
GOOGLE_PLAY_PRIVATE_KEY=
```

## 적용 순서

1. Google Cloud 프로젝트에서 `Google Play Android Developer API` 활성화
2. 서버용 service account 생성
3. Play Console `사용자 및 권한`에서 service account 이메일 초대
4. CallTag 앱 범위로 결제 API에 필요한 최소 권한 부여
   - 재무 데이터, 주문 및 취소 설문 응답 보기
   - 주문 및 정기 결제 관리
5. service account JSON의 `client_email`을 `GOOGLE_PLAY_CLIENT_EMAIL`로 등록
6. service account JSON의 `private_key`를 `GOOGLE_PLAY_PRIVATE_KEY`로 등록
7. Play Console의 `all_monthly`, `call_monthly`, `message_monthly`와 base plan이 모두 준비되기 전에는 `GOOGLE_PLAY_PRODUCTS_READY=0` 유지
8. service account/API 검증이 준비되기 전에는 `GOOGLE_PLAY_BILLING_ENABLED=0` 유지
9. 상품 준비 완료 후 `GOOGLE_PLAY_PRODUCTS_READY=1`
10. 실제 검증 준비까지 완료 후 `GOOGLE_PLAY_BILLING_ENABLED=1`

## 비공개 키 형식

현재 서버의 `importPrivateKey()`는 실제 줄바꿈 PEM과 `\n` 이스케이프 PEM을 모두 처리한다.

예시 형식만 아래와 같으며 실제 키를 문서나 저장소에 넣지 않는다.

```text
-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

## 절대 금지

- service account JSON 원본 커밋 금지
- private key 커밋/이슈/PR/로그 기록 금지
- production secret 값을 `.env.example`에 실제 값으로 넣지 않음
- readiness 플래그를 credential/product 준비보다 먼저 활성화하지 않음
- 앱에서 Android Publisher API 직접 호출 금지
- 앱에서 acknowledge 중복 구현 금지

## 실제 준비 완료 판정

환경변수 문자열이 존재하는 것만으로 Google Play 권한 검증이 완료된 것은 아니다.

최종 확인은 라이선스 테스터 결제에서 받은 purchaseToken으로 `/api/billing/google/verify`가 Google Android Publisher API 조회와 서버 acknowledgement를 성공한 뒤 entitlement `active`를 반환하는지로 판정한다.
