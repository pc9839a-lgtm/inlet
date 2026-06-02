import { useState } from 'react';
import { Choice, EditorStack, Field, ImageInput, Step } from '../controls.jsx';

const MAX_MENU_COUNT = 5;
const uid = () => Math.random().toString(36).slice(2, 10);
const makeMenu = (index) => ({ id: uid(), label: `메뉴 ${index + 1}`, target: 'hero', url: '' });

export default function TopNavEditor({ s, set, page, TargetControl }) {
  const [dragId, setDragId] = useState('');
  const [dragOverId, setDragOverId] = useState('');
  const menus = Array.isArray(s.menus) ? s.menus.slice(0, MAX_MENU_COUNT) : [];
  const isImageLogo = s.logoType === 'image';

  const update = (id, patch) => set({ menus: menus.map((menu) => menu.id === id ? { ...menu, ...patch } : menu) });

  const setMenuCount = (value) => {
    const count = Math.max(1, Math.min(MAX_MENU_COUNT, Number(value) || 1));
    const next = [...menus];
    while (next.length < count) next.push(makeMenu(next.length));
    set({ menus: next.slice(0, count) });
  };

  const removeMenu = (id) => {
    if (menus.length <= 1) return;
    set({ menus: menus.filter((menu) => menu.id !== id) });
  };

  const moveMenu = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = menus.findIndex((menu) => menu.id === dragId);
    const to = menus.findIndex((menu) => menu.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...menus];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ menus: next });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1">
        <Choice label="타입" value={s.logoType || 'text'} onChange={(v) => set({ logoType: v })} options={[['text', '텍스트'], ['image', '이미지']]} />
        {isImageLogo ? (
          <ImageInput label="로고 이미지" value={s.logoImage} onChange={(v) => set({ logoImage: v })} />
        ) : (
          <Field label="로고 텍스트" value={s.logoText} onChange={(v) => set({ logoText: v })} />
        )}
      </Step>

      <Step title="메뉴" icon="2">
        <Choice
          label="메뉴 개수"
          value={String(menus.length || 1)}
          onChange={setMenuCount}
          options={[['1', '1개'], ['2', '2개'], ['3', '3개'], ['4', '4개'], ['5', '5개']]}
        />

        <div className="topnav-menu-list">
          {menus.map((menu, index) => (
            <details
              key={menu.id}
              className={`topnav-menu-card ${dragId === menu.id ? 'dragging' : ''} ${dragOverId === menu.id ? 'drag-over' : ''}`}
              draggable
              onDragStart={(event) => {
                setDragId(menu.id);
                event.dataTransfer.setData('text/plain', menu.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId(menu.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveMenu(menu.id);
                setDragId('');
                setDragOverId('');
              }}
              onDragEnd={() => {
                setDragId('');
                setDragOverId('');
              }}
            >
              <summary>
                <span className="topnav-menu-drag" title="드래그해서 순서 변경">⋮⋮</span>
                <strong>{index + 1}. {menu.label || '메뉴'}</strong>
                <span className="topnav-menu-toggle">설정</span>
                <button
                  type="button"
                  disabled={menus.length <= 1}
                  onClick={(event) => {
                    event.preventDefault();
                    removeMenu(menu.id);
                  }}
                >
                  삭제
                </button>
              </summary>
              <div className="mini-body">
                <Field label="메뉴명" value={menu.label} onChange={(v) => update(menu.id, { label: v })} />
                <TargetControl label="이동" target={menu.target} url={menu.url} lastWidgetTarget={menu.lastWidgetTarget} page={page} onChange={(patch) => update(menu.id, patch)} />
              </div>
            </details>
          ))}
        </div>
      </Step>
    </EditorStack>
  );
}
