import { ChevronDown } from 'lucide-react';
import { Choice } from '../controls.jsx';

export default function FormSubmissionSection({ s, set }) {
  return (
    <details className="form-basic-detail form-duplicate-detail">
      <summary><strong>중복 접수</strong><ChevronDown size={16} aria-hidden="true" /></summary>
      <div>
      <Choice label="연락처" value={s.duplicatePhone || 'allow'} onChange={(value) => set({ duplicatePhone: value })} options={[[ 'allow', '허용' ], [ 'warn', '알림' ], [ 'block', '차단' ]]} />
      <Choice label="이메일" value={s.duplicateEmail || 'off'} onChange={(value) => set({ duplicateEmail: value })} options={[[ 'off', '사용 안 함' ], [ 'warn', '알림' ], [ 'block', '차단' ]]} />
      <Choice label="기준 기간" value={s.duplicateWindow || '1d'} onChange={(value) => set({ duplicateWindow: value })} options={[[ '1d', '1일' ], [ '3d', '3일' ], [ '7d', '7일' ], [ '30d', '30일' ]]} />
      </div>
    </details>
  );
}
