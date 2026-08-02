# 콜태그 Android 앱 — 페이지로 연동 구현 명세

문서 상태: 앱 개발자 전달용 1차 확정안  
작성 기준: 2026-08-02  
대상 제품: 페이지로 랜딩페이지 + 콜태그 Android 앱  
목표: 페이지로에서 접수된 문의가 콜태그 앱에 자동 등록되고, 알림·전화·문자·상담상태·재연락까지 한 흐름으로 처리되게 한다.

---

## 1. 제품 역할 분리

### 페이지로 웹

- 사용자가 모바일 랜딩페이지를 제작하고 공개한다.
- 방문자가 상담·예약·문의 폼을 제출한다.
- 서버가 문의 원본, 페이지, 유입경로, 동의정보와 처리상태를 저장한다.
- 문의·통계·연동의 서버 원본은 웹 백엔드/D1이다.

### 콜태그 Android 앱

- 페이지로 문의를 실시간으로 받는 현장 업무 앱이다.
- 새 문의 알림, 고객카드, 전화, 문자, 태그, 상담상태, 메모, 재연락 일정을 담당한다.
- 앱 로컬 DB는 오프라인 캐시이며 최종 원본은 서버다.
- 서버에서 변경된 고객정보와 앱에서 변경한 상담정보가 양방향 동기화되어야 한다.

### 절대 원칙

- 페이지로 문의와 사용자가 직접 추가한 고객을 화면에서 구분한다.
- 직접 추가 고객에게 `페이지로` 출처를 붙이지 않는다.
- 앱에서 수정한 상담상태가 폼 원본값을 덮어쓰면 안 된다.
- 중복 문의는 삭제하지 않고 기존 고객카드의 접수이력으로 합친다.
- API 재시도 때문에 고객·문자·일정이 중복 생성되면 안 된다.

---

## 2. 핵심 사용자 흐름

```text
방문자 페이지로 폼 제출
→ 서버 lead 생성
→ 콜태그 대상 계정·기기 확인
→ FCM 푸시 발송
→ 앱 알림 탭
→ 해당 고객카드 바로 열기
→ 전화 또는 문자
→ 통화 후 정리 화면
→ 태그·상담상태·메모·다음 할 일 저장
→ 필요 시 문자 발송
→ 재연락 일정 생성
→ 서버와 동기화
→ 웹 통계·고객목록에도 즉시 반영
```

### 성공 기준

- 정상 네트워크에서 폼 제출 후 앱 알림 도착 목표: 10초 이내.
- 알림을 누르면 고객목록이 아니라 해당 고객카드가 열린다.
- 고객카드에는 어떤 페이지에서 어떤 내용으로 문의했는지 즉시 보인다.
- 한 번의 저장으로 상태·태그·메모·재연락 일정이 함께 반영된다.

---

## 3. 앱 화면 구성

## 3.1 홈

표시 항목:

- 오늘 새 문의 수
- 미확인 문의 수
- 오늘 재연락 예정
- 지연된 할 일
- 최근 고객 5명
- 페이지별 오늘 문의 수
- 빠른 실행: 고객 추가, 문자 보내기, 오늘 할 일, 페이지로 열기

규칙:

- 사용자가 직접 등록한 할 일에는 페이지로 라벨을 표시하지 않는다.
- 같은 고객이 여러 페이지에서 문의한 경우 최신 출처와 전체 접수이력을 함께 보여준다.
- `전화하기`, `페이지 열기`, `문자 보내기` 버튼이 서로 겹치지 않아야 한다.

## 3.2 문의함 / 고객목록

필수 필터:

- 전체
- 새 문의
- 미확인
- 오늘 접수
- 재연락 필요
- 예약
- 완료
- 제외/스팸
- 페이지로 유입
- 직접 등록
- 페이지별
- 태그별
- 담당자별

필수 검색:

- 이름
- 전화번호
- 이메일
- 메모
- 페이지명
- 태그

목록 한 행:

- 고객명 또는 전화번호
- 상담상태
- 출처 배지
- 페이지명
- 접수시각
- 마지막 연락시각
- 다음 할 일
- 담당자
- 미확인 표시

