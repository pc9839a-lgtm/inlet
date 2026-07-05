import { Color, Range } from './compactControls.jsx';
import RichField from './RichField.jsx';
import TargetControl from './TargetControl.jsx';
import { generateStandaloneFormHtml } from '../lib/formEmbed.js';

function WidgetDesignControls() {
  return null;
}

export function createBlockEditorDeps(authUser) {
  return {
    Color,
    Range,
    RichField,
    TargetControl,
    WidgetDesignControls,
    generateStandaloneFormHtml,
    authUser,
  };
}