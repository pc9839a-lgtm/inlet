import { T } from './formEditorText.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export const questionLabels = {
  name: T.name,
  phone: T.phone,
  email: T.email,
  address: T.address,
  short: T.short,
  long: T.long,
  select: T.select,
  multi: T.multi,
};

export const quickQuestionTypes = [
  ['name', T.name],
  ['phone', T.phone],
  ['email', T.email],
  ['long', T.message],
  ['short', T.short],
  ['select', T.select],
];

export function createFormQuestion(patch = {}) {
  return {
    id: uid(),
    label: patch.label || T.newItem,
    type: patch.type || 'short',
    required: patch.required ?? false,
    placeholder: patch.placeholder || '',
    options: patch.options || [],
  };
}

export function duplicateFormQuestion(question) {
  return {
    ...question,
    id: uid(),
    label: (question.label || T.item) + ' ' + T.copy,
  };
}

export function questionTypeLabel(type) {
  return questionLabels[type] || T.item;
}