## 3.3 고객카드

### 상단 고정 정보

- 고객명
- 전화번호
- 전화하기
- 문자 보내기
- 상담상태
- 담당자
- 중요 표시

### 페이지로 접수정보

- `sourceType`: `pagero` 또는 `manual`
- 페이지명
- 페이지 주소
- 페이지 ID
- 캠페인/UTM
- 최초 접수시각
- 최근 접수시각
- 접수 횟수
- 개인정보 동의시각과 동의문 버전
- 방문자가 입력한 전체 폼 답변

폼 답변은 읽기 전용 원본 영역으로 유지한다. 앱 메모와 섞지 않는다.

### 상담 관리 정보

- 상담상태
- 고객 구분색상
- 복수 태그
- 상담 메모
- 다음 할 일
- 재연락 날짜·시간
- 완료 여부
- 문자 제외
- 자동문자 제외
- 중복발송 보호 상태

### 이력 타임라인

- 문의 접수
- 문의 재접수
- 전화 시도
- 통화 정리 저장
- 문자 작성/발송/실패
- 상태 변경
- 태그 변경
- 메모 변경
- 담당자 변경
- 일정 생성/변경/완료

## 3.4 통화 후 큰 정리 화면

### Play 안전 기본 동작

1. 앱에서 `전화하기`를 누르면 `ACTION_DIAL`로 전화 앱을 연다.
2. 앱은 해당 고객을 `pendingCallCustomerId`로 기록한다.
3. 사용자가 콜태그로 돌아오면 큰 전체폭 정리 화면을 표시한다.
4. 사용자가 저장하거나 닫기 전까지 작은 토스트로 대체하지 않는다.

기본 화면 필드:

- 통화결과: 연결, 부재, 거절, 통화중, 잘못된 번호, 기타
- 상담상태
- 태그
- 메모
- 다음 할 일
- 재연락 날짜·시간
- 통화완료 문자 보내기
- 완료 처리
- 미루기

주의:

- 기본 Play 배포본은 정확한 통화 종료 감지를 전제로 구현하지 않는다.
- 앱 복귀 시 정리 화면을 띄우는 방식이 P0이다.
- 실제 통화 종료 자동 감지·통화기록 읽기는 별도의 기본 전화 앱 역할 또는 Google Play 승인 범위가 필요한 P2 기능이다.

## 3.5 문자 작성

첫 진입을 두 탭으로 분리한다.

1. `템플릿으로 시작`
2. `자유롭게 쓰기`

필수 기능:

- 템플릿 검색
- 템플릿 즐겨찾기
- 변수 치환: 고객명, 페이지명, 예약일, 담당자명, 회사명
- 발송 전 미리보기는 버튼을 눌렀을 때만 표시
- 이미지 첨부는 Android Photo Picker 사용
- 최근 발송이력
- 문자 제외 고객 경고
- 같은 고객·같은 내용 중복발송 경고
- 발송 예약
- 단체문자 대상 수와 제외 수 표시

### 문자 전송 방식

#### P0 — Play 안전 방식

- SMS Intent로 기본 문자 앱을 연다.
- 수신번호와 본문을 미리 채운다.
- 최종 전송은 사용자가 확인한다.
- `SEND_SMS`, `READ_SMS`, `WRITE_SMS`를 Manifest에 넣지 않는다.

#### P1 — 서버 문자 제공자 방식

- 서버 SMS API를 통해 발송한다.
- 발송번호, 비용, 실패·재시도·수신거부를 서버에서 관리한다.
- 앱은 발송 요청과 상태 조회만 담당한다.

#### P2 — 기본 SMS 앱 방식

- 콜태그가 기본 SMS 앱이 되는 별도 제품 범위다.
- Google Play 민감 권한 심사, 수신함, 스레드, MMS, 백업, 스팸 처리까지 필요하다.
- 현재 MVP 범위에 포함하지 않는다.

완전 자동으로 사용자의 SIM에서 문자를 보내는 기능을 일반 CRM 앱 권한으로 구현하면 안 된다.

