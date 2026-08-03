# 페이지로 → 콜태그 실시간 문의 푸시

## 목적

페이지로 랜딩페이지의 `/api/leads` 문의 저장이 성공하면 콜태그 Android 앱에 개인정보 없는 신호를 즉시 전달한다. 앱은 콜태그 로그인 세션으로 문의 큐를 다시 조회한 뒤 고객 DB에 반영한다.

## 서버 처리 순서

1. `/api/leads` 원본 처리가 문의를 저장한다.
2. API middleware가 성공 응답의 lead를 콜태그 큐에 등록한다.
3. queue `eventId`의 UNIQUE 규칙으로 동일 문의 중복 큐 등록을 막는다.
4. 저장된 lead 또는 제출 project의 ownerId를 우선 확인한다.
5. ownerId가 없으면 projects 테이블에서 프로젝트 소유자를 찾는다.
6. ownerId에 등록된 활성 Android 기기를 조회한다.
7. Firebase Cloud Messaging HTTP v1으로 `pagero_lead_available` 데이터 메시지를 보낸다.
8. 푸시 전송은 `context.waitUntil`로 문의 응답과 분리한다.
9. 푸시 실패가 문의 저장이나 콜태그 큐 등록을 실패시키지 않는다.

## ownerId 호환

프로젝트 저장 구조 변경에 대응하기 위해 다음 필드를 순서대로 확인한다.

- saved lead `ownerId`
- saved lead `ownerAccountId`
- submitted project `ownerId`
- submitted project `ownerAccountId`
- projects row `owner_account_id`
- projects row `owner_id`
- projects row `ownerId`
- projects row `account_id`
- projects row `accountId`

## FCM 데이터 메시지

payload:

```json
{
  "type": "pagero_lead_available",
  "eventId": "비식별 문의 이벤트 ID",
  "queueId": "콜태그 큐 ID",
  "sentAt": "epoch milliseconds"
}
```

포함 금지:

- 고객명
- 전화번호
- 이메일
- 문의 내용
- 고객 메모

Android 설정:

- priority `HIGH`
- ttl `300s`
- collapse key `pagero_lead_available`
- package `kr.pagero.calltag`

빠른 시간에 문의가 여러 건 들어와 FCM 신호가 합쳐져도 앱은 큐의 모든 미처리 문의를 조회하므로 문의 데이터는 합쳐지거나 소실되지 않는다.

## 기기 등록

D1 `calltag_push_devices`는 ownerId와 deviceId 조합을 유일하게 유지한다.

- 같은 토큰이 다른 계정·기기에 등록되면 과거 연결 삭제
- 앱 재로그인·토큰 변경 시 upsert
- 로그아웃 시 enabled 0
- FCM `UNREGISTERED`, `INVALID_ARGUMENT`, `NOT_FOUND`는 자동 비활성화
- 성공 시 `last_success_at` 갱신
- 실패 시 `last_error` 기록

## 운영 환경 변수

Cloudflare Pages 운영 환경에 다음 값을 등록해야 한다.

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

개인키는 실제 줄바꿈 또는 `\n` 형식을 모두 허용한다.

## D1

migration:

- `migrations/0007_calltag_google_push.sql`

필수 테이블:

- `calltag_push_devices`
- Google 로그인을 함께 배포하는 경우 `call_google_login_tickets`

## Android 연계

Android v0.40.9 이상 동작:

1. FCM 신호 수신
2. `PageroLeadSyncManager.requestRealtimeSync`
3. 문의 목록 조회
4. 고객 생성·갱신
5. 상담이력 저장
6. ACK
7. 실제 처리 건수가 있을 때만 사용자 알림

## 배포 전 검증

- migration QA
- Pages Functions syntax/build QA
- Firebase 서비스 계정 OAuth access token 발급
- 테스트 기기 등록 API 성공
- 실제 문의 제출 후 push `sent > 0`
- 앱 종료·백그라운드·잠금화면에서 수신
- 문의 고객과 상담이력 생성
- 동일 eventId 재전송 시 중복 생성 없음
- 잘못된 토큰 자동 비활성화
- Firebase 장애 시 문의 API는 정상 성공

## 현재 상태

- 구현 브랜치: `agent/calltag-google-realtime-auth`
- Draft PR: `#48`
- 운영 Secret·migration·QA 확인 전 main 병합 금지
