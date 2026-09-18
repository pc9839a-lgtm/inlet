# PageRo 개인 도메인 코어 정합성 패치

Updated: 2026-09-17 KST

## 현재 main 판정

현재 main에는 이미 다음 기본 기능이 존재한다.

- 설정 화면 개인 도메인 입력 UI
- `page.integrations.domain.hostname` 저장
- CNAME 안내 (`inlet-8mr.pages.dev`)
- 저장된 hostname 기반 custom-host 공개 라우팅

따라서 기존 PR #41 전체를 다시 병합하거나 UI/라우팅을 재구현하지 않는다.

## 이번 패치 범위

이번 패치는 D1을 개인 도메인 소유권의 canonical collision boundary로 만드는 기반만 추가한다.

1. `page_domains` 전용 테이블
2. apex / `www.` 동등 도메인 canonical key
3. 기존 `pages.page_json -> integrations.domain.hostname` backfill
4. 중복 active ownership 차단
5. PageRo / Pages.dev / localhost 예약 호스트 차단
6. 페이지 저장 시 trigger 기반 ownership mirror 동기화
7. hostname 제거 시 ownership release
8. 프로젝트 archive 시 ownership release
9. 기존 provider/DNS/SSL 운영 상태는 동일 hostname 저장에서 보존

## 이번 패치에서 하지 않는 것

- Cloudflare Pages custom-domain 등록/삭제
- 실제 DNS 조회
- 실제 SSL 상태 확인
- scheduled recheck
- 관리자 도메인 운영 화면
- 운영 D1 migration apply
- production deploy
- production root/home 변경
- 기존 custom-domain UI 변경
- 요금/플랜 변경

## 배포 순서

이 패치가 병합되더라도 migration을 승인 없이 운영에 적용하지 않는다.

1. branch/PR 전체 QA
2. D1 migration safety preflight
3. remote pending 목록에 `0015_page_domain_ownership.sql`이 정확히 포함되는지 확인
4. 별도 write 승인
5. encrypted backup
6. migration apply
7. ownership/backfill smoke
8. 그 다음 provider registration / DNS / SSL patch

## 보호 범위

다음 파일은 이번 패치에서 변경 금지다.

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing
- public-home components/styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- `server/index.mjs`

## 완료 조건

- 기존 custom-domain UI 계약과 routing 계약이 유지된다.
- `example.com`과 `www.example.com`을 서로 다른 페이지가 동시에 claim할 수 없다.
- domain claim 충돌 시 page write 자체가 원자적으로 rollback된다.
- hostname을 제거하면 claim이 released 된다.
- archive project의 claim은 released 된다.
- reserved Pagero host는 D1 boundary에서 차단된다.
- `npm run qa:all` 및 browser regression이 모두 통과한다.