## 3.6 단체문자 / 그룹

- 수동 그룹 생성
- 페이지별 자동 그룹
- 태그별 자동 그룹
- 상담상태별 자동 그룹
- 전체 선택
- 검색 후 선택
- 선택 해제
- 문자 제외 고객 자동 제외
- 중복 전화번호 통합
- 예상 발송 건수
- 서버 문자 방식일 때 예상 비용
- 테스트 발송

## 3.7 통계

기간 선택:

- 오늘
- 최근 7일
- 최근 30일
- 직접 선택

통계 항목:

- 전체 문의
- 페이지로 문의
- 직접 등록 고객
- 페이지별 문의
- 유입 캠페인별 문의
- 상담상태별 고객
- 전화 시도
- 문자 발송·성공·실패
- 예약 전환
- 완료 전환
- 평균 첫 응답시간
- 미응답 고객

날짜 직접 선택에는 서버가 허용하는 최대 기간을 적용하고 초과 시 명확한 경고를 표시한다.

## 3.8 설정

- 페이지로 연결 상태
- 연결된 계정
- 연결된 페이지 목록
- 새 문의 알림
- 알림음/진동
- 업무시간
- 자동문자 규칙
- 중복발송 방지시간
- 기본 상담상태
- 기본 재연락 시간
- 캘린더 연결
- 기기 등록 해제
- 동기화 상태
- 마지막 전체 동기화
- 오프라인 대기 건수
- 로그 내보내기

---

## 4. 권장 데이터 모델

## 4.1 Customer

```json
{
  "customerId": "cus_...",
  "accountId": "acc_...",
  "displayName": "홍길동",
  "normalizedPhone": "+821012345678",
  "phoneDisplay": "010-1234-5678",
  "email": "customer@example.com",
  "sourceType": "pagero",
  "status": "new",
  "tags": ["분양문의", "빠른연락"],
  "color": "#F59E0B",
  "assigneeId": null,
  "important": false,
  "smsExcluded": false,
  "autoSmsExcluded": false,
  "nextActionAt": null,
  "createdAt": "2026-08-02T03:00:00Z",
  "updatedAt": "2026-08-02T03:00:00Z",
  "version": 1
}
```

## 4.2 LeadSubmission

```json
{
  "leadId": "lead_...",
  "customerId": "cus_...",
  "projectId": "project_...",
  "pageId": "page_...",
  "pageSlug": "sample-page",
  "pageTitle": "정읍 아파트 분양 상담",
  "sourceUrl": "https://pagero.kr/sample-page",
  "utm": {
    "source": "naver",
    "medium": "cpc",
    "campaign": "august"
  },
  "answers": [
    { "fieldId": "name", "label": "이름", "value": "홍길동" },
    { "fieldId": "moveIn", "label": "입주 희망시기", "value": "3개월 이내" }
  ],
  "consent": {
    "accepted": true,
    "acceptedAt": "2026-08-02T03:00:00Z",
    "policyVersion": "2026-08-01"
  },
  "createdAt": "2026-08-02T03:00:00Z"
}
```

## 4.3 CustomerActivity

```json
{
  "activityId": "act_...",
  "customerId": "cus_...",
  "type": "call_summary",
  "actorId": "acc_...",
  "idempotencyKey": "android-device-uuid-action-uuid",
  "payload": {
    "result": "connected",
    "note": "상담 후 내일 재연락 요청",
    "nextActionAt": "2026-08-03T01:00:00Z"
  },
  "createdAt": "2026-08-02T03:10:00Z"
}
```

## 4.4 DeviceRegistration

```json
{
  "deviceId": "stable-installation-uuid",
  "platform": "android",
  "appVersion": "1.0.0",
  "fcmToken": "server-only-secret-value",
  "notificationEnabled": true,
  "timezone": "Asia/Seoul",
  "lastSeenAt": "2026-08-02T03:00:00Z"
}
```

FCM 토큰은 로그, 분석 이벤트, 화면에 출력하지 않는다.

---

## 5. 중복 고객 처리

기본 중복키:

```text
accountId + normalizedPhone
```

보조키:

