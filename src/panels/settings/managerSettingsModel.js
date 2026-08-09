import { MANAGER_PERMISSION_TABS } from '../../lib/authContext.js';

export const MANAGER_TAB_LABELS = {
  edit: '편집',
  style: '스타일',
  inbox: '접수함',
  stats: '통계',
  settings: '설정',
};

export const MANAGER_ACCESS_PRESETS = [
  {
    id: 'admin',
    label: '관리자',
    description: '모든 메뉴 보기·편집',
    access: {
      edit: { read: true, write: true },
      style: { read: true, write: true },
      inbox: { read: true, write: true },
      stats: { read: true, write: true },
      settings: { read: true, write: true },
    },
  },
  {
    id: 'editor',
    label: '콘텐츠 관리자',
    description: '페이지 편집과 스타일 관리',
    access: {
      edit: { read: true, write: true },
      style: { read: true, write: true },
      inbox: { read: false, write: false },
      stats: { read: false, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'lead',
    label: '문의 관리자',
    description: '접수 관리와 통계 조회',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: true },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
  {
    id: 'viewer',
    label: '조회 전용',
    description: '접수와 통계 보기만 허용',
    access: {
      edit: { read: false, write: false },
      style: { read: false, write: false },
      inbox: { read: true, write: false },
      stats: { read: true, write: false },
      settings: { read: false, write: false },
    },
  },
];

export function managerLabel(manager) {
  return manager.name || manager.email || '새 매니저';
}

export function managerAccessSummary(manager) {
  const access = manager.access || {};
  const editable = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  const viewOnly = MANAGER_PERMISSION_TABS.filter((tab) => access[tab]?.read && !access[tab]?.write).map((tab) => MANAGER_TAB_LABELS[tab]);
  if (manager.status !== 'active') return '비활성';
  if (editable.length === MANAGER_PERMISSION_TABS.length) return '관리자';
  if (editable.length) return `편집 ${editable.join(', ')}`;
  if (viewOnly.length) return `보기 ${viewOnly.join(', ')}`;
  return '권한 없음';
}

export function managerInviteState(manager, inviteUrl = '') {
  if (manager.acceptedAt) return '가입 완료';
  if (inviteUrl) return '초대 대기';
  return '초대 전';
}
