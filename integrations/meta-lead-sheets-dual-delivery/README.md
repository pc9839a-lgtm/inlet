# 개인회생 Meta 리드: Apps Script 최소 릴레이 + Cloudflare 처리

## 최종 아키텍처

Meta 인스턴트 양식 → Google Sheets (시트1, A:R) → **Apps Script 74줄 릴레이** → **Cloudflare Pages Function + D1** → (1) 콜태그 고객 DB (2) 광고주 API.

- Apps Script는 신규 행을 HTTPS로 Cloudflare에 **전달만** 합니다. 전화번호 변환, 업체 API 전송, 콜태그 등록 및 재시도는 하지 않습니다.
- Cloudflare는 Meta ID로 중복을 차단하고 D1에 접수한 뒤, 각 목적지의 전송 상태를 분리 관리합니다.
- 콜태그는 기존 Webhook 식별 키로 수신 계정 소유자를 조회해 **기존 범용 리드 저장 함수를 호출**하므로 앱 패치나 별도 Webhook 필드 매핑이 필요하지 않습니다.
- 광고주에게는 HTTPS POST + application/x-www-form-urlencoded, **ITEM=64 고정** 및 확인된 Make 성공 요청과 동일한 6개 필드를 전송. 과거 Make 블루프린트의 ITEM=41과 임시 테스트 ITEM=40은 사용하지 않습니다.
- 콜태그 실패는 최대 3회 재시도. 광고주는 리다이렉트를 따라가고 최종 HTTP 2xx 및 명시적 성공 응답(SUCCESS 등)이 있을 때만 전송 수락으로 표시하며 그 외는 REVIEW로 분류합니다. `SENT`는 HTTP 수락 기록이지 광고주 전산 등록을 증명하지 않습니다. 불확실한 전송은 자동 재시도하지 않습니다.
- 기존 콜태그 Webhook 주소를 Apps Script 스크립트 속성에만 입력합니다. Cloudflare는 기존 활성 Webhook의 해시로 인증합니다. 실제 URL은 공개 GitHub 코드나 시트 셀에 넣지 않습니다.

## 현재 확인된 실제 Google Sheet

- 스프레드시트 URL: https://docs.google.com/spreadsheets/d/1ZdoDydn6kBbU7OeG-5LYIPbwrlervVp0Uc1ek89f8FA/edit
- 탭: 시트1
- 메타 원본 필드: id, created_time, 총_채무액(2,000만원_이상_가능), 상담가능시간, 문의내용(ex개인회생/파산_등), full_name, phone_number 등 A:R 18개 열
- 생성 당시 메타 테스트 리드 1개가 있었고 이는 더미 데이터이므로 Cloudflare에서 전달을 제외함
- 운영 리드/실제 연락처를 전송하는 테스트는 아직 수행하지 않음

## 설치 (별도 릴레이 토큰 생성 불필요)

Cloudflare Pages 프로젝트 **inlet** (pagero.kr)에서 인증과 고객 처리를 수행합니다. 서버는 발급된 Webhook 주소의 일방향 SHA-256 지문과 기존 활성 연결 레코드를 함께 검사합니다. GitHub 코드에 비밀 URL은 저장하지 않습니다.

별도로 META_SHEETS_RELAY_TOKEN이나 META_SHEETS_CALLTAG_WEBHOOK_URL을 Cloudflare에 설정할 필요가 없습니다. 이미 발급된 활성 Webhook을 재사용합니다. 선택적 Cloudflare 환경 변수는 다음과 같습니다.
- META_SHEETS_DISPATCH_ENABLED: '0'을 설정하면 서버 전체 전송을 일시 정지합니다. 미설정 시 인증된 연결만 처리합니다.
- META_SHEETS_ADVERTISER_URL: 기본 https://ollymkt.shop/dbapi/
- META_SHEETS_ADVERTISER_ITEM: 이전에 설정된 값이 40 또는 41이어도 **현재 코드에서 무시**합니다. 전송은 무조건 ITEM=64입니다. 운영 환경 변수는 정리할 수 있지만 필수 작업은 아닙니다.

