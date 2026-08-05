import React from 'react';
import { AddBlockDock } from './editPanelParts/AddBlockDock.jsx';
import { PageGlobalOptions } from './editPanelParts/PageGlobalOptions.jsx';
import { ScreenOrderList } from './editPanelParts/ScreenOrderList.jsx';
import '../styles/edit-panel-tabs.css';

export function EditPanelLayout({
  pageGlobalOptionsProps,
  screenOrderListProps,
  addBlockDockProps,
}) {
  const [section, setSection] = React.useState('order');

  return (
    <div className="edit-layout">
      <nav className="edit-section-tabs" aria-label="편집 영역 선택">
        <button
          className={section === 'options' ? 'active' : ''}
          type="button"
          aria-pressed={section === 'options'}
          onClick={() => setSection('options')}
        >
          페이지 옵션
        </button>
        <button
          className={section === 'order' ? 'active' : ''}
          type="button"
          aria-pressed={section === 'order'}
          onClick={() => setSection('order')}
        >
          화면 순서
        </button>
      </nav>

      <div className="edit-section-panel">
        {section === 'options' ? (
          <PageGlobalOptions {...pageGlobalOptionsProps} />
        ) : (
          <ScreenOrderList {...screenOrderListProps} />
        )}
      </div>

      <AddBlockDock {...addBlockDockProps} />
    </div>
  );
}