```text
accountId + normalizedEmail
```

규칙:

1. 같은 계정에서 같은 전화번호가 다시 접수되면 새 고객을 만들지 않는다.
2. 새 `LeadSubmission`을 기존 고객카드에 추가한다.
3. 기존 상담 메모·상태·태그를 덮어쓰지 않는다.
4. 최신 접수 페이지와 접수시각만 갱신한다.
5. 전화번호가 없고 이메일만 있는 경우 이메일로 병합 후보를 찾는다.
6. 이름만 같은 고객은 자동 병합하지 않는다.
7. 사용자가 병합 취소·분리할 수 있도록 서버에 원본 lead는 유지한다.

---

## 6. 동기화 구조

## 6.1 서버 원본

서버가 원본인 데이터:

- 고객 ID
- 페이지로 폼 원본
- 접수이력
- 상담상태
- 태그
- 메모
- 담당자
- 문자 상태
- 일정
- 활동 이력

## 6.2 앱 로컬 저장

권장 기술:

- Room: 고객·문의·활동·템플릿 캐시
- WorkManager: 백그라운드 재시도와 증분 동기화
- Android Keystore 기반 암호화: 세션·refresh credential
- DataStore: UI 설정과 마지막 sync cursor

## 6.3 Outbox 패턴

앱 수정은 먼저 로컬 `pending_actions`에 저장한다.

```text
사용자 저장
→ Room transaction
→ 화면 즉시 반영
→ WorkManager 업로드
→ 서버 idempotency 확인
→ 성공 시 pending 제거
→ 충돌 시 서버 최신값과 병합 UI
```

필수 필드:

- actionId
- idempotencyKey
- entityType
- entityId
- baseVersion
- payload
- retryCount
- nextRetryAt
- lastErrorCode

## 6.4 충돌 정책

- 폼 원본: 서버 승리, 앱 수정 금지
- 메모 추가: append 방식
- 태그: union 후 명시적 삭제 이벤트 적용
- 상담상태: 더 최신 `updatedAt` 우선, 동일 시 서버 우선
- 다음 할 일: 버전 충돌 시 사용자 선택
- 담당자: 서버 권한 확인 후 저장

---

## 7. 푸시 알림

FCM data payload 예시:

```json
{
  "type": "lead.created",
  "leadId": "lead_...",
  "customerId": "cus_...",
  "projectId": "project_...",
  "pageTitle": "정읍 아파트 분양 상담",
  "occurredAt": "2026-08-02T03:00:00Z",
  "syncCursor": "cursor_..."
}
```

규칙:

- 알림 본문에 민감한 폼 답변 전체를 넣지 않는다.
- 알림 탭 시 `calltag://customers/{customerId}?leadId={leadId}`로 이동한다.
- 앱이 foreground면 인앱 배너와 목록 갱신을 함께 수행한다.
- FCM 누락 콜백 또는 장시간 미수신 후에는 전체 증분 sync를 실행한다.
- 기기 토큰 갱신 시 서버 등록값을 즉시 교체한다.
- 로그아웃·기기 해제 시 서버 토큰을 폐기한다.

알림 채널:

- 새 문의: 높음
- 재연락 알림: 높음
- 문자 실패: 기본
- 동기화 오류: 낮음

---

## 8. 권장 API 계약

아래 경로는 앱 개발 기준의 권장 계약이며, 서버 구현 여부를 확인한 후 기존 API와 통합한다.

## 8.1 인증

```text
POST /api/auth/login
POST /api/auth/session
POST /api/auth/logout
```

요구사항:

- access/session 만료 처리
- 계정 정지 시 즉시 401/403
- 서버에서 이메일 변경·비밀번호 변경 시 구세션 무효화
- 앱은 role 문자열만 보고 관리자 UI를 열지 않는다.

## 8.2 기기 등록

```text
POST   /api/mobile/devices
DELETE /api/mobile/devices/{deviceId}
POST   /api/mobile/devices/{deviceId}/token
```

## 8.3 증분 동기화

```text
GET /api/mobile/sync?cursor={cursor}&limit=200
```

응답:

