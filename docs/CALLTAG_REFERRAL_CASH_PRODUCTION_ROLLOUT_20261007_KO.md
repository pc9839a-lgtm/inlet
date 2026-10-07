# CallTag 20% 추천수익 프로덕션 롤아웃

기준일: 2026-10-07

## 목표

CallTag 추천코드로 가입한 회원이 CallTag 유료결제를 유지하는 동안, **Google/웹에서 검증된 실제 결제액의 20%**를 직접 추천인 1명에게 반복 적립한다.

- 다단계/하위 추천 수익 없음
- 추천받은 회원: 기본 7일 + 추천 +5일
- 추천인: CallTag 유료결제 순결제 기준 20%
- PageRo 추천/수익 원장과 CallTag 원장 분리
- 중복 결제/RTDN 중복 수신은 payment reference로 idempotent 처리
- 환불/부분환불/차지백은 미정산 수익 조정 또는 이미 정산된 수익의 차기 지급 차감으로 처리
- CallTag 미정산 수익은 월이 바뀌어도 소멸하지 않고 이월

## 서버 원장

CallTag 전용:
- `calltag_referrals`
- `calltag_referral_identity_claims`
- `calltag_partner_commissions`
- `calltag_partner_settlement_items`

PageRo 기존:
- `referrals`
- `partner_commissions`
- `partner_settlement_items`

두 서비스의 지급 요청/지급 헤더는 기존 `partner_payout_requests`, `partner_settlements`를 공유하되 각 item 원장은 분리한다.

## Google Play 결제 검증

정기결제 조회:
- `purchases.subscriptionsv2`
- 최신 성공 주문: `lineItems.latestSuccessfulOrderId`

실제 결제금액:
- `orders.get`
- `order.total`의 KRW 금액
- 부분환불 시 성공한 `orderHistory.partialRefundEvents[].refundDetails.total` 차감
- 전액 환불/취소 시 순결제액 0원

추천수익은 카탈로그 가격을 임의 기준으로 사용하지 않는다.

## 환불/정산 잠금

정산 전:
- 환불대기 → commission을 estimated 상태로 보류
- 부분환불 → 순결제액 기준으로 기존 commission 금액 수정
- 전액환불 → cancelled

이미 processing/review/paid 정산에 들어간 뒤:
- 과거 지급 row는 수정하지 않는다.
- 동일 주문에 음수 adjustment row를 생성한다.
- 음수 adjustment는 다음 CallTag 지급 가능금액에서 자동 상계된다.

## 이월

CallTag 지급 가능 금액은 **현재 월 한정이 아니라 모든 미정산 confirmed 수익의 합계**다.

PageRo 월 정산 정책은 이번 패치에서 변경하지 않는다.

## D1

배포 전에 반드시 실행:

`npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc`

대상 migration:
- `0017_calltag_referral_cash_isolation.sql`

배포 workflow가 이 단계를 실패 시 중단하도록 구성한다.

## RTDN

백엔드:
- `POST /api/billing/google/rtdn?token=<GOOGLE_PLAY_RTDN_SECRET>`

필수 GitHub repository secret:
- `GOOGLE_PLAY_RTDN_SECRET`

동일 값이 Cloudflare Pages secret으로 설치된다.

Google Cloud:
1. Pub/Sub topic 생성
2. `google-play-developer-notifications@system.gserviceaccount.com`에 Pub/Sub Publisher 부여
3. push subscription 생성
4. push endpoint를 위 RTDN 주소로 설정
5. Play Console > 수익 창출 > 수익 창출 설정 > 실시간 개발자 알림에서 topic 지정
6. **정기 결제 및 모든 무효화된 구매 알림** 선택
7. Play Console 테스트 메시지 전송
8. push endpoint HTTP 200 확인

RTDN 구성과 테스트가 끝나기 전에는 0.44.61을 production-ready로 처리하지 않는다.

## 출시 게이트

- Billing Referral QA PASS
- CallTag Partner Settlement QA PASS
- CallTag Admin Security QA PASS
- 전체 QA PASS
- D1 0017 remote 적용 PASS
- Cloudflare `GOOGLE_PLAY_RTDN_SECRET` binding 확인
- Play Console RTDN 테스트 메시지 200
- 신규 추천가입 E2E
- 최초 Play 결제 E2E: 실제 주문액 × 20%
- 같은 주문 중복 재검증: 추가 적립 0
- Play 갱신 RTDN: 새 order ID로 신규 적립 1건
- 부분환불: 순결제액으로 조정
- 전액환불/void: 지급 전 취소
- 지급 완료 후 환불: 다음 지급에 음수 조정 이월
- PageRo 추천/정산 값 영향 없음

## Android

후속 앱:
- 0.44.61
- versionCode 2026100701
- `더보기 > 친구 추천 수익`
- 추천코드/추천가입/유료전환/이번 달 수익/누적 확정 노출
- 정산센터는 `service=CALLTAG` 컨텍스트로 진입

0.44.60 심사와 분리하며, 이 문서의 프로덕션 게이트 통과 전 0.44.61 Play 제출 금지.
