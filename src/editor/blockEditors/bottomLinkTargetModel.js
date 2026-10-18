import { getTargetControlState } from '../targetControlModel.js';
import { normalizeBottomTarget } from './bottomBarEditorModel.js';

export function resolveBottomLinkTarget(button, blocks = []) {
  const state = getTargetControlState({
    page: { blocks },
    target: button.target,
    lastWidgetTarget: button.lastWidgetTarget,
  });
  return {
    normalized: normalizeBottomTarget(button.target, blocks),
    currentWidget: state.currentWidget,
    mode: state.mode,
    invalidWidgetTarget: state.invalidWidgetTarget,
  };
}