```json
{
  "customers": [],
  "leads": [],
  "activities": [],
  "tasks": [],
  "templates": [],
  "deleted": [],
  "nextCursor": "cursor_...",
  "hasMore": false,
  "serverTime": "2026-08-02T03:00:00Z"
}
```

## 8.4 고객·문의

```text
GET   /api/leads?cursor=&status=&projectId=&q=
GET   /api/leads/{leadId}
PATCH /api/customers/{customerId}
POST  /api/customers
POST  /api/customers/{customerId}/activities
```

모든 쓰기 API:

- `Idempotency-Key` 필수
- `If-Match` 또는 `baseVersion` 지원
- 충돌은 `409`와 서버 최신값 반환
- 권한 없는 project/customer는 `403`

## 8.5 문자

```text
GET  /api/message-templates
POST /api/messages/preview
POST /api/messages/send
GET  /api/messages/{messageId}
POST /api/messages/{messageId}/retry
```

서버 문자 제공자 방식에서만 실제 발송 API를 사용한다.

## 8.6 통계

```text
GET /api/stats/summary?dateFrom=&dateTo=&projectId=&sourceType=
```

앱에서 전체 고객 데이터를 내려받아 통계를 계산하지 않는다.

---

## 9. 자동문자 규칙

지원 트리거:

- 새 페이지로 문의
- 통화 후 정리 저장
- 상담상태 변경
- 예약 확정
- 예약 하루 전
- 재연락 일정 도래

각 규칙 필드:

- ruleId
- enabled
- trigger
- templateId
- delaySeconds
- allowedBusinessHours
- pageIds
- customerStatuses
- excludedTags
- dedupeWindowMinutes
- deliveryMode: `server` 또는 `sms_intent`

안전장치:

- 기본값 OFF
- 템플릿 미리보기 필수
- 테스트 고객 발송
- 같은 고객·같은 템플릿 중복 방지
- 수신거부와 문자 제외가 항상 우선
- 영업시간 외 다음 허용시간으로 지연
- 실패 시 무한 재시도 금지
- 자동발송 이력과 실행 규칙 ID 저장

---

## 10. 캘린더 연동

### P0

Android Calendar INSERT Intent를 사용한다.

- 제목: `[콜태그] 고객명 재연락`
- 시작·종료시간
- 전화번호
- 페이지명
- 고객카드 딥링크
- 메모

장점:

- `WRITE_CALENDAR` 없이 Google Calendar, 삼성 캘린더 등 사용자가 선택한 캘린더 앱으로 전달 가능
- 사용자가 최종 내용을 확인하고 저장

### P1

콜태그 내부 일정과 시스템 캘린더를 별개로 유지하되 외부 event ID를 저장한다.

### P2

직접 읽기·수정·삭제가 반드시 필요한 경우에만 `READ_CALENDAR`/`WRITE_CALENDAR`를 인맥락으로 요청한다.

---

## 11. 연락처·이미지·전화 권한

## 연락처

- P0: 시스템 연락처 선택 Intent 사용
- 사용자가 선택한 연락처만 일시적으로 읽는다.
- 전체 연락처 검색·그룹 선택이 제품 핵심으로 확정될 때만 `READ_CONTACTS`를 인맥락 요청한다.
- 연락처 권한 거절 시 수동 전화번호 입력이 가능해야 한다.

## 이미지

- Android Photo Picker 사용
- 갤러리 전체 권한을 기본 요청하지 않는다.
- 선택한 이미지 URI만 업로드한다.
- MMS 직접 전송은 P0 범위가 아니다.

## 전화

- P0: `ACTION_DIAL`
- 사용자가 전화 앱에서 최종 발신
- `CALL_PHONE` 없이 동작
- 앱 복귀 시 통화 정리 화면

## SMS·통화기록 제한

Google Play 배포본의 초기 Manifest에는 아래 권한을 넣지 않는다.

```text
READ_SMS
SEND_SMS
WRITE_SMS
RECEIVE_SMS
READ_CALL_LOG
WRITE_CALL_LOG
PROCESS_OUTGOING_CALLS
```

