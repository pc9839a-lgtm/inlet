# SES 인증 이메일 운영 체크리스트

- [ ] GitHub `production` environment 승인자 설정
- [ ] 읽기 전용 IAM access key 등록
- [ ] `PAGERO_AUTH_EMAIL_FROM` 등록
- [ ] `PAGERO_SES_IDENTITY` 등록
- [ ] SES production access 승인
- [ ] SES sending 활성화
- [ ] identity verified
- [ ] DKIM success
- [ ] DMARC TXT 확인
- [ ] custom MAIL FROM 사용 시 상태 success
- [ ] custom MAIL FROM 사용 시 Amazon SES SPF 확인
- [ ] read-only workflow `verified-live`
- [ ] artifact에 key·주소·도메인 미노출 확인
- [ ] 별도 승인 전 실제 이메일 발송 금지
