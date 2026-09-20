# PageRo 유지보수 / 배포 규칙

- 상태: 현재 운영 보호 기준
- 갱신일: 2026-09-20 KST
- 저장소: `pc9839a-lgtm/inlet`
- 운영 도메인: `https://pagero.kr/`

이 문서는 **운영 메인을 깨지 않고 저장소를 유지보수하는 규칙**만 관리한다.

현재 기능 상태와 작업 순서는 `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md`를 따른다.

## 1. 운영 메인 보호

사용자가 운영 메인 변경을 명시하지 않는 한 `https://pagero.kr/`의 디자인/문구/구조를 바꾸지 않는다.

운영 루트 source of truth:

- `functions/index.js`
- root marker: `.pagero-exact-home`
- frozen asset: `/c63-assets/index-pagero-main-fix-20260615.js`
- life bridge: `/c63-life-bridge.js`, `/c63-life-bridge.css`

보호 대상:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- `src/App.jsx`의 root/public routing
- public-home component/style
- `public/c63-assets/**`
- `public/c63-life-bridge.*`
- `server/index.mjs`의 root/static routing

내부 편집기 cleanup 때문에 위 파일을 바꾸지 않는다.

## 2. 실제 앱 경로를 먼저 확인

파일 이름으로 current source를 추정하지 않는다.

편집기 current path:

`WorkspaceEditorScreen → WorkspaceLeftPanel → WorkspaceActivePanel → EditPanel → EditPanelLayout`

실제 import/route에서 사용하지 않는 과거 component는 백업용으로 남기지 않는다.

Git history가 백업이다.

## 3. 유지보수 우선 규칙

새 기능을 추가하기 전 아래를 먼저 본다.

1. 같은 기능의 중복 component가 있는가
2. import 0건 dead file이 있는가
3. 동일 selector를 여러 CSS가 소유하는가
4. 동일 정책을 여러 문서가 설명하는가
5. open PR이 current main과 너무 벌어졌는가
6. 테스트가 실제 current path를 검증하는가

문제가 있으면 새 기능보다 먼저 정리한다.

## 4. 문서 규칙

문서 인덱스:

`docs/README.md`

금지:

- 완료된 PR 전용 문서를 영구 보관
- dated hotfix 문서를 source-of-truth로 보관
- `final/fix/hotfix/v2/v3` 병렬 기준 문서 누적
- 동일 기능의 current 문서 2개 이상
- 문서에 오래된 branch/SHA를 현재 기준처럼 유지

장애 재발 방지 지식은 가능한 한:

1. 자동 QA
2. 코드 invariant
3. 현재 운영 문서

순서로 남긴다.

## 5. 코드 정리 규칙

삭제 가능 조건:

- import/route 사용 0건 확인
- current runtime path 아님
- 테스트 fixture가 직접 의존하지 않음
- 보호 production-home 파일 아님

삭제 시:

- component와 전용 CSS를 함께 제거
- backup copy를 repository에 남기지 않음
- 대응 QA가 있으면 dead path 재유입을 막는 계약 추가 고려

삭제하면 안 되는 이유로 “혹시 필요할 수도 있음”을 사용하지 않는다.

필요하면 Git history에서 복구한다.

## 6. CSS 유지보수

한 레이아웃의 owner를 명확히 한다.

금지:

- 동일 화면을 여러 `*-final.css`, `*-fix.css`로 덮기
- 이유 없는 `!important` 누적
- 공용 control을 특정 화면 때문에 전역 override
- 사용처 검색 없이 legacy selector 삭제

편집기 shell current imports는 `WorkspaceEditorScreen.jsx`에서 확인한다.

새 CSS 파일을 추가하기 전에 기존 owner 파일에 들어갈 수 있는지 먼저 판단한다.

## 7. 작업 분리

PR 하나는 한 종류만 다룬다.

예:

- maintenance cleanup
- save/revision
- editor shell
- settings UX
- domain
- billing

cleanup PR에 제품 기능 변경을 섞지 않는다.

UI PR에 D1/API schema 변경을 섞지 않는다.

## 8. 작업 전 체크

1. `AGENTS.md`
2. `docs/README.md`
3. 이 문서
4. `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md`
5. current main HEAD
6. open PageRo PR
7. 실제 import/route
8. 보호 파일 diff

## 9. QA

기본 release gate:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

cleanup에서도 전체 QA를 통과해야 한다.

dead file 삭제 후 build가 통과하지 않으면 실제 사용처를 놓친 것이다.

## 10. 배포

운영 CORS 기준:

- `INLET_ALLOWED_ORIGINS`에 production origin `https://pagero.kr`를 포함한다.
- session/API 보안 설정을 문서나 프론트 코드의 임의 fallback으로 대체하지 않는다.


운영 배포는 사용자의 명시적 승인 후에만 수행한다.

금지:

- main force push
- 검증 전 merge
- production D1 write를 UI 작업과 함께 실행
- 보호 root diff가 있는 상태로 내부 기능 배포
- reset/clean으로 운영 트리 복원

배포 전:

- tested SHA 기록
- preview/exact deployment 확인
- `pagero.kr/api/readiness`
- 필요한 경우 production save roundtrip
- production home marker 유지

## 11. SEO / 정적 운영 파일

공개 운영 규칙:

- `robots.txt`: text/plain
- `sitemap.xml`: XML
- 내부 app/login/admin 경로: noindex
- SPA fallback이 robots/sitemap을 HTML로 덮지 않음

SEO 작업 때문에 production home 구조를 변경하지 않는다.

## 12. 중단 조건

다음은 별도 승인 대상이다.

- production deploy
- production D1 write
- custom domain 실제 provider attach/detach
- 실제 결제 provider 활성화
- 실사용자 데이터 삭제
- production home redesign

## 13. 완료 보고

```text
작업 브랜치:
시작 main SHA:
목적:
삭제/변경 파일:
실제 runtime 변경:
보호 root 변경:
QA:
browser QA:
main 병합:
production deploy:
D1 write:
남은 문제:
```

`implemented`, `QA passed`, `merged`, `deployed`, `production verified`를 섞어 쓰지 않는다.