기본 SMS/전화 앱 역할 또는 Google Play의 명시적 승인 없이 위 권한을 선언하면 안 된다.

---

## 12. 보안·개인정보

- 세션·refresh credential은 Android Keystore 기반으로 보호한다.
- FCM 토큰, Authorization, 비밀번호, 인증코드 원문을 로그에 남기지 않는다.
- 고객 전화·이메일은 crash report breadcrumb에 넣지 않는다.
- 네트워크 로그는 운영 빌드에서 body 기록을 끈다.
- 스크린샷 차단이 필요한 민감 화면 범위를 별도 검토한다.
- 로그아웃 시 로컬 PII 캐시를 삭제하거나 계정별 암호화키를 폐기한다.
- 앱 잠금: 생체인증 또는 PIN은 P1.
- 루팅 기기 차단은 필수가 아니지만 위험 경고를 고려한다.
- 앱 내 개인정보처리방침, 권한 사용 이유, 계정 삭제 경로를 제공한다.

---

## 13. 에러 처리

사용자 메시지와 개발 로그를 분리한다.

| 상황 | 사용자 표시 | 내부 처리 |
| --- | --- | --- |
| 네트워크 없음 | 오프라인 저장됨 | outbox 대기 |
| 세션 만료 | 다시 로그인 필요 | 토큰 폐기 |
| 계정 정지 | 계정 사용 중지 안내 | 로컬 쓰기 중단 |
| 버전 충돌 | 다른 기기에서 변경됨 | 병합 화면 |
| 중복 발송 | 최근 같은 문자 발송됨 | 발송 차단 |
| 서버 429 | 잠시 후 재시도 | Retry-After 준수 |
| 서버 5xx | 저장 대기 중 | 지수 백오프 |
| FCM 누락 | 표시 없음 | 다음 시작 시 전체 sync |
| 권한 거절 | 해당 기능 제한 안내 | 대체 Intent/수동입력 |

재시도 권장:

```text
15초 → 1분 → 5분 → 15분 → 1시간
```

영구 실패와 재시도 가능 실패를 구분한다.

---

## 14. 필수 분석 이벤트

PII 없이 아래 이벤트만 전송한다.

- app_login_succeeded
- app_login_failed
- lead_push_received
- lead_push_opened
- customer_card_opened
- call_dial_opened
- call_summary_saved
- sms_composer_opened
- sms_send_requested
- sms_send_succeeded
- sms_send_failed
- task_created
- task_completed
- calendar_intent_opened
- sync_started
- sync_succeeded
- sync_failed
- conflict_detected

이벤트에는 전화번호·이메일·메모·폼 답변을 넣지 않는다.

---

## 15. 구현 우선순위

## P0 — 앱 출시 필수

1. 로그인·세션 갱신·로그아웃
2. FCM 기기 등록과 딥링크
3. 페이지로 새 문의 문의함
4. 고객카드와 폼 원본 표시
5. 중복 고객 병합
6. 상담상태·태그·메모·다음 할 일
7. ACTION_DIAL 전화
8. 앱 복귀 통화 후 큰 정리 화면
9. 템플릿 문자 + SMS Intent
10. 내부 재연락 일정
11. Calendar INSERT Intent
12. Room 캐시·Outbox·WorkManager 재시도
13. 오늘/7일/30일/직접선택 통계
14. 권한 거절·오프라인·충돌 처리

## P1 — 운영 고도화

1. 서버 문자 제공자 연동
2. 단체문자와 그룹
3. 자동문자 규칙
4. 담당자 배정
5. 문자 실패·재시도
6. 앱 잠금
7. 시스템 캘린더 event ID 연계
8. 페이지별 알림 설정
9. 전체 연락처 검색 기능
10. 다중 기기 동기화 진단

## P2 — 별도 제품 심사 필요

1. 콜태그 기본 전화 앱 역할
2. 정확한 통화 종료 자동 감지
3. 통화기록 기반 자동 고객 매칭
4. 콜태그 기본 SMS 앱 역할
5. SIM 기반 완전 자동 문자
6. 수신 SMS 스레드 관리

