# PageRo 문서 인덱스

- 상태: INDEX / 문서 단일 진입점
- 갱신일: 2026-10-06 KST

이 폴더에는 **현재 코드와 운영에서 다시 사용할 문서만 유지**한다. 완료된 PR 메모, 날짜별 검증 스냅샷, 이미 대체된 보안 패치 문서, 과거 브랜드 문서는 Git history로 돌리고 repository에는 남기지 않는다.

## 1. 다른 AI 시작 순서

새 AI/에이전트는 아래 순서로만 읽는다.

1. current `main` HEAD 확인
2. open PR 확인
3. `../AGENTS.md`
4. `PAGERO_MAINTENANCE_HANDOFF_KO.md`
5. `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md`
6. 작업 영역의 SOURCE/RUNBOOK
7. 실제 import/route/source

과거 대화 요약, 오래된 PR 설명, 삭제된 문서 이름을 current source처럼 사용하지 않는다.

현재 핵심 상태:

- E0~E4 완료
- P6 설정 UX 완료
- P5 current-main 코드 재구성 완료: #352 ownership core → #353 provider/DNS/SSL → #354 settings server workflow
- P5 production D1 migration + provider env + canonical custom-host router 운영 반영 완료
- P5 외부 실도메인 DNS/SSL smoke는 기존 운영 브랜드 도메인을 재사용하지 않고, 별도 테스트 도메인 확보 시 후순위 실행
- B3 production smoke는 사용자 요청으로 스킵
- P7 웹 결제 기반: 0016 production 적용 완료, order/idempotency + fail-closed provider adapter boundary + normalized lifecycle + read-only history 구현
- 실제 PG는 아직 선택하지 않았고 청구는 OFF
- P9 접근성: focus trap/return, keyboard focus, zoom/mobile viewport, contrast, navigation semantics, reduced-motion QA 보강
- P7 실제 PG adapter 연동은 현재 홀드
- P8 대량 데이터: 10k/50k benchmark + lead inbox keyset pagination + bounded CSV streaming + fail-closed retention 구현, production 데이터 삭제 없음
- 다음 backlog: P8 backup/restore 실제 복구 검증 → production query plan 재확인 → E5 A/B test
- AI 확장은 사용자 재요청 전까지 후순위
- 오래된 PageRo domain PR #233~#235는 current-main 재구성으로 대체되어 2026-10-02 closed

## 2. 문서 역할

- **INDEX**: 어디서 무엇을 읽을지 정하는 문서
- **SOURCE**: 현재 정책·제품 방향·보안/데이터 기준
- **RUNBOOK**: 반복 가능한 운영·검증 절차
- **TEMP**: 작업 중에만 존재. PR 병합 전에 삭제하거나 SOURCE/RUNBOOK에 흡수

동일 주제의 SOURCE는 하나만 둔다.

## 3. 전체 문서 목록

아래 목록에 없는 `docs/*.md`는 orphan 문서로 본다.

