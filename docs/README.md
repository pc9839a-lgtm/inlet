# PageRo 문서 인덱스

갱신일: 2026-09-20 KST

이 폴더는 **현재 운영에 필요한 문서만 유지**한다. 완료된 패치 기록, 특정 날짜의 핫픽스 메모, 이미 대체된 UI 명세를 current source처럼 남기지 않는다.

## 1. PageRo 필수 문서

아래 문서가 PageRo 작업의 현재 기준이다.

1. `../AGENTS.md` — 저장소 최상위 보호 규칙
2. `PAGERO_MAINTENANCE_HANDOFF_KO.md` — 운영 메인·배포·유지보수 규칙
3. `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md` — 현재 기능 상태·출시 블로커·작업 순서
4. `PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md` — 편집기 제품 방향과 차별화 기준
5. `PAGERO_PLAN_POLICY_KO.md` — PageRo 요금 정책

PageRo 작업 중 위 문서와 과거 문서가 충돌하면 위 목록을 우선한다.

## 2. 운영 Runbook

`ops-*.md`는 실제 운영 절차가 현재 코드와 연결되어 있을 때만 유지한다.

유지 조건:

- 현재 workflow/script/API 이름과 일치
- 실제 production/staging 작업에서 다시 사용할 절차
- secret 원문을 포함하지 않음
- 현재 source-of-truth 문서와 정책 충돌 없음

특정 장애 한 번을 처리하기 위한 일회성 hotfix 문서는 해결 후 제거하고, 재발 방지 규칙은 테스트 또는 상위 운영 문서로 옮긴다.

## 3. 문서 생성 금지 패턴

새 작업에서 다음 형태의 문서를 추가하지 않는다.

- `*-final.md`
- `*-fix.md`
- `*-hotfix-YYYYMMDD.md`
- `*-v2.md`, `*-v3.md` 식의 병렬 기준 문서
- 완료된 PR 전용 실행 지시서
- 동일 영역의 새로운 source-of-truth 문서

기존 문서를 갱신할 수 있으면 새 문서를 만들지 않는다.

## 4. 문서 수명주기

새 문서를 만들기 전 반드시 다음 중 하나로 분류한다.

- **SOURCE**: 계속 유지되는 정책/운영 기준
- **RUNBOOK**: 반복 사용하는 운영 절차
- **TEMP**: 작업 종료와 함께 삭제할 임시 메모

TEMP 문서는 PR 병합 전에 삭제하거나 상위 SOURCE/RUNBOOK에 필요한 내용만 흡수한다.

## 5. 코드 정리 원칙

- import 0건의 dead component/style은 검증 후 삭제
- repository 안에 수동 backup 파일을 남기지 않음
- Git history를 백업 저장소로 사용
- 실제 진입 경로가 아닌 실험 UI를 fallback 용도로 보관하지 않음
- 과거 CSS를 유지해야 할 경우 현재 사용처와 삭제 조건을 주석/계약 QA로 명시
