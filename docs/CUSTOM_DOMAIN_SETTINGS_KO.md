# 개인 도메인 설정

## 설정 위치

페이지 편집기 → 설정 → 기본 → 개인 도메인

## DNS 레코드

- 유형: `CNAME`
- 호스트/이름: 루트 도메인은 `@`, 서브도메인은 해당 접두어(예: `landing`)
- 대상/값: `inlet.pages.dev`

## 화면 동작

- 도메인 입력값은 페이지의 `integrations.domain`에 저장한다.
- 저장 시 상태는 `pending`으로 기록한다.
- DNS 대상 주소와 호스트 값을 각각 복사할 수 있다.
- 삭제 시 도메인 입력값을 비우고 상태를 `disconnected`로 변경한다.

## 운영 참고

외부 DNS 업체에서 루트 CNAME을 지원하지 않으면 ALIAS/ANAME 또는 CNAME Flattening을 사용해야 한다. DNS 등록 외에 Cloudflare Pages 프로젝트의 사용자 지정 도메인 등록이 필요한 경우 운영자가 별도로 승인·연결한다.