P2는 기술 구현보다 Google Play 정책·권한 선언·스토어 설명·개인정보 고지가 먼저 승인되어야 한다.

---

## 16. 앱 개발 완료 기준

## 기능 테스트

- 페이지로 폼 제출 후 새 고객 또는 기존 고객 접수이력이 생성된다.
- FCM 알림을 누르면 정확한 고객카드가 열린다.
- 직접 추가 고객에 페이지로 출처가 표시되지 않는다.
- 같은 번호 재접수 시 고객이 중복 생성되지 않는다.
- 전화 후 앱 복귀 시 큰 정리 화면이 열린다.
- 상태·태그·메모·일정을 한 번에 저장할 수 있다.
- SMS Intent에 번호와 치환된 본문이 정확히 들어간다.
- 문자 제외 고객에게 발송 전 경고와 차단이 적용된다.
- Calendar Intent에 고객명·시간·딥링크가 들어간다.
- 오프라인 저장 후 네트워크 복구 시 한 번만 동기화된다.

## 보안 테스트

- 계정 정지 후 기존 세션으로 API 접근 불가
- 다른 계정의 고객 ID 직접 호출 시 403
- 로그에 Authorization, FCM token, 고객 전화번호 원문 없음
- 중복 idempotency 요청으로 활동·문자·일정이 두 번 생성되지 않음
- 로그아웃 후 고객 캐시 접근 불가

## 기기 테스트

최소 검수:

- Samsung Galaxy Android 최신 버전
- Samsung Internet과 시스템 전화·문자·캘린더 앱 연동
- Android 13+ 알림 권한 거절/허용
- 절전모드와 백그라운드 제한
- 네트워크 전환 Wi-Fi ↔ LTE/5G
- 360px, 390px, 430px 계열 화면폭
- 글자크기 100%, 130%, 150%
- 다크모드

---

## 17. 앱 개발자 첫 작업 순서

1. 이 문서 기준으로 화면 플로우와 데이터 모델을 확정한다.
2. 서버팀과 기존 `/api/leads`, 인증, 통계 API를 확인한다.
3. 부족한 mobile sync·device registration API를 서버 티켓으로 분리한다.
4. Room schema와 sync cursor/outbox부터 구현한다.
5. FCM 딥링크로 고객카드를 여는 vertical slice를 먼저 완성한다.
6. 고객카드 저장과 서버 idempotency를 연결한다.
7. ACTION_DIAL → 앱 복귀 → 통화 정리 저장 흐름을 완성한다.
8. SMS Intent와 Calendar Intent를 연결한다.
9. 권한 없이 가능한 P0를 먼저 Play 내부 테스트에 배포한다.
10. 단체문자·자동문자·통화기록은 P0 안정화 후 별도 착수한다.

---

## 18. 구현하지 말아야 할 것

- 앱에 웹 관리자 API 비밀키 내장
- role 문자열만 보고 관리자 권한 부여
- 페이지로 폼 원본을 앱 메모로 덮어쓰기
- 모든 연락처·사진·SMS·통화기록 권한을 첫 실행에 한꺼번에 요청
- 일반 Play 배포본에서 사용자 확인 없는 SIM 자동문자
- FCM payload에 폼 전체 답변 포함
- 네트워크 실패 시 같은 문자를 무제한 재전송
- 앱 로컬 데이터만 원본으로 사용
- 고객 삭제를 단순 로컬 삭제로 처리
- 통화 녹음 또는 통화내용 수집을 기본 기능으로 추가

---

## 19. 외부 플랫폼 구현 기준

앱 개발자는 구현 전 아래 공식 문서의 최신 정책을 다시 확인한다.

- Google Play SMS 및 Call Log 권한 정책
- Android default handler 권한 가이드
- Android Common Intents: ACTION_DIAL, SMS, 연락처 선택
- Android Calendar INSERT Intent
- Android Photo Picker
- Firebase Cloud Messaging Android 수신·토큰 갱신·삭제 메시지 처리

정책 변경으로 P2 권한이 승인되지 않더라도 P0 기능이 정상 작동하도록 설계한다.
