# Meta 잠재고객 → Google Sheets → 광고주 API + 콜태그

앱 APK/Play Store 변경 없이 **Google Sheet에 추가되는 신규 행**을 두 군데로 전송하는 Google Apps Script입니다.

**주의:** 아직 Apps Script에 설치되지 않은 개발 코드입니다. GitHub 반영만으로 작동하지 않으며, 외부 고객정보 전송은 비활성 상태가 기본값입니다.

## 구성
- 콜태그: 앱의 더보기 → 외부 문의 연동 → Webhook 만들기에서 발급한 HTTPS URL로 JSON POST
- 광고주: ITEM=64와 DATAS_*를 form-urlencoded POST로 전송
- 1분 간격 시간 기반 트리거 (시트 외부 연동으로 기록된 행은 onEdit 트리거가 실행되지 않을 수 있음)
- 목적지별 독립 상태/중복 확인/실패 기록
- 콜태그만 제한적 자동 재시도, 광고주는 응답 불명확 시 담당자 검토 후 수동 재시도
- 설치 전 기존 행은 SKIPPED_OLD 처리, 자동 재전송하지 않음

## 1. 설치
1. 실제 Meta 잠재고객이 들어오는 Google Sheet를 엽니다. 확장 프로그램 → Apps Script 선택.
2. Code.gs 내용을 붙여넣고 저장.
3. Apps Script 프로젝트 설정의 스크립트 속성에 아래 값을 입력. 비밀 URL은 소스 코드/시트에 쓰지 마세요.
4. 함수 installLeadBridge를 한 번 실행하고 권한 승인. 기존 행 제외 처리와 1분 트리거 등록만 하고 실제 전송은 하지 않습니다.
5. 콜태그 Webhook 필드 매핑, 광고주 HTTPS/성공 응답 형식, 테스트 행을 확인합니다.
6. 함수 enableLeadBridge를 실행해야 그때부터 **신규 행** 전송을 시작합니다. 중단은 disableLeadBridge입니다.

## 2. 스크립트 속성
- LEADS_SHEET_NAME: 실제 데이터 탭 이름. 없으면 첫 번째 탭.
- SPREADSHEET_ID: 선택. 시트 연결 Apps Script라면 생략.
- CALLTAG_WEBHOOK_URL: 앱에서 발급된 전체 HTTPS Webhook URL. 반드시 /api/calltag/v1/hooks/ctwh_... 구조.
- ADVERTISER_URL: 광고주가 실제 지원한다고 검증한 HTTPS DB API 주소. 제시받은 http://ollymkt.shop/dbapi/는 **그대로 사용 금지**. https://ollymkt.shop/dbapi/의 작동 여부도 아직 미확인.
- ADVERTISER_ITEM: 64 (생략해도 기본값 64).
- FIELD_MAP_JSON: 선택. 실제 시트의 열 제목과 기본 매핑이 다르면 설정. 예:
    {"event_id":"Lead ID","name":"고객 성함","phone":"핸드폰 번호","money":"채무 총액","data":"상담 요청"}

## 3. 콜태그 Webhook 매핑
이 Apps Script가 보내는 JSON 필드와 앱 Webhook 매핑을 연결합니다.
- 이름 /name
- 전화번호 /phone (**필수**)
- 문의내용 /content
- 이메일 /email
- 외부 접수번호 /event_id
- 접수일시 /submitted_at

콜태그가 HTTP 202를 반환하더라도 JSON status가 MAPPING_REQUIRED라면 실제 고객 등록이 아닙니다. status=MAPPED 이고 eventId가 있어야 성공 처리합니다. 앱에서 먼저 Webhook을 만들고 필드 매핑을 완료해야 합니다.

## 4. 지원하는 시트 원본 열
lead_id / 성함 / 연락처 / 이메일 / 직업 / 거주지역 / 채무금액 / 상담가능시간 / 나이 / 문의내용 / 업종 / 유입경로 / 접수인아이디 / 공간유형 / 건물유형 / 시공유형 / 평수 / 예산 / 일정 / 주소 / 나머지주소 / 소득 / created_time. 영문 이름과 DATAS_* 이름도 다수 인식합니다.

시트의 1행에 헤더가 있어야 하고, 연락처 열은 필수입니다. Meta 전용 질문 열이 다를 때 FIELD_MAP_JSON으로 명시하세요. 리드 고유번호가 없다면 CT_EVENT_ID 열에 UUID를 자동 저장합니다.

## 5. 스크립트가 추가하는 열
CT_상태 / CT_시도 / CT_최종시도 / CT_결과 / 광고주_상태 / 광고주_시도 / 광고주_최종시도 / 광고주_결과 / CT_EVENT_ID.

- SENT: 실제 수신 성공 확인.
- RETRY: 콜태그 일시 오류, 최대 3번 재시도.
- ERROR: 전화번호/매핑 실패 또는 재시도 초과. 자동 재전송하지 않음.
- REVIEW: 광고주 수신 여부가 불명확. 자동 재전송하지 않음.
- SENDING: 전송 시작 후 처리가 중단된 경우 계속 남을 수 있으므로 담당자 확인 필요.
- SKIPPED_OLD: 스크립트 설치 전 기존 행. 전송하지 않음.

광고주 수신 여부를 먼저 확인한 뒤, 수동으로 다시 보낼 행에서 retryLeadBridgeRow(행번호, 'AD')를 호출합니다. 콜태그는 retryLeadBridgeRow(행번호, 'CT')입니다. 인자를 받는 함수를 실행하려면 Apps Script에 별도 인자 없는 래퍼 함수를 만들어 실행하세요.

## 6. 실제 적용 전 필수 확인
1. 광고주 응답 규격은 제공되지 않았습니다. HTTP 200만으로 성공으로 판단하지 않고, ok=true, success=true, SUCCESS/OK/1 같은 명시적인 응답만 SENT 처리합니다. 알 수 없는 응답은 REVIEW로 남겨 운영자 확인이 필요합니다.
2. 광고주 API 문서는 HTTP만 제시합니다. 고객 이름, 연락처, 채무, 소득 등을 일반 HTTP로 전송하면 안 됩니다. HTTPS 지원을 확인하기 전까지 실제 적용을 보류합니다.
3. 콜태그 Webhook은 URL 자체가 인증 비밀에 해당하므로 공개 저장소/시트/로그에 넣지 말 것.
4. 고객정보의 광고주 제3자 제공 및 목적 내 이용에 필요한 동의가 갖춰졌는지 확인할 것.
5. 이전 리드가 아닌 신규 리드만 처리합니다. 원본 Google Sheet, 콜태그 Webhook, 광고주 서버를 모두 연결한 실전 테스트는 아직 하지 않았습니다.

## 7. 검증
운영 서버를 호출하지 않는 스크립트 가상 테스트는 별도 bridge.test.mjs에 포함할 예정입니다.
