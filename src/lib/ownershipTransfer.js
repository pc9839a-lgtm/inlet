export const OWNERSHIP_TRANSFER_STATUS_LABELS = {
  requested: '승인 대기',
  'pending-admin-approval': '승인 대기',
  waiting_billing_clearance: '결제 정리 대기',
  approved: '승인됨',
  rejected: '거절됨',
  completed: '이전 완료',
  canceled: '취소됨',
};

export const OWNERSHIP_TRANSFER_STATUS_COPY = {
  requested: '내부 관리자가 요청을 확인 중입니다.',
  'pending-admin-approval': '내부 관리자가 요청을 확인 중입니다.',
  waiting_billing_clearance: '기존 결제 만료 또는 해지 확인 후 다음 단계로 진행합니다.',
  approved: '승인되었습니다. 결제 정리가 끝나면 이전 완료 처리합니다.',
  rejected: '요청이 거절되었습니다. 기존 소유권은 유지됩니다.',
  completed: '소유권이 새 계정으로 이전되었습니다.',
  canceled: '요청이 취소되었습니다. 기존 소유권은 유지됩니다.',
};

export const OWNERSHIP_TRANSFER_BILLING_LABELS = {
  not_checked: '결제 확인 전',
  clear: '결제 정리 완료',
  active_subscription: '결제 유지 중',
  past_due: '결제 확인 필요',
};

export function ownershipTransferStatusLabel(status = '') {
  return OWNERSHIP_TRANSFER_STATUS_LABELS[status] || '상태 확인 필요';
}

export function ownershipTransferStatusCopy(status = '') {
  return OWNERSHIP_TRANSFER_STATUS_COPY[status] || '요청 상태를 다시 확인하세요.';
}

export function ownershipTransferBillingLabel(status = '') {
  return OWNERSHIP_TRANSFER_BILLING_LABELS[status] || '결제 확인 전';
}
