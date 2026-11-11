# 개인회생 Meta 리드: Apps Script 최소 릴레이 + Cloudflare 처리

## 최종 아키텍처

Meta 인스턴트 양식 → Google Sheets (시트1, A:R) → **Apps Script 74줄 릴레이** → **Cloudflare Pages Function + D1** → (1) 콜태그 고객 DB (2) 광고주 API.

- Apps Script는 신규 행을 HTTPS로 Cloudflare에 **전달만** 합니다. 전화번호 변환, 업체 API 전송, 콜태그 등록 및 재시도는 하지 않습니다.
- Cloudflare는 Meta ID로 중복을 차단하고 D1에 접수한 뒤, 각 목적지의 전송 상태를 분리 관리합니다.
- 콜태그는 기존 Webhook 식별 키로 수신 계정 소유자를 조회해 **기존 범용 리드 저장 함수를 호출**하므로 앱 패치나 별도 Webhook 필드 매핑이 필요하지 않습니다.
- 광고주에게는 업로드된 Make 블루프린트 기준 HTTPS POST + application/x-www-form-urlencoded, ITEM=41(기본값), 7개 필드를 원본 순서대로 전송. META_SHEETS_ADVERTISER_ITEM 환경변수가 설정되면 해당 값이 우선합니다. 새로운 캠페인에 41을 임의 적용하지 마세요.
- 콜태그 실패는 최대 3회 재시도. 광고주는 원본 Make 설정과 같이 리다이렉트를 따라가고 최종 HTTP 2xx를 전송 성공으로 표시하되, 명시적 실패 내용은 REVIEW로 분류합니다. `SENT`는 HTTP 수락 기록이지 광고주 전산 등록을 증명하지 않습니다. 불확실한 전송은 자동 재시도하지 않습니다.
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
- META_SHEETS_ADVERTISER_ITEM: 기본 41 (원본 Make 블루프린트), 설정된 환경변수가 기본값보다 우선합니다.

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
- 광고주: 정확히 ITEM, DATAS_name, DATAS_phone, DATAS_money, DATAS_area, DATAS_calldate, DATAS_data 필드로 POST. 원본과 같이 followRedirect 활성화. 최종 HTTP 2xx이며 명시적 거부가 아닌 경우 SENT(HTTP 전송 단계만 수락), 그 외 REVIEW.
- 이미 받은 ID는 INSERT OR IGNORE로 무시됩니다.
- 한 번에 최대 5행. 1분 주기 스크립트가 새 리드를 전달하고 서버에 재처리 신호를 보냅니다.
- 콜태그 도중 중단된 상태는 3분 뒤 재시도. 광고주 전송 도중 중단은 REVIEW로 표시해 중복을 방지합니다.
- 시트 오른쪽에 앞서 추가된 상태 열은 이 설계에서 사용하지 않습니다. 실제 전송 상태는 서버 D1에서 관리합니다.

## 테스트

node --test integrations/meta-lead-sheets-dual-delivery/bridge.test.mjs

GAS 코드는 사용자가 구글시트에 수동으로 붙여넣어야 합니다. GitHub PR만으로 Google Apps Script를 자동 설치할 수 없습니다. 이 구현은 실고객 정보 전송·외부 광고주 API 실접수 검증을 아직 하지 않았습니다.

## 원본 Make JSON과의 차이 및 운영 주의

- 원본 필드 우선순위: `이름`, `총_채무액_선택_(2,000미만_불가)`, `거주지역을_입력해주세요`, `상담가능시간`, `문의내용_(ex.개인회생/파산_등)`. 새 Meta 양식의 별칭은 기존 호환용으로 유지합니다.
- 전화번호: `P:+821012345678` 또는 `P:01012345678` → `010-1234-5678`. 원본에서 GPT가 맡던 결과 형식을 결정적 코드로 구현했습니다.
- **현재 시트에는 거주지역 질문 열이 없는 것으로 파악됨.** 원본 JSON과 같은 요청 필드 자체는 전송하지만 실제 데이터가 없으면 `DATAS_area` 값은 비어 있습니다. 거주지역을 임의 생성하지 않습니다. 서버 진단 로그에 누락 필드명을 기록합니다.
- 원본의 `ITEM=41`은 2026년 8월 당시 값이고, 이후 운영 캠페인 `64`는 구분해야 합니다. 배포된 Cloudflare 환경변수 `META_SHEETS_ADVERTISER_ITEM`의 실제 설정값에 따라 운영 요청 ITEM은 달라집니다.
- 기존 광고주 전송 시도 `REVIEW` 및 `SENT` 고객에 대한 자동 재전송은 없습니다. 배포만으로 기존 고객이 다시 전송되지 않습니다.
- **HTTP 403은 양식 수정만으로 해결을 보장할 수 없습니다.** GET/HEAD/무효번호를 사용한 별도 테스트에서 접근 거부가 확인됐으며, 실제 광고주 DB 접수는 별도 검증이 필요합니다.
