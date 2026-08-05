# CallTag 보안 동기화 P1 서버 계약

최종 갱신: 2026-08-05

이 문서는 암호화 동기화 P0 이후 추가한 재설치 복구, 기기 관리, 운영 로그 보관기간 정리 계약을 기록한다. Google 로그인과 Android 동기화 Worker 구현은 별도 범위다.

## 1. 운영 상태

다음 값은 계속 기본 OFF다.

```text
CALLTAG_SECURE_SYNC_ENABLED=0
CALLTAG_SYNC_RETENTION_ENABLED=0
```

운영 D1 migration과 암호화 secret이 준비되기 전에는 고객 데이터 저장 API가 열리지 않는다. 보관기간 정리 endpoint도 별도 flag와 별도 secret이 없으면 사용할 수 없다.

## 2. 재설치 전체 복구 bootstrap

Endpoint:

```text
GET /api/calltag-sync/bootstrap
```

필수 헤더:

```text
X-Inlet-Session
X-CallTag-Device
X-CallTag-Device-Label
X-CallTag-App-Version
```

첫 요청 예시:

```text
GET /api/calltag-sync/bootstrap?limit=100
```

다음 페이지 예시:

```text
GET /api/calltag-sync/bootstrap
  ?limit=100
  &afterType=customer
  &afterId=customer-000100
  &snapshotCursor=824
```

응답 핵심:

```json
{
  "ok": true,
  "snapshotCursor": 824,
  "items": [],
  "nextAfter": {
    "entityType": "customer",
    "entityId": "customer-000100"
  },
  "complete": false,
  "followUp": null
}
```

마지막 페이지에서는 다음처럼 후속 pull 기준을 준다.

```json
{
  "complete": true,
  "followUp": {
    "endpoint": "/api/calltag-sync/pull",
    "cursor": 824
  }
}
```

### 복구 순서

1. 첫 페이지에서 받은 `snapshotCursor` 저장
2. `nextAfter`를 사용해 전체 레코드 페이지 반복
3. 서버 레코드를 임시 DB 또는 복구 transaction에 적용
4. 마지막 페이지 완료 후 `pull?cursor=snapshotCursor` 실행
5. bootstrap 도중 발생한 신규 변경을 증분 pull로 보완
6. 적용과 무결성 확인이 모두 끝난 뒤 로컬 DB를 정상 사용 상태로 전환
7. 복구 완료 전 자동문자와 예약문자 실행 금지

### 보안 규칙

- owner는 요청값이 아니라 로그인 세션에서 결정
- 모든 조회에 `owner_id` 조건
- 활성 레코드만 서버에서 복호화
- 삭제 tombstone은 payload 없이 전달
- 한 페이지 최대 100건
- 계정·기기별 rate limit
- 응답과 로그에 암호화키·세션·전화번호 검색 HMAC 노출 금지

## 3. 기기 목록과 원격 해제

Endpoint:

```text
GET  /api/calltag-sync/devices
POST /api/calltag-sync/devices
```

목록 응답에는 다음만 포함한다.

- HMAC 기반 opaque `deviceKey`
- 사용자가 확인할 기기 label
- 앱 버전
- 최초·최근 접속 시각
- 활성·해제 상태
- 현재 기기 여부

휴대폰에서 생성한 원본 device ID는 서버 응답이나 DB에 저장하지 않는다.

원격 해제 요청:

```json
{
  "deviceKey": "<64자리 hex opaque key>",
  "confirmation": "REVOKE_CALLTAG_SYNC_DEVICE"
}
```

규칙:

- 대상 row는 반드시 현재 owner 소유여야 함
- 현재 기기는 해당 endpoint에서 해제할 수 없음
- 이미 해제됐거나 다른 계정의 기기는 404 처리
- 해제된 동일 device ID는 다시 접근해도 `CALLTAG_SYNC_DEVICE_REVOKED`
- 해제는 고객 데이터를 삭제하지 않고 해당 기기의 이후 동기화만 차단

## 4. 운영 로그 보관기간 정리

Endpoint:

```text
POST /api/calltag-sync/retention
```

필수 조건:

```text
CALLTAG_SYNC_RETENTION_ENABLED=1
CALLTAG_SYNC_RETENTION_SECRET=<32자 이상 별도 secret>
X-CallTag-Sync-Retention-Secret: <same secret>
```

기본은 dry-run이다.

```json
{
  "dryRun": true
}
```

실제 실행은 다음 확인값이 필요하다.

```json
{
  "dryRun": false,
  "confirmation": "PURGE_CALLTAG_OPERATIONAL_LOGS"
}
```

현재 정리 대상:

- 기본 180일이 지난 익명화 보안 이벤트
- 기본 3일이 지난 rate-limit window

현재 정리 금지:

- 고객 암호문
- 상담·메모·일정 레코드
- sync changes
- 삭제 tombstone
- 등록·해제된 기기 row

### 고객 데이터와 tombstone을 정리하지 않는 이유

현재 Android 클라이언트는 아직 stale cursor와 오래된 오프라인 기기의 재업로드를 처리하지 않는다. 삭제 tombstone을 일찍 없애면 오래된 기기가 삭제된 고객을 다시 업로드할 수 있다. 따라서 다음이 구현되기 전에는 tombstone·changes 자동 삭제를 금지한다.

1. bootstrap 완료 후 server-authoritative 교체 규칙
2. push 요청의 client cursor 또는 generation 검증
3. 너무 오래된 cursor에 `FULL_BOOTSTRAP_REQUIRED` 반환
4. 기기별 마지막 적용 cursor 저장
5. tombstone retention보다 오래 오프라인인 기기 재인증 또는 bootstrap 강제

## 5. Android 후속 구현

1. Keystore로 보호된 임의 device ID
2. `GET /devices` 화면
3. 다른 기기 원격 해제
4. 첫 로그인·재설치 시 bootstrap
5. bootstrap 임시 저장과 transaction 적용
6. snapshot cursor 이후 pull
7. 복구 완료 전 자동문자 차단
8. 마지막 동기화·복구 상태 표시
9. `CALLTAG_SYNC_DEVICE_REVOKED` 수신 시 세션·동기화 중단
10. 사용자가 명시적으로 로그아웃할 때 현재 기기 처리

## 6. 운영 활성화 전 테스트

- 계정 A가 계정 B의 deviceKey를 해제하지 못함
- 현재 기기 해제 차단
- 해제 기기의 push·pull·bootstrap 차단
- 100건 이상 bootstrap 페이지 이동
- bootstrap 중 데이터 추가·수정·삭제 후 snapshot cursor pull
- 암호문 변조 시 복구 중단
- 잘못된 owner AAD 복호화 실패
- retention 기본 dry-run에서 삭제 0건
- 잘못된 retention secret 차단
- retention 실제 실행이 고객·changes·tombstone을 건드리지 않음
- 기능 flag 0에서 모든 고객 데이터 endpoint 503
