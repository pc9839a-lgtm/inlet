# PageRo 인증 보안 정책

- 상태: SOURCE / 현재 인증 보안 기준
- 갱신일: 2026-10-02 KST
- 범위: 이메일 인증, 비밀번호 로그인, 세션 무효화, 인증메일 운영
- 구현 근거: 현재 `functions/api/auth/**`와 auth QA scripts

이 문서는 과거 인증 보안 패치 문서들을 하나로 합친 현재 기준이다. 개별 패치 시점의 "이번 패치에서 완료", "남은 작업" 문서를 다시 source-of-truth로 사용하지 않는다.

## 1. 이메일 인증 목적

허용 목적은 다음 세 개다.

- `signup`
- `password-reset`
- `email-change`

발급, 코드 확인, 최종 계정 작업까지 이메일과 purpose가 일치해야 한다.

상태 흐름:

- `pending`: 발급 완료
- `confirmed`: 코드 확인 완료
- 최종 보호 작업에서 1회 소비
- 같은 이메일·같은 purpose로 새 코드를 발급하면 기존 pending/confirmed는 폐기
- 이미 소비된 코드는 재사용 불가

현재 회귀 계약:

- `scripts/auth-verification-purpose-consumption-quality-check.mjs`

## 2. 계정 존재 여부 보호

인증메일 요청 단계에서 계정 존재 여부를 직접 노출하지 않는다.

회원가입/이메일 변경:

- 인증 요청 자체에서 중복 계정 여부를 공개하지 않음
- 최종 계정 쓰기 단계에서 중복 여부 판정

비밀번호 재설정:

- 등록 계정이면 실제 인증메일 발송
- 미등록 계정도 동일한 접수 형태를 반환
- provider 실패 여부를 계정 존재 여부 신호로 사용하지 않음
- 최소 응답 시간 계약 유지

현재 회귀 계약:

- `scripts/auth-verification-enumeration-quality-check.mjs`

## 3. 인증메일 악용 방지

이메일 기준 cooldown/일일 제한과 별도로 요청자 기준 제한을 사용한다.

요청자 식별:

- Cloudflare `CF-Connecting-IP` 원문을 저장하지 않음
- 서버 Secret 기반 HMAC 식별자를 사용
- 원본 IP를 API 응답/저장 키/로그에 노출하지 않음

현재 계약에 포함된 제한:

- 동일 요청자 + 동일 purpose: 10분 8회
- 동일 요청자 + 동일 purpose: 24시간 30회
- 동일 요청자 전체 purpose: 10분 20회
- 동일 요청자 전체 purpose: 24시간 80회
- rate-limit 응답: `EMAIL_VERIFICATION_RATE_LIMITED`

현재 회귀 계약:

- `scripts/auth-email-abuse-quality-check.mjs`

## 4. 비밀번호 로그인 악용 방지

비밀번호 로그인은 계정/요청자 조합과 전체 계정/요청자 단위 제한을 적용한다.

현재 계약:

- 동일 요청자 + 동일 계정: 15분 실패 5회
- 동일 계정: 15분 8회 / 24시간 30회
- 동일 요청자: 10분 30회 / 24시간 150회
- 제한 응답: `AUTH_LOGIN_RATE_LIMITED`
- 존재하지 않는 계정과 잘못된 비밀번호는 동일한 invalid 응답 사용
- 계정·IP 원문 대신 HMAC 식별자 사용
- 비밀번호 비교 timing 차이를 줄이기 위한 최소 처리 시간 유지
- rate-limit 조회 장애는 로그인 시스템 전체 장애로 확대하지 않음

현재 회귀 계약:

- `scripts/auth-login-abuse-quality-check.mjs`

## 5. 세션 무효화

세션은 계정 보안 상태에 결합된다.

세션 버전에 영향을 주는 값:

- account/owner id
- email
- password hash
- account status
- email verified state

일반 프로필 이름/휴대폰 변경만으로 세션을 무효화하지 않는다.

기존 세션을 끊어야 하는 변경:

- 비밀번호 변경/재설정
- 계정 ID 또는 이메일 변경
- 계정 정지 등 보안 상태 변경
- 이메일 인증 보안 상태 변경

무효화된 세션은 `AUTH_SESSION_REVOKED`로 처리한다.

현재 회귀 계약:

- `scripts/auth-session-revocation-quality-check.mjs`

## 6. 인증메일 provider 안전성

Production에서는 mock delivery를 인증 수단으로 사용하지 않는다.

SES 경로의 현재 안전 계약:

- 인증 레코드 저장 성공 전 외부 메일 발송 금지
- 발송 실패 시 pending 인증 레코드 정리
- SES region 검증
- SES endpoint 고정
- redirect 차단
- provider 세부 오류, request id, message id, credential을 사용자 응답에 노출하지 않음
- 사용자 오류 문구는 일반화
- 실제 Secret은 repository/docs/log에 기록하지 않음

현재 회귀 계약:

- `scripts/auth-email-quality-check.mjs`
- `docs/ops-ses-auth-email-production-verification.md`

## 7. 운영 검증

로컬/CI:

```bash
npm run auth:qa
npm run qa:all
```

실제 SES/DNS/메일 수신 검증은 별도 production 승인과 QA 전용 계정/수신함으로 진행한다.

운영 검증 시 금지:

- 실제 인증코드 문서/PR/스크린샷 기록
- session token 기록
- AWS access key/secret 기록
- 실제 고객 계정으로 보안 시나리오 검증
- production write를 문서 정리 작업과 함께 실행

## 8. 문서 수명주기

다음 과거 문서는 이 문서로 흡수되어 삭제되었다.

- auth email runtime risk snapshot
- email abuse patch memo
- login abuse patch memo
- verification enumeration patch memo
- verification purpose/consumption patch memo
- session revocation patch memo

세부 구현이 바뀌면 이 문서와 QA contract를 함께 갱신한다.
