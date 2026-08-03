# 페이지로 → 콜태그 실시간 문의 푸시

## 목적

페이지로 랜딩페이지의 `/api/leads` 문의 저장이 성공하면 콜태그 Android 앱에 개인정보 없는 신호를 전달한다. 앱은 로그인 세션으로 문의 큐를 조회하고 고객 DB에 반영한 뒤 사용자에게 알림을 표시한다.

## 운영 코드 반영

실시간 문의 푸시 전용 PR `#56`을 `main`에 병합했다.

- 병합 SHA: `2f016e152f4fb589fb948db6c5a92488591843f2`
- Google 로그인 변경과 분리된 서버 패치
- 기존 Google 로그인·푸시 통합 PR `#48`은 Draft 유지

`main` 병합은 코드 반영을 의미한다. Cloudflare Pages 운영 배포 완료, Firebase 환경 변수 등록, D1 migration 적용은 별도로 확인해야 한다.

## 처리 순서

1. `/api/leads`가 문의를 저장한다.
2. API middleware가 `eventId` 중복방지와 함께 콜태그 큐에 등록한다.
3. saved lead, submitted project 또는 projects 테이블에서 ownerId를 확인한다.
4. ownerId의 활성 Android 기기로 FCM HTTP v1 데이터 메시지를 보낸다.
5. 푸시 전송은 문의 응답과 분리해 문의 저장 성공을 방해하지 않는다.
6. 콜태그 v0.40.9가 미처리 문의를 조회해 고객·상담이력을 저장하고 ACK한다.
7. 실제 신규·갱신 건수가 있을 때만 앱 알림을 표시한다.

## 프로젝트 소유자 확인

다음 필드를 호환 순서로 확인한다.

- saved lead `ownerId`
- saved lead `ownerAccountId`
- submitted project `ownerId`
- submitted project `ownerAccountId`
- projects row `owner_account_id`
- projects row `owner_id`
- projects row `ownerId`
- projects row `account_id`
- projects row `accountId`

소유자를 찾지 못해도 문의 저장과 콜태그 큐 등록은 실패시키지 않는다.

## FCM payload

포함:

- `type=pagero_lead_available`
- 비식별 eventId
- queueId
- sentAt

포함 금지:

- 고객명
- 전화번호
- 이메일
- 문의 내용
- 고객 메모

전송 설정:

- HIGH priority
- TTL 300초
- collapse key `pagero_lead_available`
- package `kr.pagero.calltag`

빠른 연속 문의의 푸시 신호가 하나로 합쳐져도 앱은 미처리 문의 큐 전체를 조회하므로 문의 데이터는 소실되지 않는다.

## 기기 API

- `POST /api/call/push/register`
- `GET /api/call/push/status`
- `POST /api/call/push/unregister`

정책:

- CallTag 로그인 세션의 ownerId로 기기 격리
- ownerId + deviceId 유일
- FCM token 유일
- 재로그인·토큰 변경 시 upsert
- 로그아웃 시 enabled 0
- `UNREGISTERED`, `INVALID_ARGUMENT`, `NOT_FOUND` 토큰 자동 비활성화
- 성공 시 `last_success_at` 갱신
- 실패 시 `last_error` 기록

## D1

migration:

- `migrations/0008_calltag_realtime_push.sql`

테이블:

- `calltag_push_devices`

API는 `CREATE TABLE IF NOT EXISTS` 방어 로직도 갖지만 운영 migration 적용 여부를 별도 확인한다.

## 운영 환경 변수

Cloudflare Pages 운영 환경:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

값이 없으면 문의 접수와 콜태그 큐 동기화는 기존대로 성공하고 백그라운드 즉시 푸시만 비활성화된다.

Android GitHub Actions Secret:

- `CALLTAG_FIREBASE_APPLICATION_ID`
- `CALLTAG_FIREBASE_API_KEY`
- `CALLTAG_FIREBASE_PROJECT_ID`
- `CALLTAG_FIREBASE_SENDER_ID`

CallTag v0.40.9 검증 APK에서는 위 Android Firebase 값이 빈 문자열로 확인됐다. Secret 등록 후 APK 재빌드가 필요하다.

## CI 검증

### Validate Pagero CallTag Bridge

- Run ID: `30822112193`
- Job ID: `91714345005`
- JavaScript syntax: 성공
- Bridge contract: 성공
- Pages Functions regression: 성공
- Production build: 성공

### 전체 QA

- Run ID: `30822112885`
- Full offline QA: 성공
- form browser regression: 성공
- editor browser regression: 성공
- landing browser regression: 성공
- template mobile browser regression: 성공

## 아직 필요한 운영 E2E

1. Cloudflare 환경 변수 3개 등록 확인
2. D1 migration 적용 확인
3. CallTag Firebase Secret 4개 등록 후 APK 재빌드
4. 운영 페이지로 문의 제출
5. 서버 로그에서 FCM attempted·sent 확인
6. 앱 종료·백그라운드·잠금화면 알림 확인
7. 알림 터치 후 신규 고객과 `PAGERO_INQUIRY` 확인
8. 동일 eventId 재전송 중복 미생성 확인
9. FCM 장애 시 문의 접수 성공 유지 확인

## 데이터·장애 안전

- 푸시 전송은 `context.waitUntil`로 문의 응답과 분리
- Firebase 미설정·장애가 문의 저장을 실패시키지 않음
- 고객 개인정보를 FCM payload에 포함하지 않음
- 잘못된 토큰을 자동 비활성화
- 실시간 신호 유실 시 앱 전면 보조 동기화로 문의 큐를 다시 확인
