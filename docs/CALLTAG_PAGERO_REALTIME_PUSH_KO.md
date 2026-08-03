# 페이지로 → 콜태그 실시간 문의 푸시

## 목적

페이지로 랜딩페이지의 `/api/leads` 문의 저장이 성공하면 콜태그 Android 앱에 개인정보 없는 신호를 즉시 전달한다. 앱은 로그인 세션으로 문의 큐를 다시 조회하고 고객 DB에 반영한 뒤 사용자에게 알림을 표시한다.

## 처리 순서

1. `/api/leads`가 문의를 저장한다.
2. API middleware가 eventId 중복방지와 함께 콜태그 큐에 등록한다.
3. saved lead, submitted project 또는 projects 테이블에서 ownerId를 확인한다.
4. ownerId의 활성 Android 기기로 FCM HTTP v1 데이터 메시지를 보낸다.
5. 푸시 전송은 문의 응답과 분리해 문의 저장 성공을 방해하지 않는다.
6. 콜태그 v0.40.9가 미처리 문의를 조회해 고객·상담이력을 저장하고 ACK한다.
7. 실제 신규·갱신 건수가 있을 때만 앱 알림을 표시한다.

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

빠른 연속 문의의 푸시 신호가 하나로 합쳐져도 앱은 미처리 문의 큐 전체를 조회하므로 데이터가 소실되지 않는다.

## D1

migration:

- `migrations/0008_calltag_realtime_push.sql`

테이블:

- `calltag_push_devices`

주요 정책:

- ownerId + deviceId 유일
- FCM token 유일
- 앱 재로그인·토큰 변경 upsert
- 로그아웃 시 enabled 0
- 만료·잘못된 토큰 자동 비활성화
- 성공·실패 시각과 오류 기록

## 운영 환경 변수

Cloudflare Pages 운영 환경:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Android GitHub Actions Secret:

- `CALLTAG_FIREBASE_APPLICATION_ID`
- `CALLTAG_FIREBASE_API_KEY`
- `CALLTAG_FIREBASE_PROJECT_ID`
- `CALLTAG_FIREBASE_SENDER_ID`

## 검증

- JavaScript syntax
- CallTag bridge contract
- Pages Functions regression
- production build
- full offline QA
- form/editor/landing/template mobile browser regression
- 운영 D1 migration
- 운영 Firebase access token 발급
- 실제 문의 → 백그라운드 앱 알림
- 동일 eventId 중복 미생성
- FCM 장애 시 문의 접수 성공 유지

## 브랜치

- 구현: `agent/pagero-calltag-realtime-push`
- Google 로그인과 분리된 실시간 문의 푸시 전용 패치
