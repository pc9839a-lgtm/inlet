# 인증 코드 목적 격리 및 1회 소비

## 적용 목적

인증 코드는 `signup`, `password-reset`, `email-change` 세 목적만 허용합니다. 발급·확인·최종 작업 전 과정에서 이메일과 목적이 모두 일치해야 합니다.

## 상태 전환

- `pending`: 발급 완료, 확인 전
- `confirmed`: 화면에서 코드 확인 완료, 최종 작업 전
- `consumed`: 회원가입·비밀번호 변경·이메일 변경에 1회 사용 완료
- `superseded`: 같은 이메일·같은 목적으로 새 코드가 발급되어 폐기
- `expired` / `blocked`: 만료 또는 시도 제한

새 코드를 발급하면 동일 이메일·동일 목적의 기존 `pending`·`confirmed` 코드는 `superseded`로 전환합니다. 다른 목적의 코드는 변경하지 않습니다.

## 재사용 차단

회원가입, 비밀번호 변경, 이메일 변경은 실제 계정 쓰기 직전에 목적을 명시하고 `consume: true`로 검증합니다. D1 업데이트는 `pending` 또는 `confirmed` 상태에서만 `consumed`로 바뀌며 변경 행이 정확히 1개가 아니면 `EMAIL_VERIFICATION_ALREADY_USED`로 차단합니다.

화면의 코드 확인은 `confirmed`까지만 진행하므로 사용자는 확인 후 최종 제출을 할 수 있습니다. 최종 제출이 성공 경로에 들어가면 같은 코드는 다시 사용할 수 없습니다.

## 운영 영향

기존 `auth_email_verifications.status` 컬럼을 사용하므로 별도 D1 migration은 필요하지 않습니다. 운영 이메일 발송, DNS, SES 설정, 실제 계정 데이터 쓰기는 이 패치 QA에서 수행하지 않습니다.
