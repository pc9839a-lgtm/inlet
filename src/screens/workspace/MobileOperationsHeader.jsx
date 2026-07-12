import React from 'react';
import { Smartphone } from 'lucide-react';

export function MobileOperationsHeader({ page }) {
  return (
    <header className="mobile-operations-header">
      <span className="mobile-operations-icon" aria-hidden="true"><Smartphone size={18} /></span>
      <div>
        <p>{page.title}</p>
        <h1>모바일 운영</h1>
        <span>접수 현황과 통계를 확인할 수 있습니다.</span>
      </div>
    </header>
  );
}