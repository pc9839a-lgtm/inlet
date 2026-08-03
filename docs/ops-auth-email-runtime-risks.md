# Auth Email Runtime Follow-up Risks

SES 운영 준비 상태와 실제 인증 이메일 런타임 안전성은 별개다.

이번 읽기 전용 verifier는 AWS 계정·identity·DKIM·DMARC·MAIL FROM/SPF 상태만 확인하며 이메일을 발송하거나 인증 코드를 생성하지 않는다.

실제 발송 검증 전에 아래 런타임 항목을 별도 패치로 완료해야 한다.

- 운영 환경에서 `mock` delivery와 인증 코드 응답 노출 금지
- `INLET_AUTH_EMAIL_EXPOSE_TOKEN=1` 운영 사용 차단
- SES 발송 요청의 redirect 추적 차단
- SES region 형식 검증과 endpoint 고정
- provider 오류 원문·request ID·identity·수신자 주소 API 응답 노출 금지
- 발송 실패 시 생성된 인증코드와 cooldown residue 정리
- D1 인증코드 저장 실패 시 실제 이메일 발송 금지
- 인증 목적별 코드 격리
- 인증 완료 코드 재사용 정책 확정 및 소비 처리
- 가입·비밀번호 재설정·이메일 변경·매니저 초대·소유권 이전 테스트 수신함 allowlist

이 문서의 항목이 완료되기 전에는 SES identity 준비 완료를 인증 이메일 전체 운영 완료로 기록하지 않는다.
