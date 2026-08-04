# 페이지로 → 콜태그 실시간 문의 푸시

기준일: **2026-08-04**

## 목적

페이지로 랜딩페이지의 `/api/leads` 문의 저장이 성공하면 콜태그 Android 앱에 개인정보 없는 신호를 전달한다. 앱은 로그인 세션으로 문의 큐를 조회하고 고객 DB에 반영한 뒤 사용자에게 알림을 표시한다.

## 운영 코드 반영

실시간 문의 푸시 전용 PR `#56`을 `main`에 병합했다.

- 병합 SHA: `2f016e152f4fb589fb948db6c5a92488591843f2`
- Google 로그인 변경과 분리된 서버 패치
- 기존 Google 로그인·푸시 통합 PR `#48`은 Draft 유지

## 운영 서버 준비 완료

2026-08-04 Cloudflare Production과 운영 D1 `inlet-prod`를 실측했다.

- 확인 배포: `https://89a7a596.inlet-8mr.pages.dev`
- readiness 확인 시각: `2026-08-04T02:26:12.061Z`
- Workflow Run ID: `30871387043`
- Job ID: `91875065527`

확인 결과:

- `FIREBASE_PROJECT_ID`: `true`
- `FIREBASE_CLIENT_EMAIL`: `true`
- `FIREBASE_PRIVATE_KEY`: `true`
- Firebase 전체 configured: `true`
- D1 바인딩: `true`
- `calltag_push_devices` 테이블: `true`
- 최종 `ready`: `true`

비공개 키 원문은 로그·문서·응답에 출력하지 않고 설정 유무만 확인했다.

## Firebase Console 등록

백그라운드·잠금화면 즉시 알림을 위해 Firebase 프로젝트와 콜태그 Android 앱 등록이 필요하다.

### Firebase 프로젝트

1. Firebase Console에서 운영 프로젝트를 생성하거나 선택한다.
2. Android 앱을 추가한다.
3. 패키지명은 정확히 `kr.pagero.calltag`로 등록한다.
4. 앱 등록 후 `google-services.json`을 다운로드한다.
5. 프로젝트 설정의 `클라우드 메시징`에서 Firebase Cloud Messaging API(V1) 사용 상태를 확인한다.

FCM만 사용하는 경우 Android 앱 등록 단계의 SHA-1은 생략 가능하다.

### Android 앱 설정값

`google-services.json`에서 다음 값을 CallTag GitHub Actions Secret으로 등록한다.

| CallTag GitHub Secret | `google-services.json` 값 |
|---|---|
| `CALLTAG_FIREBASE_APPLICATION_ID` | `client[].client_info.mobilesdk_app_id` |
| `CALLTAG_FIREBASE_API_KEY` | `client[].api_key[].current_key` |
| `CALLTAG_FIREBASE_PROJECT_ID` | `project_info.project_id` |
| `CALLTAG_FIREBASE_SENDER_ID` | `project_info.project_number` |

CallTag 저장소:

- `pc9839a-lgtm/calltag`
- `Settings > Secrets and variables > Actions`

Secret 등록 후 Firebase 값이 포함된 APK를 다시 빌드해야 한다.

## 서버 서비스 계정

Firebase Console에서 다음 순서로 서비스 계정 비공개 키 JSON을 발급한다.

1. 프로젝트 설정
2. `서비스 계정`
3. `Firebase Admin SDK`
4. `새 비공개 키 생성`

Cloudflare Pages Production 환경변수 대응:

| 환경변수 | 서비스 계정 JSON 값 |
|---|---|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` 전체 값 |

`FIREBASE_PRIVATE_KEY`는 시작·종료 구문과 줄바꿈을 포함한 전체 키를 사용한다.

절대 금지:

- 서비스 계정 JSON을 저장소에 커밋
- 비공개 키를 Android APK에 포함
- 문서·이슈·스크린샷에 전체 키 노출
- Preview에만 등록하고 Production 환경을 누락

## 운영 준비상태 확인

비밀값 원문은 외부에 노출하지 않고 설정 유무만 확인한다.

- `GET /api/call/push/readiness`
- 응답 헤더 `Cache-Control: no-store`

확인 항목:

- `firebase.projectId`
- `firebase.clientEmail`
- `firebase.privateKey`
- `firebase.configured`
- `d1.bound`
- `d1.pushDevicesTable`
- 전체 `ready`

`ready=true` 조건:

1. Firebase 운영 환경변수 3개가 모두 존재
2. D1 바인딩 존재
3. `calltag_push_devices` 테이블 존재

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

적용 완료 migration:

- `migrations/0008_calltag_realtime_push.sql`

생성 완료:

- `calltag_push_devices`
- `idx_calltag_push_owner_enabled`

기존 고객·문의·회원·랜딩 데이터는 변경하지 않는다.

## CI 검증

### Validate Pagero CallTag Bridge

- Run ID: `30822112193`
- Job ID: `91714345005`
- JavaScript syntax: 성공
- Bridge contract: 성공
- Pages Functions regression: 성공
- Production build: 성공

### 전체 QA

- Run ID: `30871387085`
- Full offline QA: 성공
- form browser regression: 성공
- editor browser regression: 성공
- landing browser regression: 성공
- template mobile browser regression: 성공

### 운영 readiness

- Run ID: `30871387043`
- Job ID: `91875065527`
- 결론: 성공
- 최종 `ready=true`

## 현재 남은 작업

서버는 FCM 발송 준비가 완료됐다. 남은 작업은 Android 앱 쪽이다.

1. CallTag GitHub Actions Secret 4개 등록
2. Firebase 값이 포함된 APK 재빌드
3. APK 내부 Firebase 값 확인
4. 기존 앱 위에 덮어 설치
5. 로그인 후 FCM 기기 토큰 서버 등록 확인
6. 실제 페이지로 문의 접수
7. 앱 종료·백그라운드·잠금화면 알림 확인
8. 알림 터치 후 신규 고객·메모·`PAGERO_INQUIRY` 확인
9. 동일 eventId 중복 미생성 확인
10. 빠른 연속 문의 3건 전부 반영 확인

## 데이터·장애 안전

- 푸시 전송은 문의 응답과 분리
- Firebase 장애가 문의 저장을 실패시키지 않음
- 고객 개인정보를 FCM payload에 포함하지 않음
- 잘못된 토큰을 자동 비활성화
- 실시간 신호 유실 시 앱 전면 보조 동기화로 문의 큐를 다시 확인

## 관련 문서

CallTag:

- `docs/FIREBASE_REGISTRATION_GUIDE_KO.md`
- `docs/V0409_PAGERO_REALTIME_ALERT_KO.md`
- `docs/DEVELOPMENT_STATUS_AND_ROADMAP_KO.md`
