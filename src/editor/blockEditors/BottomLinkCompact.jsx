import BottomLinkModeTabs from './BottomLinkModeTabs.jsx';
import BottomUrlTargetInput from './BottomUrlTargetInput.jsx';
import BottomWidgetTargetSelect from './BottomWidgetTargetSelect.jsx';
import { resolveBottomLinkTarget } from './bottomLinkTargetModel.js';

export function BottomLinkCompact({ button, page, onChange }) {
  const blocks = (page?.blocks || []).filter((block) => block.type !== 'bottombar');
  const { currentWidget, mode } = resolveBottomLinkTarget(button, blocks);

  const setMode = (next) => {
    if (next === 'url') {
      onChange({
        target: 'url',
        url: button.url && !String(button.url).startsWith('tel:') ? button.url : 'https://',
        lastWidgetTarget: currentWidget,
      });
      return;
    }

    onChange({ target: currentWidget, url: '', lastWidgetTarget: currentWidget });
  };

  return (
    <div className="bottom-link-compact bottom-link-tabs">
      <span>이동</span>
      <div className="bottom-link-controls">
        <BottomLinkModeTabs mode={mode} onChange={setMode} />

        {mode === 'widget' && (
          <BottomWidgetTargetSelect
            blocks={blocks}
            value={currentWidget}
            onChange={(target) => onChange({ target, url: '', lastWidgetTarget: target })}
          />
        )}

        {mode === 'url' && (
          <BottomUrlTargetInput
            value={button.url}
            onChange={(url) => onChange({ target: 'url', url, lastWidgetTarget: currentWidget })}
          />
        )}
      </div>
    </div>
  );
}