**Apps Script 코드 교체:** 구글시트에서 확장 프로그램 → Apps Script → Code.gs 전체를 이 디렉터리의 Code.gs로 교체 후 저장합니다. 웹 앱 배포(/exec)는 사용하지 않습니다.

**Apps Script 속성은 1개만 필요합니다.**
- CALLTAG_WEBHOOK_URL: 기존 콜태그 앱에서 발급받은 비밀 Webhook 전체 HTTPS URL.

기존 META_SHEETS_RELAY_TOKEN 속성은 더 이상 사용하지 않으니 삭제해도 됩니다. `installMetaRelay` 실행 전에 Code.gs를 새 버전으로 교체해야 합니다.

1. Cloudflare 수정 버전의 main 병합 및 운영 배포가 확인된 다음 Apps Script의 함수 선택에서 **installMetaRelay**를 실행해 Google 권한을 승인합니다.
2. installMetaRelay는 기존 행을 제외한 현재 마지막 행을 커서에 저장하고 1분 타이머를 등록합니다. 기존 processLeadBridge 트리거가 있으면 제거합니다.
3. **relayMetaLeads**를 수동 실행하면 Cloudflare에 아직 보내지 않은 신규 행만 전송합니다. 신규 행이 없으면 재처리 대기 건을 점검하도록 빈 배열을 보냅니다.
4. 202 + ok=true + accepted=전달 행 수를 받은 경우에만 커서를 진행합니다. 실패하면 다음 실행에 같은 행을 보내며 Cloudflare는 ID로 중복 저장을 방지합니다.
5. 기존 메타 테스트 데이터 문자열(예: <test lead: dummy data...>)은 Cloudflare가 구분해 전송하지 않습니다.

## 서버 구현

- POST /api/integrations/meta-sheets/relay
- Cloudflare의 D1 meta_sheet_dual_queue 테이블에 수신 기록을 저장합니다.
- 콜태그: calltag_webhook_connections 테이블에서 Webhook secret의 해시로 소유자 검색 → intakeCanonicalLead 호출 → FCM 신규 리드 알림 시도.
- 광고주: 정확히 ITEM, DATAS_name, DATAS_phone, DATAS_money, DATAS_calldate, DATAS_data 6개 필드로 POST. 원본과 같이 followRedirect 활성화. 최종 HTTP 2xx이며 명시적 거부가 아닌 경우 SENT(HTTP 전송 단계만 수락), 그 외 REVIEW.
- 이미 받은 ID는 INSERT OR IGNORE로 무시됩니다.
- 한 번에 최대 5행. 1분 주기 스크립트가 새 리드를 전달하고 서버에 재처리 신호를 보냅니다.
- 콜태그 도중 중단된 상태는 3분 뒤 재시도. 광고주 전송 도중 중단은 REVIEW로 표시해 중복을 방지합니다.
- 시트 오른쪽에 앞서 추가된 상태 열은 이 설계에서 사용하지 않습니다. 실제 전송 상태는 서버 D1에서 관리합니다.

## 테스트

node --test integrations/meta-lead-sheets-dual-delivery/bridge.test.mjs

GAS 코드는 사용자가 구글시트에 수동으로 붙여넣어야 합니다. GitHub PR만으로 Google Apps Script를 자동 설치할 수 없습니다. 이 구현은 실고객 정보 전송·외부 광고주 API 실접수 검증을 아직 하지 않았습니다.

## 원본 Make JSON과의 차이 및 운영 주의

