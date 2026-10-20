import { useEffect, useId, useMemo, useRef, useState } from 'react';

export function EditorTabs({ tabs = [], defaultTab }) {
  const generatedId = useId();
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab?.id && tab?.label), [tabs]);
  const initialTab = defaultTab || visibleTabs[0]?.id || '';
  const [activeId, setActiveId] = useState(initialTab);
  const tabRefs = useRef(new Map());
  const previousActiveId = useRef(initialTab);
  const activeTab = visibleTabs.find((tab) => tab.id === activeId) || visibleTabs[0];

  useEffect(() => {
    if (activeTab && activeTab.id !== activeId) setActiveId(activeTab.id);
  }, [activeId, activeTab]);

  useEffect(() => {
    const previous = previousActiveId.current;
    previousActiveId.current = activeTab?.id;
    if (!activeTab || previous === activeTab.id || typeof document === 'undefined') return;
    const focused = document.activeElement;
    if (!focused || focused === document.body || focused === document.documentElement || !focused.isConnected) {
      tabRefs.current.get(activeTab.id)?.focus?.({ preventScroll: true });
    }
  }, [activeTab?.id]);

  const onTabKeyDown = (event, index) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? visibleTabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    const next = visibleTabs[nextIndex];
    setActiveId(next.id);
    tabRefs.current.get(next.id)?.focus?.({ preventScroll: true });
  };

  if (!activeTab) return null;

  return (
    <div className="editor-tabs-v2">
      {visibleTabs.length > 1 && (
        <div className="editor-tabs-v2-list" role="tablist" aria-label="편집 항목">
          {visibleTabs.map((tab, index) => {
            const selected = tab.id === activeTab.id;
            const tabId = `editor-tab-${generatedId}-${tab.id}`;
            const panelId = `editor-tab-panel-${generatedId}-${tab.id}`;

            return (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.id, node);
                  else tabRefs.current.delete(tab.id);
                }}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
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
        tabIndex={0}
        aria-labelledby={visibleTabs.length > 1 ? `editor-tab-${generatedId}-${activeTab.id}` : undefined}
      >
        {activeTab.content}
      </div>
    </div>
  );
}
