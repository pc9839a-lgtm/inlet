import { makeCustomField, splitOptions } from './reservationEditorModel.js';

export function updateCustomFieldList(customFields, id, patch) {
  return customFields.map((field) => (field.id === id ? { ...field, ...patch } : field));
}

export function updateCustomFieldOptions(customFields, id, value) {
  return updateCustomFieldList(customFields, id, { options: splitOptions(value) });
}

export function removeCustomFieldFromList(customFields, id) {
  return customFields.filter((field) => field.id !== id);
}

export function appendCustomField(customFields) {
  return [...customFields, makeCustomField()];
}

export function moveCustomFieldList(customFields, dragId, targetId) {
  if (!dragId || dragId === targetId) return customFields;
  const from = customFields.findIndex((field) => field.id === dragId);
  const to = customFields.findIndex((field) => field.id === targetId);
  if (from < 0 || to < 0) return customFields;

  const next = [...customFields];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}