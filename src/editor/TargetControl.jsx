import { TargetModeTabs } from './TargetModeTabs.jsx';
import { TargetUrlField } from './TargetUrlField.jsx';
import { TargetWidgetSelect } from './TargetWidgetSelect.jsx';
import { getSafeUrl, getTargetControlState, TARGET_LABELS } from './targetControlModel.js';

export default function TargetControl({ label = TARGET_LABELS.move, target, url, page, onChange, lastWidgetTarget }) {
  const { blocks, currentWidget, mode } = getTargetControlState({ page, target, lastWidgetTarget });

  const setMode = (next) => {
    if (next === 'url') {
      onChange({ target: 'url', url: getSafeUrl(url), lastWidgetTarget: currentWidget });
      return;
    }
    onChange({ target: currentWidget, url: '', lastWidgetTarget: currentWidget });
  };

  return (
    <div className="target-control target-control-v3">
      <div className="target-control-v3-head">
        <span className="target-title">{label}</span>
        <TargetModeTabs mode={mode} onChange={setMode} />
      </div>
      <div className="target-control-v3-body">
        {mode === 'widget' && (
          <TargetWidgetSelect
            blocks={blocks}
            currentWidget={currentWidget}
            onChange={(value) => onChange({ target: value, url: '', lastWidgetTarget: value })}
          />
        )}
        {mode === 'url' && <TargetUrlField value={url} onChange={(value) => onChange({ target: 'url', url: value, lastWidgetTarget: currentWidget })} />}
      </div>
    </div>
  );
}
