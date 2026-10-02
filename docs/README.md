# PageRo 문서 인덱스

갱신일: 2026-10-02 KST

이 폴더는 **현재 운영에 필요한 문서만 유지**한다. 완료된 패치 기록, 특정 날짜의 핫픽스 메모, 이미 대체된 UI 명세를 current source처럼 남기지 않는다.

## 1. PageRo 필수 문서

아래 문서가 PageRo 작업의 현재 기준이다.

1. `../AGENTS.md` — 저장소 최상위 보호 규칙
2. `PAGERO_MAINTENANCE_HANDOFF_KO.md` — 운영 메인·배포·유지보수 규칙
3. `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md` — 현재 기능 상태·출시 블로커·작업 순서
4. `PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md` — 편집기 제품 방향과 차별화 기준
5. `PAGERO_PLAN_POLICY_KO.md` — PageRo 요금 정책

PageRo 작업 중 위 문서와 과거 문서가 충돌하면 위 목록을 우선한다.

### 다른 AI 빠른 시작

새 AI/에이전트는 아래 순서만 지키면 된다.

1. current `main` HEAD 확인
2. open PR 확인
3. `AGENTS.md` 보호 규칙 확인
4. `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md`에서 완료/남은 backlog 확인
5. 실제 import/route/source 확인
6. 완료 영역은 재작업하지 않고 남은 backlog만 진행

현재 핵심 상태:

- E0~E4 완료
- P6 설정 UX 완료
- B3 production smoke는 사용자 요청으로 스킵
- 다음 backlog는 P5 개인 도메인 → P7 웹 결제 → P9 접근성 → P8 대량 데이터 → E5 A/B test
- open PageRo PR #233~#235는 오래된 개인 도메인 draft이므로 그대로 병합 금지
- AI 확장은 사용자가 다시 요청하기 전까지 후순위

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
