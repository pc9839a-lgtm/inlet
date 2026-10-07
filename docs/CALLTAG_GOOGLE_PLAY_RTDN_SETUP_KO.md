# CallTag Google Play RTDN 연결 체크리스트

작성일: 2026-10-07

이 문서는 CallTag의 Google Play 구독 갱신을 앱 실행 여부와 관계없이 서버가 수신하도록 연결하기 위한 운영 체크리스트다.

## 1. 서버 엔드포인트

Push URL:

```
https://pagero.kr/api/billing/google/rtdn?token=<GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN>
```

서버는 다음을 수행한다.

- Pub/Sub Push verification token 검증
- 선택적으로 Pub/Sub OIDC `aud` / service account 검증
- Pub/Sub message.data base64 디코딩
- packageName이 `kr.pagero.calltag`인지 검증
- purchaseToken 원문을 저장하지 않고 SHA-256 hash로 기존 Google Play 구독 소유자를 찾음
- RTDN 수신 후 Google Play Developer API `subscriptionsv2.get`을 다시 호출해 실제 상태를 재검증
- 갱신 또는 신규 구매 이벤트에서 최신 주문번호를 사용해 Orders API 실제 KRW 결제금액을 조회
- CallTag 추천관계가 있으면 실제 결제금액의 20%를 기존 idempotent commission ledger에 기록
- 동일 Pub/Sub messageId와 동일 Play orderId 재처리를 중복 적립하지 않음
- 환불/무효화 알림은 별도 Step 5에서 역처리할 수 있도록 event inbox에 보존

## 2. Cloudflare 환경변수

필수 Secret:

```
GOOGLE_PLAY_RTDN_VERIFICATION_TOKEN=<충분히 긴 랜덤 비밀값>
```

권장 OIDC 검증 설정:

```
GOOGLE_PLAY_RTDN_AUDIENCE=https://pagero.kr/api/billing/google/rtdn
GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT=<Pub/Sub Push 인증에 지정한 서비스계정 이메일>
```

기존 Google Play Developer API 설정도 그대로 필요하다.

```
GOOGLE_PLAY_CLIENT_EMAIL
GOOGLE_PLAY_PRIVATE_KEY
```

주의: verification token이나 purchaseToken 원문을 GitHub 저장소, 로그, D1에 저장하지 않는다.

## 3. Google Cloud Pub/Sub

1. Google Cloud 프로젝트에서 Pub/Sub API를 활성화한다.
2. 전용 Topic을 만든다. 예: `calltag-google-play-rtdn`.
3. Topic 권한에 아래 Google Play 서비스 계정을 추가하고 `Pub/Sub Publisher` 역할을 부여한다.

```
google-play-developer-notifications@system.gserviceaccount.com
```

4. Topic에 Push Subscription을 만든다.
5. Push endpoint는 위 CallTag RTDN URL을 사용한다.
6. 가능하면 Push authentication을 활성화하고 전용 서비스 계정을 지정한다.
7. OIDC audience는 서버의 `GOOGLE_PLAY_RTDN_AUDIENCE`와 정확히 같게 설정한다.

## 4. Google Play Console

Play Console에서 CallTag 앱을 연 뒤:

```
수익 창출 > 수익 창출 설정 > 실시간 개발자 알림
```

- 실시간 알림 사용
- Topic name: `projects/{project_id}/topics/{topic_name}`
- 정기 결제 및 무효화된 구매 알림을 수신하는 옵션 사용
- 저장 후 `테스트 메시지 보내기` 실행

테스트 메시지가 서버에서 2xx/204로 처리되어야 한다.

## 5. 갱신 처리 기준

현재 Step 4에서 현금 커미션 생성 대상으로 처리하는 RTDN은 다음과 같다.

- `2 SUBSCRIPTION_RENEWED`
- `4 SUBSCRIPTION_PURCHASED`

그 외 구독 상태 변경은 Google Play Developer API를 다시 조회해 서버의 구독 상태를 동기화하되 추가 커미션은 만들지 않는다.

알림만 신뢰하지 않고 항상 Google Play Developer API를 다시 조회한다.

## 6. 재시도 정책

아래 상황에서는 503을 반환해 Pub/Sub 재전송을 유도한다.

- purchaseToken hash가 아직 CallTag 계정의 Google Play 구독과 연결되지 않은 경우
- Google Play 구독 검증이 일시 실패한 경우
- 갱신 주문의 실제 결제금액을 아직 확인할 수 없는 경우

정상 처리 또는 이미 처리된 messageId는 204로 ACK한다.

## 7. Step 5 경계

이번 단계에서는 환불 금액을 커미션에서 차감하지 않는다.

다만 아래 이벤트는 버리지 않고 `google_play_rtdn_events`에 저장한다.

- `voidedPurchaseNotification`
- `pendingRefundReviewNotification`

Step 5에서 이 보존 데이터를 기준으로 환불/취소/chargeback 커미션 역처리를 구현한다.
