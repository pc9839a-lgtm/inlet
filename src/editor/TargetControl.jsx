import { META } from '../config/blockMeta.jsx';
import { Field } from './controls.jsx';

function normalizeTarget(target, blocks = []) {
  if (!target) return blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  if (String(target).startsWith('block:')) {
    const id = String(target).replace('block:', '');
    return blocks.some((b) => b.id === id) ? String(target) : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
  }
  if (target === 'url' || target === 'phone') return target;
  const byType = blocks.find((b) => b.type === target);
  return byType ? `block:${byType.id}` : (blocks[0]?.id ? `block:${blocks[0].id}` : 'hero');
}

export default function TargetControl({ label = '이동', target, url, page, onChange, lastWidgetTarget }) {
  const blocks = (page?.blocks || []).filter((b) => b.type !== 'bottombar');
  const normalized = normalizeTarget(target, blocks);
  const savedWidget = normalizeTarget(lastWidgetTarget, blocks);
  const first = blocks[0]?.id ? `block:${blocks[0].id}` : 'hero';
  const currentWidget = normalized.startsWith('block:') ? normalized : (savedWidget.startsWith('block:') ? savedWidget : first);
  const mode = normalized.startsWith('block:') || (!['url', 'phone'].includes(target || '')) ? 'widget' : target;

  const setMode = (next) => {
    if (next === 'url') {
      onChange({
        target: 'url',
        url: url && !String(url).startsWith('tel:') ? url : 'https://',
        lastWidgetTarget: currentWidget,
      });
      return;
    }

    if (next === 'phone') {
      onChange({
        target: 'phone',
        url: url && String(url).startsWith('tel:') ? url : 'tel:01000000000',
        lastWidgetTarget: currentWidget,
      });
      return;
    }

    onChange({ target: currentWidget, url: '', lastWidgetTarget: currentWidget });
  };

  return (
    <div className="target-control target-control-tabs">
      <span className="target-title">{label}</span>
      <div className="target-mode-tabs">
        {[['widget', '위젯'], ['url', '링크'], ['phone', '전화']].map(([key, text]) => (
          <button key={key} type="button" className={mode === key ? 'active' : ''} onClick={() => setMode(key)}>{text}</button>
        ))}
      </div>

      {mode === 'widget' && (
        <label className="field field-option target-field">
          <span>이동할 위젯</span>
          <select
            value={currentWidget}
            onChange={(e) => onChange({ target: e.target.value, url: '', lastWidgetTarget: e.target.value })}
          >
            {blocks.map((b, idx) => {
              const meta = META[b.type] || META.text;
              return <option key={b.id} value={`block:${b.id}`}>{idx + 1}. {meta.label} #{b.s?.anchorId || b.type}</option>;
            })}
          </select>
        </label>
      )}

      {mode === 'url' && <Field label="링크 URL" value={url} onChange={(v) => onChange({ target: 'url', url: v, lastWidgetTarget: currentWidget })} />}
      {mode === 'phone' && <Field label="전화 링크" value={url} onChange={(v) => onChange({ target: 'phone', url: v, lastWidgetTarget: currentWidget })} />}
    </div>
  );
}
