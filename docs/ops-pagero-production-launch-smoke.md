# PageRo production 신규 사용자 launch smoke

목적: beta 오픈 전 실제 운영 환경에서 신규 사용자 핵심 흐름을 한 번 연속 검증한다.

## 실행 금지 조건

아래 조건을 모두 만족하기 전에는 실행하지 않는다.

- production 실행에 대한 명시적 승인
- smoke 전용 신규 이메일과 신규 휴대전화 준비
- 실제 인증메일 수신 가능
- 운영 중 사용자 데이터와 겹치지 않는 전용 테스트 값 사용
- 결과 기록 담당자가 즉시 확인 가능

이 runbook은 자동으로 운영 쓰기를 실행하지 않는다. 계정 생성, 페이지 저장, 문의 생성은 실제 production D1 write다.

## 고정 시나리오

1. https://pagero.kr 에서 신규 회원가입 시작
2. smoke 전용 이메일로 6자리 인증메일 요청
3. 실제 수신한 6자리 코드 입력
4. 신규 계정 회원가입 완료
5. 로그아웃 후 동일 계정으로 다시 로그인
6. 첫 페이지 생성
7. 실제 제공 템플릿 중 `quote-request` 선택
8. 첫 번째 주요 제목을 `PAGERO LAUNCH SMOKE <timestamp>` 로 수정
9. 발행/저장 완료
10. 공개 URL을 새 창에서 열어 수정 문구가 보이는지 확인
11. 공개 페이지 폼에서 고유 테스트 문의 1건 제출
12. 편집기/운영 화면의 접수함에서 동일 문의가 보이는지 확인
13. 문의 1건 삭제
14. 테스트 페이지 삭제/보관 처리
15. 공개 URL이 더 이상 활성 페이지로 노출되지 않는지 확인

## 성공 증빙

한 번의 실행 기록에는 아래를 남긴다.

- 실행 시각 KST
- 검증한 main SHA
- 신규 계정 이메일은 마스킹된 형태만 기록
- 이메일 인증 성공
- 재로그인 성공
- 첫 페이지 생성 성공
- template id: `quote-request`
- 수정 문구와 최종 page revision
- 공개 URL 응답 성공
- 문의 제출 성공
- 접수함 readback 성공
- 문의 cleanup 성공
- 페이지 cleanup 성공
- 브라우저 console error 0 여부

인증코드, 비밀번호, session token, 전체 전화번호는 증빙에 남기지 않는다.

## 실패 판정

아래 중 하나라도 발생하면 beta launch gate는 실패다.

- 인증메일 미도착 또는 코드 확인 실패
- 회원가입 후 재로그인 실패
- 첫 페이지 생성 실패
- 템플릿 선택 후 저장 실패
- 저장 후 공개 페이지가 최신 revision을 반영하지 않음
- 공개 문의는 성공했는데 접수함에서 찾을 수 없음
- 테스트 문의/페이지 cleanup 실패
- 정상 사용자 흐름에서 blocking console error 발생

실패 시 다음 단계로 넘어가지 않고 실패 구간만 별도 패치한다.

## 현재 상태

- B0 maintenance cleanup: 완료
- B1 production save deployment gate: 완료
- B2 Revision restore ↔ Undo/Redo: 완료
- B4 개인도메인/웹결제 beta 표기: 완료
- B3 신규 사용자 production launch smoke: 실제 실행만 남음
