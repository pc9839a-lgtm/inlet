# 페이지로 콜링크 인증·이용권 운영

## 공개 주소

- 계정 포털 예정 주소: `https://call.pagero.kr`
- 개인정보처리방침: `https://call.pagero.kr/privacy`
- 이용약관: `https://call.pagero.kr/terms`
- 이용권 안내: `https://call.pagero.kr/subscribe`

`functions/_middleware.js`가 `call.pagero.kr` 호스트의 위 경로를 `public/call/` 정적 페이지로 연결한다. 운영 전 Cloudflare Pages 프로젝트에 `call.pagero.kr` 사용자 지정 도메인을 추가해야 한다.

## 가입 정보

필수 입력값:

- 이름
- 휴대폰번호
- 이메일
- 브랜드명
- 업종
- 비밀번호
- 이메일 인증번호

이메일 인증은 기존 `/api/auth/email-verification`을 사용한다. 인증 목적은 회원가입 시 `signup`, 비밀번호 변경 시 `password_reset`이다. 인증을 완료하지 않은 회원가입 요청은 거부한다.

## API

- `POST /api/call/register`: 콜링크 회원가입
- `POST /api/call/login`: 로그인 및 이용권 조회
- `POST /api/call/session`: 세션·프로필·이용권 새로고침
- `GET|PATCH /api/call/account`: 콜링크 프로필 조회·수정
- `GET|POST|PATCH /api/call/admin/entitlement`: 관리자 이용권 조회·변경

관리자 이용권 API는 `X-CallLink-Admin` 헤더에 `CALLLINK_ADMIN_TOKEN` 값을 요구한다.

## 데이터

`migrations/0006_calllink_app_accounts.sql` 적용 후 다음 테이블을 사용한다.

- `calllink_profiles`: 이름, 연락처, 이메일, 브랜드명, 업종
- `calllink_entitlements`: 결제 상태, 요금제, 이용 종료일, 결제 연동 식별자

이용권 상태:

- `pending_payment`: 가입 완료, 결제 미확인
- `active`: 사용 가능
- `expired`: 이용기간 만료
- `suspended`: 관리자 정지

## 초기 결제 운영

초기에는 기존 페이지로 결제정보의 이메일 또는 휴대폰번호와 콜링크 가입정보를 대조한 뒤 관리자 API로 `active` 상태와 `paidUntil`을 등록한다.

결제 시스템에서 웹훅을 제공하게 되면 같은 관리자 API 로직을 내부 호출하도록 연결한다. 결제 취소·환불·기간 만료 시 `expired` 또는 `suspended`로 변경한다.

## 운영 전 필수 작업

1. D1에 `0006_calllink_app_accounts.sql` 적용
2. `INLET_SESSION_SECRET` 운영 비밀값 확인
3. 인증메일 공급자 환경변수 확인
4. `CALLLINK_ADMIN_TOKEN` 등록
5. Cloudflare Pages에 `call.pagero.kr` 사용자 지정 도메인 연결
6. 서버 배포 후 회원가입·로그인·비밀번호 재설정 실메일 테스트
7. 결제 완료 계정의 활성·만료·정지 전환 테스트

## QA

```bash
npm run calllink:auth:qa
npm run qa:all
```

운영 배포 전에는 앱과 서버 PR을 병합하지 않고 Draft 상태에서 실기기와 실메일 검증을 진행한다.
