import { T } from './formEditorModel.js';

export default function FormQuestionEmptyState({ show }) {
  if (!show) return null;
  return <div className="empty">{T.noFields}</div>;
}
