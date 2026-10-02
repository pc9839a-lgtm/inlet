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
  requested: '관리자 확인 중',
  'pending-admin-approval': '관리자 확인 중',
  waiting_billing_clearance: '결제 정리 대기',
  approved: '승인 완료',
  rejected: '기존 소유권 유지',
  completed: '이전 완료',
  canceled: '기존 소유권 유지',
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
  return OWNERSHIP_TRANSFER_STATUS_COPY[status] || '상태 확인';
}

export function ownershipTransferBillingLabel(status = '') {
  return OWNERSHIP_TRANSFER_BILLING_LABELS[status] || '결제 확인 전';
}
