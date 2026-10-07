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

## 7. 환불·취소 추천수익 역처리

`voidedPurchaseNotification`이 정기결제(`productType=1`)에 대해 도착하면 해당 `orderId`의 CallTag 추천수익을 즉시 역처리한다.

- 아직 지급되지 않은 추천수익: 원 수익을 `cancelled` 처리하여 지급 대상에서 제외
- 이미 지급된 추천수익: 동일 주문번호 기준으로 음수 recovery 원장을 1회 생성
- recovery 원장은 생성 월이 지나도 정산될 때까지 다음 지급가능액에서 계속 차감
- 환불 발생 후 아직 처리되지 않은 CallTag 지급요청은 금액 스냅샷이 오래된 것으로 보고 자동 취소
- 처리 중 또는 검토 중이지만 실제 지급완료 전인 정산 건은 취소하여 재계산 가능하게 함
- 동일 `orderId`와 동일 RTDN 재전송은 중복 차감하지 않음

`pendingRefundReviewNotification`은 아직 최종 환불이 아니라 chargeback 검토 요청이므로 금액을 미리 차감하지 않는다. 최종 `voidedPurchaseNotification`이 도착했을 때만 금전 원장을 변경한다.

CallTag는 정기결제만 판매하므로 다중 수량 일회성 상품용 부분 환불 알림은 추천수익 원장을 변경하지 않는다.
