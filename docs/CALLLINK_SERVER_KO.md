# 페이지로 콜링크 서버 운영 문서

페이지로 기존 회원·결제·페이지 저장 구조를 변경하지 않고 `functions/api/calllink/*`와 D1 전용 테이블로 분리한 서버 모듈입니다.

## 기능 범위

- 페이지로 사업장별 6자리 연결코드 발급
- 연결코드 10분 만료 및 1회 사용
- Android 기기 토큰 발급·해시 저장·폐기 가능한 구조
- 랜딩페이지 목록과 결제 활성 상태 확인
- 솔라피 SMS·LMS·카카오 알림톡 발송
- 알림톡 실패 시 솔라피 문자 대체 설정
- 고객별 선불 충전잔액, 예상비용 차감, 실패 시 자동 환불
- 메시지 발송 요청과 공급자 결과 기록

## D1 적용

운영 배포 전에 다음 마이그레이션을 적용합니다.

```bash
npx wrangler d1 migrations apply inlet-prod --remote --config wrangler.jsonc
```

추가되는 마이그레이션은 `migrations/0006_calllink_messaging.sql`입니다.

## 필수 비밀 환경변수

Cloudflare Pages 프로젝트의 Secret으로만 등록합니다. 저장소나 Android APK에 넣지 않습니다.

```text
CALLLINK_CODE_PEPPER
CALLLINK_DEVICE_PEPPER
SOLAPI_API_KEY
SOLAPI_API_SECRET
```

`CALLLINK_CODE_PEPPER`와 `CALLLINK_DEVICE_PEPPER`가 없으면 기존 `INLET_SESSION_SECRET` 또는 `INLET_API_TOKEN`을 보조값으로 사용하지만, 운영에서는 별도의 긴 난수 값을 권장합니다.

## 선택 환경변수

페이지로 고객에게 차감할 내부 판매단가입니다. 실제 솔라피 원가와 반드시 같을 필요는 없으며 부가세·운영비 정책에 맞춰 설정합니다.

```text
CALLLINK_SMS_PRICE=18
CALLLINK_LMS_PRICE=45
CALLLINK_MMS_PRICE=110
CALLLINK_ALIMTALK_PRICE=13
```

## API

### 페이지로 관리자 세션 필요

- `POST /api/calllink/connection-code`
  - 사업장 연결코드 발급
  - body: `projectId`
- `POST /api/calllink/channels`
  - 솔라피 발신번호·카카오 채널·승인 템플릿 설정
  - API 키와 비밀키는 body로 받지 않음
- `POST /api/calllink/wallet/credit`
  - 결제 완료 후 서버끼리 충전잔액 반영
  - `INLET_API_TOKEN` 권한 필요

### Android 연결 전 공개 호출

- `POST /api/calllink/connect`
  - body: `connectionCode`, `deviceKey`, `deviceName`, `appVersion`
  - 성공 시 `deviceToken`을 한 번 반환

### Android 기기 Bearer 토큰 필요

- `GET /api/calllink/session`
- `GET /api/calllink/channels`
- `GET /api/calllink/balance`
- `GET /api/calllink/pricing`
- `POST /api/calllink/messages/send`
- `GET /api/calllink/messages/history`

## 발송 정책

- 한 요청 최대 100건
- 발신번호는 사업장 서버 설정값만 사용
- 카카오 채널과 템플릿 ID도 서버 설정값만 사용
- Android 앱에서 솔라피 API 키를 받거나 저장하지 않음
- 충전잔액 부족 시 발송 요청 거절
- 솔라피 요청 자체 실패 시 선차감 금액 자동 환불
- 알림톡 문자 대체 여부는 사업장 채널 설정으로 통제

## 연결 흐름

```text
페이지로 관리화면에서 연결코드 발급
→ Android 앱에 6자리 코드 입력
→ 서버가 기기토큰 1회 발급
→ 앱은 기기토큰으로 사업장·랜딩페이지·잔액 조회
→ 솔라피/알림톡 요청은 페이지로 서버가 대행
```

## 운영 배포 순서

1. `npm run calllink:qa`
2. D1 `0006` 마이그레이션 적용
3. Cloudflare Secret 등록
4. 솔라피 발신번호 등록 완료 확인
5. 카카오 비즈메시지 채널과 템플릿 승인 확인
6. 페이지로 채널 설정 저장
7. 테스트 충전금 반영
8. SMS 1건 테스트
9. 알림톡 1건과 실패 시 문자 대체 테스트
10. Android 앱 사업장 연결코드 기능 활성화

## 아직 외부 준비가 필요한 항목

- 솔라피 계정과 API Key
- 등록·승인된 발신번호
- 카카오 비즈니스 채널
- 승인된 알림톡 템플릿 ID
- 실제 충전 결제 완료 후 `wallet/credit`을 호출할 페이지로 결제 후처리

이 외부 값이 없을 때는 API가 설정 미완료 상태를 반환하며 실제 메시지를 발송하지 않습니다.
