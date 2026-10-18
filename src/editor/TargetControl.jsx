import { TargetModeTabs } from './TargetModeTabs.jsx';
import { TargetUrlField } from './TargetUrlField.jsx';
import { TargetWidgetSelect } from './TargetWidgetSelect.jsx';
import { changeTargetMode, getTargetControlState, TARGET_LABELS } from './targetControlModel.js';

export default function TargetControl({
  label = TARGET_LABELS.move, target, url, page, onChange,
  lastWidgetTarget, lastUrl, lastPhoneUrl,
}) {
  const { blocks, currentWidget, mode } = getTargetControlState({ page, target, lastWidgetTarget });

  const setMode = (nextMode) => {
    if (nextMode === mode) return;
    onChange(changeTargetMode({ nextMode, mode, url, lastUrl, lastPhoneUrl, currentWidget }));
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
        {(mode === 'url' || mode === 'phone') && (
          <TargetUrlField
            mode={mode}
            value={url}
            onChange={(value) => onChange({
              target: mode,
              url: value,
              lastWidgetTarget: currentWidget,
              ...(mode === 'phone' ? { lastPhoneUrl: value } : { lastUrl: value }),
            })}
          />
        )}
      </div>
    </div>
  );
}
