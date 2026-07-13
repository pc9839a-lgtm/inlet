import { useEffect, useId, useMemo, useState } from 'react';

export function EditorTabs({ tabs = [], defaultTab }) {
  const generatedId = useId();
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab?.id && tab?.label), [tabs]);
  const initialTab = defaultTab || visibleTabs[0]?.id || '';
  const [activeId, setActiveId] = useState(initialTab);
  const activeTab = visibleTabs.find((tab) => tab.id === activeId) || visibleTabs[0];

  useEffect(() => {
    if (activeTab && activeTab.id !== activeId) setActiveId(activeTab.id);
  }, [activeId, activeTab]);

  if (!activeTab) return null;

  return (
    <div className="editor-tabs-v2">
      {visibleTabs.length > 1 && (
        <div className="editor-tabs-v2-list" role="tablist" aria-label="편집 항목">
          {visibleTabs.map((tab) => {
            const selected = tab.id === activeTab.id;
            const tabId = `editor-tab-${generatedId}-${tab.id}`;
            const panelId = `editor-tab-panel-${generatedId}-${tab.id}`;

            return (
              <button
                key={tab.id}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        id={`editor-tab-panel-${generatedId}-${activeTab.id}`}
        className="editor-tabs-v2-panel"
        role="tabpanel"
        aria-labelledby={visibleTabs.length > 1 ? `editor-tab-${generatedId}-${activeTab.id}` : undefined}
      >
        {activeTab.content}
      </div>
    </div>
  );
}
