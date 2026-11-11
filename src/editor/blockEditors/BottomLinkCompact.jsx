import BottomLinkModeTabs from './BottomLinkModeTabs.jsx';
import BottomUrlTargetInput from './BottomUrlTargetInput.jsx';
import BottomWidgetTargetSelect from './BottomWidgetTargetSelect.jsx';
import { resolveBottomLinkTarget } from './bottomLinkTargetModel.js';
import { changeTargetMode } from '../targetControlModel.js';

export function BottomLinkCompact({ button, index, page, onChange }) {
  const blocks = (page?.blocks || []).filter((block) => block.type !== 'bottombar');
  const { currentWidget, mode } = resolveBottomLinkTarget(button, blocks);

  const setMode = (nextMode) => {
    if (nextMode === mode) return;
    onChange(changeTargetMode({
      nextMode,
      mode,
      url: button.url,
      lastUrl: button.lastUrl,
      lastPhoneUrl: button.lastPhoneUrl,
      currentWidget,
    }));
  };

  return (
    <div className="bottom-link-compact bottom-link-tabs" data-bottom-button-target-index={index}>
      <span>누르면</span>
      <div className="bottom-link-controls">
        <BottomLinkModeTabs mode={mode} onChange={setMode} />

        {mode === 'widget' && (
          <BottomWidgetTargetSelect
            blocks={blocks}
            value={currentWidget}
            onChange={(target) => onChange({ target, url: '', lastWidgetTarget: target })}
          />
        )}

        {(mode === 'url' || mode === 'phone') && (
          <BottomUrlTargetInput
            mode={mode}
            value={button.url}
            onChange={(url) => onChange({
              target: mode,
              url,
              lastWidgetTarget: currentWidget,
              ...(mode === 'phone' ? { lastPhoneUrl: url } : { lastUrl: url }),
            })}
          />
        )}
      </div>
    </div>
  );
}