| 역할 | 문서 | 용도 |
| --- | --- | --- |
| INDEX | `README.md` | 문서 진입점·수명주기 |
| SOURCE | `PAGERO_MAINTENANCE_HANDOFF_KO.md` | 운영 메인 보호·배포·유지보수 규칙 |
| SOURCE | `PAGERO_INTERNAL_OPTIMIZATION_MASTER_KO.md` | 현재 완료 상태·남은 backlog·작업 순서 |
| SOURCE | `PAGERO_EDITOR_PRODUCT_DIRECTION_KO.md` | 편집기 제품 방향·E0~E5 기준 |
| SOURCE | `PAGERO_PLAN_POLICY_KO.md` | PageRo 요금제 정책 |
| SOURCE | `UNIFIED_PAGERO_CALLTAG_BILLING_REFERRAL_KO.md` | PageRo·CallTag 통합 결제/추천/정산 정책 |
| SOURCE | `ops-auth-security-policy.md` | 인증 목적·rate limit·세션 무효화·메일 안전 기준 |
| SOURCE | `ops-admin-audit-log.md` | 관리자 감사로그 정책·운영 기준 |
| SOURCE | `ops-pii-retention-export-policy.md` | 개인정보 보존·마스킹·CSV 정책 |
| SOURCE | `ops-storage-migration-policy.md` | 저장소·D1 migration 정책 |
| RUNBOOK | `ops-account-page-limit-production-verification.md` | 계정 페이지 제한 운영 검증 |
| RUNBOOK | `ops-admin-audit-production-verification.md` | 관리자 감사 기능 운영 검증 |
| RUNBOOK | `ops-conversion-production-verification.md` | 전환 추적 운영 검증 |
| RUNBOOK | `ops-d1-migration-safety.md` | D1 migration 안전 절차 |
| RUNBOOK | `ops-deployment-cache-seo-checklist.md` | 배포·캐시·SEO 검증 |
| RUNBOOK | `ops-google-sheets-production-verification.md` | Google Sheets 운영 검증 |
| RUNBOOK | `CALLTAG_GOOGLE_PLAY_RTDN_SETUP_KO.md` | CallTag Google Play RTDN Push·갱신 처리 운영 설정 |
| RUNBOOK | `ops-live-integration-matrix.md` | live integration 상태 판정 |
| RUNBOOK | `ops-operator-readiness-checklist.md` | 출시/운영자 readiness |
| RUNBOOK | `ops-pagero-production-launch-smoke.md` | 신규 사용자 production smoke — 현재 실행 스킵 |
| RUNBOOK | `ops-ses-auth-email-production-verification.md` | SES/DNS/인증메일 운영 검증 |

## 4. 문서 생성 금지

새 작업에서 다음 형태를 만들지 않는다.

- `*-final.md`
- `*-fix.md`
- `*-hotfix-YYYYMMDD.md`
- `*-v2.md`, `*-v3.md`
- 날짜가 파일명에 박힌 운영 스냅샷
- 완료 PR 전용 실행 지시서
- 동일 정책의 병렬 SOURCE
- 특정 배포 SHA/Workflow Run ID를 장기 기준으로 삼는 문서

필요한 지식은 기존 SOURCE/RUNBOOK을 갱신한다.

## 5. 삭제 기준

다음 중 하나면 삭제 후보로 본다.

- current code/workflow와 연결되지 않음
- 다른 SOURCE가 완전히 대체함
- "이번 패치", "남은 작업" 형태의 시점성 메모
- 특정 배포/PR 결과만 기록한 스냅샷
- 과거 브랜드·과거 가격·과거 API 기준
- 체크리스트와 runbook이 중복되고 한쪽에 흡수 가능

삭제 전에는 current code/script/workflow에서 파일명 참조가 없는지 확인한다. 필요한 durable rule은 상위 SOURCE/RUNBOOK 또는 QA contract로 옮긴 뒤 삭제한다.

## 6. 이번 정리에서 통합한 영역

2026-10-02 정리에서 다음 유형의 옛 문서를 제거했다.

- 과거 CallLink 인증/이용권 문서
- 날짜별 CallTag Google Play 환경 스냅샷
- 과거 PageRo→CallTag push 배포 기록
- 인증 이메일 runtime risk 스냅샷
- 인증 abuse/enumeration/session 관련 개별 패치 문서
- SES 별도 checklist

인증 관련 durable rule은 `ops-auth-security-policy.md`로 통합했고, SES checklist는 `ops-ses-auth-email-production-verification.md`에 흡수했다.

## 7. 자동 검증

문서 구조는 다음 명령으로 검사한다.

```bash
npm run docs:qa
```

검사 항목:

- 모든 `docs/*.md`가 이 인덱스에 등록되어 있는지
- 금지된 dated/final/fix/hotfix/v2/v3 문서명이 다시 생기지 않는지
- 필수 SOURCE가 존재하는지
- 삭제된 옛 문서가 다시 추가되지 않는지
- current master가 E0~E4/P6 완료와 현재 backlog를 유지하는지

`npm run qa:all`에도 포함한다.
