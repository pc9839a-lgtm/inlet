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
  const barStyle = s.bg === 'dark' ? 'dark' : s.bg === 'transparent' ? 'transparent' : 'white';
  const menuStyle = s.menuStyle || 'pill';
  const autoBarColor = barStyle === 'dark' ? '#111827' : '#ffffff';
  const autoMenuColor = menuStyle === 'text' ? '#111827' : (barStyle === 'dark' ? '#ffffff' : '#f1f5f9');
  const autoTextColor = s.logoTextColor || s.menuTextColor || (barStyle === 'dark' && menuStyle !== 'pill' ? '#ffffff' : '#111827');
  const autoMenuHoverColor = s.menuHoverColor || (menuStyle === 'pill' ? '#111827' : '#e5e7eb');
  const autoMenuHoverTextColor = s.menuHoverTextColor || (barStyle === 'dark' || menuStyle === 'pill' ? '#ffffff' : '#111827');

  const update = (id, patch) => set({ menus: menus.map((m) => m.id === id ? { ...m, ...patch } : m) });
  const setSharedTextColor = (value) => set({ logoTextColor: value, menuTextColor: value });
  const resetTopNavColors = () => set({
    barBgColor: '',
    logoTextColor: barStyle === 'dark' ? '#ffffff' : '#111827',
    menuBgColor: '',
    menuTextColor: barStyle === 'dark' && menuStyle !== 'pill' ? '#ffffff' : '#111827',
    menuHoverColor: '',
    menuHoverTextColor: menuStyle === 'pill' ? '#ffffff' : '',
  });

  const setMenuCount = (value) => {
    const count = Math.max(1, Math.min(MAX_MENU_COUNT, Number(value) || 1));
    const next = [...menus];
    while (next.length < count) next.push(makeMenu(next.length));
    set({ menus: next.slice(0, count) });
  };

  const removeMenu = (id) => {
    if (menus.length <= 1) return;
    set({ menus: menus.filter((m) => m.id !== id) });
  };

  const moveMenu = (targetId) => {
    if (!dragId || dragId === targetId) return;
    const from = menus.findIndex((m) => m.id === dragId);
    const to = menus.findIndex((m) => m.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...menus];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ menus: next });
  };

  const setBarStyle = (value) => {
    if (value === 'dark') {
      set({ bg: 'dark', logoTextColor: '#ffffff', menuBgColor: '#ffffff', menuTextColor: '#111827', menuHoverColor: '', menuHoverTextColor: '#ffffff' });
      return;
    }

    if (value === 'transparent') {
      set({ bg: 'transparent', logoTextColor: '#111827', menuBgColor: '#ffffff', menuTextColor: '#111827', menuHoverColor: '', menuHoverTextColor: '#ffffff' });
      return;
    }

    set({ bg: 'white', logoTextColor: '#111827', menuBgColor: '', menuTextColor: '#111827', menuHoverColor: '', menuHoverTextColor: '#ffffff' });
  };

  const setMenuStyle = (value) => {
    const dark = barStyle === 'dark';
    if (value === 'pill') {
      set({ menuStyle: value, menuBgColor: dark ? '#ffffff' : '', menuTextColor: '#111827', menuHoverColor: '', menuHoverTextColor: '#ffffff' });
      return;
    }

    set({ menuStyle: value, menuBgColor: '', menuTextColor: dark ? '#ffffff' : '#111827', menuHoverColor: '', menuHoverTextColor: dark ? '#ffffff' : '#111827' });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1">
        <Choice label="타입" value={s.logoType} onChange={(v) => set({ logoType: v })} options={[['text', '텍스트'], ['image', '이미지']]} />

        {isImageLogo ? (
          <ImageInput label="로고 이미지" value={s.logoImage} onChange={(v) => set({ logoImage: v })} />
        ) : (
          <Field label="로고 텍스트" value={s.logoText} onChange={(v) => set({ logoText: v })} />
        )}
      </Step>

      <Step title="메뉴" icon="2">
        <div className="topnav-menu-count">
          <Choice
            label="메뉴 개수"
            value={String(menus.length || 1)}
            onChange={setMenuCount}
            options={[['1', '1개'], ['2', '2개'], ['3', '3개'], ['4', '4개'], ['5', '5개']]}
          />
        </div>

        <div className="topnav-menu-list">
          {menus.map((m, index) => (
            <details
              key={m.id}
              className={`topnav-menu-card ${dragId === m.id ? 'dragging' : ''} ${dragOverId === m.id ? 'drag-over' : ''}`}
              draggable
              onDragStart={(event) => {
                setDragId(m.id);
                event.dataTransfer.setData('text/plain', m.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId(m.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveMenu(m.id);
                setDragId('');
                setDragOverId('');
              }}
              onDragEnd={() => {
                setDragId('');
                setDragOverId('');
              }}
            >
              <summary>
                <span className="topnav-menu-drag" title="드래그해서 순서 변경">↕</span>
                <strong>{index + 1}. {m.label || '메뉴'}</strong>
                <span className="topnav-menu-toggle">설정</span>
                <button type="button" disabled={menus.length <= 1} onClick={(event) => {
                  event.preventDefault();
                  removeMenu(m.id);
                }}>
                  삭제
                </button>
              </summary>
              <div className="mini-body">
                <Field label="메뉴명" value={m.label} onChange={(v) => update(m.id, { label: v })} />
                <TargetControl label="이동" target={m.target} url={m.url} lastWidgetTarget={m.lastWidgetTarget} page={page} onChange={(patch) => update(m.id, patch)} />
              </div>
            </details>
          ))}
        </div>
      </Step>

      <Step title="디자인" icon="3">
        <Choice label="바 스타일" value={barStyle} onChange={setBarStyle} options={[['white', '밝은 바'], ['dark', '어두운 바'], ['transparent', '투명 바']]} />
        <Choice label="메뉴 표시" value={menuStyle} onChange={setMenuStyle} options={[['pill', '버튼형'], ['text', '글자형'], ['outline', '테두리형']]} />

        <div className="top-menu-theme-row">
          <label><span>바 색상</span><input type="color" value={s.barBgColor || autoBarColor} onChange={(event) => set({ barBgColor: event.target.value })} /></label>
          <button type="button" onClick={() => set({ barBgColor: '' })}>자동</button>
        </div>
        <div className="top-menu-theme-row">
          <label><span>글씨 색상</span><input type="color" value={autoTextColor} onChange={(event) => setSharedTextColor(event.target.value)} /></label>
          <button type="button" onClick={() => setSharedTextColor(barStyle === 'dark' && menuStyle !== 'pill' ? '#ffffff' : '#111827')}>자동</button>
        </div>
        <div className="top-menu-theme-row">
          <label><span>메뉴 색상</span><input type="color" value={s.menuBgColor || autoMenuColor} onChange={(event) => set({ menuBgColor: event.target.value })} /></label>
          <button type="button" onClick={() => set({ menuBgColor: '' })}>자동</button>
        </div>

        <details className="top-menu-advanced-colors">
          <summary>고급 색상</summary>
          <div className="top-menu-theme-row">
            <label><span>오버 색상</span><input type="color" value={autoMenuHoverColor} onChange={(event) => set({ menuHoverColor: event.target.value })} /></label>
            <button type="button" onClick={() => set({ menuHoverColor: '' })}>자동</button>
          </div>
          <div className="top-menu-theme-row">
            <label><span>오버 글씨</span><input type="color" value={autoMenuHoverTextColor} onChange={(event) => set({ menuHoverTextColor: event.target.value })} /></label>
            <button type="button" onClick={() => set({ menuHoverTextColor: '' })}>자동</button>
          </div>
        </details>

        <button type="button" className="top-menu-reset-colors" onClick={resetTopNavColors}>색상 자동 맞춤</button>

        <div className="topnav-design-note">
          글씨 색상은 타이틀 로고와 메뉴 글씨에 같이 적용됩니다. 호버 색상은 필요한 경우에만 고급 색상에서 조정하세요.
        </div>
      </Step>
    </EditorStack>
  );
}
