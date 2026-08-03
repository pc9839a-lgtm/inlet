# SES Auth Email Production Verification

페이지로 인증 이메일의 AWS SES 운영 준비 상태를 검증하는 읽기 전용 절차다.

이 검증은 이메일을 발송하지 않는다. 가입 인증, 비밀번호 재설정, 이메일 변경, 매니저 초대, 소유권 이전 알림의 실제 발송 검증은 별도의 승인된 테스트 수신함으로 진행해야 한다.

## 검증 범위

- SES `ProductionAccessEnabled`
- SES `SendingEnabled`
- 설정된 발신 주소가 SES identity에 속하는지
- identity `VerifiedForSendingStatus`
- Easy DKIM 또는 BYODKIM 활성 상태
- `_dmarc` TXT 레코드
- 선택적 custom MAIL FROM 상태
- 선택적 custom MAIL FROM의 `v=spf1 include:amazonses.com` TXT 레코드

## 안전 규칙

- GitHub Actions `workflow_dispatch` 수동 실행만 허용한다.
- GitHub `production` environment를 사용한다.
- AWS SES endpoint는 검증된 region의 `https://email.<region>.amazonaws.com`으로 고정한다.
- SES v2의 읽기 전용 `GET /v2/email/account`와 `GET /v2/email/identities/{identity}`만 호출한다.
- `POST /v2/email/outbound-emails`를 호출하지 않는다.
- DNS 조회는 `https://cloudflare-dns.com/dns-query`로 고정한다.
- 모든 요청은 `redirect: error`로 리디렉션을 차단한다.
- 이메일 발송, 설정 변경, identity 생성·삭제, DNS 변경을 수행하지 않는다.
- artifact에 AWS access key, secret key, Authorization, 발신 주소, SES identity, 실제 도메인을 기록하지 않는다.

## GitHub 설정

### Secrets

- `PAGERO_SES_ACCESS_KEY_ID`
- `PAGERO_SES_SECRET_ACCESS_KEY`

SES 읽기 전용 최소 권한을 사용한다.

권장 IAM action:

- `ses:GetAccount`
- `ses:GetEmailIdentity`

`ses:SendEmail`과 `ses:SendRawEmail`은 이 verifier 자격증명에 필요하지 않다.

### Repository variables

- `PAGERO_AUTH_EMAIL_FROM`
  - 예: `페이지로 <support@pagero.kr>`
- `PAGERO_SES_IDENTITY`
  - 예: `pagero.kr`

발신 주소는 identity와 정확히 일치하거나 해당 도메인 아래에 있어야 한다.

## 실행 옵션

- `region`
  - 기본 `ap-northeast-2`
- `require_dmarc`
  - 기본 true
- `require_custom_mail_from`
  - 기본 false
- `require_live`
  - 기본 true

custom MAIL FROM을 사용한다면 `require_custom_mail_from=true`로 실행한다. 이때 SES의 MAIL FROM 상태가 성공이고 해당 도메인의 SPF TXT에 `include:amazonses.com`이 있어야 한다.

## 결과

### `verified-live`

모든 필수 읽기 전용 검증이 실제 SES와 DNS 응답을 기준으로 통과했다.

### `failed-live`

다음 중 하나 이상이다.

- SES sandbox 상태 또는 production access 미승인
- 발송 기능 비활성
- identity 미검증
- DKIM 미완료
- 필수 DMARC 레코드 없음
- 필수 custom MAIL FROM/SPF 미완료
- region·자격증명·발신 주소·identity 설정 오류
- AWS 또는 DNS 읽기 실패

### `skipped-live`

`require_live=false`이고 필수 환경 설정이 없는 경우다. 운영 성공으로 간주하지 않는다.

## 실제 이메일 흐름 검증

읽기 전용 검증 통과 후 별도 승인으로 다음을 확인한다.

1. 고객 데이터가 없는 disposable 계정과 테스트 수신함 준비
2. 가입 인증 코드 1건 발송
3. 비밀번호 재설정 코드 1건 발송
4. 이메일 변경·매니저 초대·소유권 이전 알림이 구현된 경우 각각 1건 발송
5. 링크 또는 코드 만료 확인
6. 코드 재사용 차단 확인
7. 발신자·제목·본문·고객센터 주소 확인
8. Gmail 원본에서 DKIM·SPF·DMARC 결과 확인
9. 테스트 계정과 인증 기록 cleanup

실제 발송 검증에는 별도의 쓰기 승인과 테스트 수신함 allowlist가 필요하다.

## 최신 main 통합 검증 규칙

- PR 헤드 단독으로 통과한 과거 결과만으로 병합하지 않는다.
- GitHub가 생성한 최신 `main` 병합 후보 SHA에서 전체 QA와 브라우저 회귀를 다시 실행한다.
- SES 계약 검사는 실제 발송 endpoint 부재, 읽기 전용 메서드, 고정 endpoint, redirect 차단, Secret 비노출을 병합 후보에서 확인한다.
- 운영 SES·DNS 조회는 별도의 수동 `workflow_dispatch`에서만 실행하며 PR CI에서는 외부 계정에 접근하지 않는다.
