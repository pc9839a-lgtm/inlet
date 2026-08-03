# Auth Email Runtime Security Status

Updated: 2026-08-04

SES 운영 준비 상태와 실제 인증 이메일 런타임 안전성은 별개다.

## 이번 패치에서 완료

- 운영 `main` 또는 production 환경의 `mock` delivery 차단
- 운영 `INLET_AUTH_EMAIL_EXPOSE_TOKEN=1` 설정으로도 인증코드 응답 노출 불가
- 실제 SES 발송 전에 D1 인증코드 저장 성공 필수
- 발송 실패 시 해당 pending 인증코드 즉시 삭제
- 실패한 요청이 60초 cooldown 및 일일 발송 횟수에 남지 않도록 residue 정리
- SES region 형식 제한 및 `https://email.<region>.amazonaws.com` 목적지 고정
- SES 요청의 redirect 추적 차단
- SES timeout 5~60초 범위 제한
- provider 오류 원문, request ID, message ID, identity 및 수신자 주소 API 응답 비노출
- 사용자 오류 문구를 일반적인 재시도 안내로 고정
- 세션 토큰 파싱 실패가 SES 오류로 잘못 기록되던 로그 제거

## 아직 남은 작업

- 가입·비밀번호 재설정·이메일 변경 등 인증 목적별 조회를 DB 쿼리 단계에서 완전히 격리
- 인증 완료 코드를 즉시 `consumed` 처리하고 재사용 정책 확정
- 테스트 수신함 allowlist 기반 실제 발송 검증
- 이메일 변경·매니저 초대·소유권 이전 알림의 구현 상태별 실검증
- 운영 SES/DNS 읽기 전용 verifier의 `verified-live` 증빙 확보

실제 이메일 발송 검증은 고객 데이터가 없는 전용 계정과 allowlist 수신함으로 별도 승인 후 진행한다.