- 원본 필드 우선순위: `이름`, `총_채무액_선택_(2,000미만_불가)`, `거주지역을_입력해주세요`, `상담가능시간`, `문의내용_(ex.개인회생/파산_등)`. 새 Meta 양식의 별칭은 기존 호환용으로 유지합니다.
- 전화번호: 콜태그와 광고주 POST 모두 **하이픈 없는 010XXXXXXXX (11자리)**로 정규화합니다. `P:+82...`, `p:+82...`, `010-....-....` 모두 010 번호로 변환합니다. 광고주 전송 형식은 사용자가 명시한 01011111111 형식을 우선합니다.
- **현재 시트에는 거주지역 질문 열이 없는 것으로 파악됨.** Make의 실제 HTTP 200/SUCCESS 입력에는 `DATAS_area`가 아예 없습니다. 따라서 광고주 POST에는 이 키를 넣지 않으며 콜태그 내용에만 지역이 존재하면 표시합니다.
- 2026-11-11 사용자 명시 요청에 따라 운영 POST의 `ITEM`은 **항상 64**입니다. 과거의 40과 41은 차단하며 Cloudflare 환경변수 오버라이드도 무시합니다. 기존의 GET/HEAD 진단 로그에 표시되는 ITEM=64는 과거 기록으로 변경되지 않습니다.
- 기존 광고주 전송 시도 `REVIEW` 및 `SENT` 고객에 대한 자동 재전송은 없습니다. 배포만으로 기존 고객이 다시 전송되지 않습니다.
- **HTTP 403은 양식 수정만으로 해결을 보장할 수 없습니다.** GET/HEAD/무효번호를 사용한 별도 테스트에서 접근 거부가 확인됐으며, 실제 광고주 DB 접수는 별도 검증이 필요합니다.

## 서버 직접 전송만 사용

- Google Sheet → Apps Script → Cloudflare Pages Function → D1 → 광고주 API 및 CallTag의 직접 전송 경로만 사용합니다. Make 라우팅은 더 이상 지원하지 않습니다. 과거 `META_SHEETS_ADVERTISER_TRANSPORT=make` 환경 변수는 제거하는 것이 좋으며 서버에서는 이 값을 무시합니다.
- `ITEM=64`, Content-Type `application/x-www-form-urlencoded`, 6개 필드(ITEM, DATAS_name, DATAS_phone, DATAS_money, DATAS_calldate, DATAS_data), 전화번호는 숫자만 포함한 `010XXXXXXXX` 입니다.
- HTTP 403이며 응답 헤더 `cf-ray` 또는 `server: cloudflare`가 있으면 진단 로그에 `EDGE_403`을 기록합니다. 이는 광고주 측 엣지 차단의 강한 단서이지 어떤 보안 규칙이 적용되었는지의 확정 증거는 아닙니다.
- 200 HTML 및 비어 있는 응답은 성공 처리하지 않습니다. 명시적 `SUCCESS`·`OK` 또는 정해진 확인 응답이 있어야 HTTP 성공으로 기록하며 광고주 DB 실접수는 별도 확인해야 합니다.
- 동일 광고주가 Cloudflare·Google·GitHub 출발지에서 HEAD/GET도 403을 반환했던 반면 다른 외부 출발지에서는 200 SUCCESS였습니다. 출발지 차단이 확인되면 광고주 측 WAF 규칙/접근 허용 설정을 수정하거나 **사용자가 제어하는 고정 IP 서버**에서 outbound를 처리해야 합니다. User-Agent 변조나 403 자동 반복 전송으로 해결하려 하지 않습니다.
- 기존 `REVIEW` 또는 `SENT` 리드를 재전송하지 않고, 접수되지 않은 신규 리드만 큐에서 단회 처리합니다.

## 2026-11-11 Make 성공 요청 대조

- Make HTTP (legacy): POST /dbapi/, form-urlencoded, ITEM=64, **정확히 6개 필드**, HTTP 200 + 본문 SUCCESS. 광고주 전산 실접수도 사용자 확인.
- 기존 Cloudflare 구현은 DATAS_area를 포함한 7개 필드를 보내고, 전화번호를 010-xxxx-xxxx로 변경하여 Make와 전송 값이 달랐습니다. 이번 패치에서는 6개 키를 유지하면서 전화번호는 사용자가 지정한 11자리 010 숫자로만 전송합니다.
- 주의: Cloudflare / Google 서버에서 GET·HEAD도 HTTP 403을 받았으므로, **서버 출발지 차단 가능성은 여전히 존재**합니다. 페이로드를 일치시켜도 403 해결을 보장할 수 없습니다. 고객을 중복 등록하는 재전송 테스트는 수행하지 않습니다. Make 성공 사실만으로 Cloudflare 운영 전송 성공으로 기록하지 않습니다.
