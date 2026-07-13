import { useEffect, useState } from 'react';
import {
  appendCustomField,
  moveCustomFieldList,
  removeCustomFieldFromList,
  updateCustomFieldList,
  updateCustomFieldOptions,
} from './reservationCustomFieldListModel.js';

export function useReservationCustomFields(customFields, setCustomFields) {
  const [dragId, setDragId] = useState('');
  const [dragOverId, setDragOverId] = useState('');
  const [openId, setOpenId] = useState(customFields[0]?.id || '');
  const [optionDrafts, setOptionDrafts] = useState({});

  useEffect(() => {
    if (openId && !customFields.some((field) => field.id === openId)) {
      setOpenId(customFields[0]?.id || '');
    }
  }, [customFields, openId]);

  const updateCustom = (id, patch) => {
    setCustomFields(updateCustomFieldList(customFields, id, patch));
  };

  const updateOptions = (id, value) => {
    setOptionDrafts((drafts) => ({ ...drafts, [id]: value }));
    setCustomFields(updateCustomFieldOptions(customFields, id, value));
  };

  const removeCustom = (id) => {
    setCustomFields(removeCustomFieldFromList(customFields, id));
  };

  const addCustom = () => {
    const next = appendCustomField(customFields);
    setCustomFields(next);
    setOpenId(next.at(-1)?.id || '');
  };

  const moveCustom = (targetId) => {
    const next = moveCustomFieldList(customFields, dragId, targetId);
    if (next !== customFields) setCustomFields(next);
  };

  const createFieldProps = (field) => ({
    isOpen: openId === field.id,
    isDragging: dragId === field.id,
    isDragOver: dragOverId === field.id,
    optionDraft: optionDrafts[field.id],
    onToggleOpen: () => setOpenId((current) => (current === field.id ? '' : field.id)),
    onUpdate: (patch) => updateCustom(field.id, patch),
    onUpdateOptions: (value) => updateOptions(field.id, value),
    onRemove: () => removeCustom(field.id),
    onDragStart: (event) => {
      setDragId(field.id);
      event.dataTransfer.setData('text/plain', field.id);
    },
    onDragOver: (event) => {
      event.preventDefault();
      setDragOverId(field.id);
    },
    onDrop: (event) => {
      event.preventDefault();
      moveCustom(field.id);
      setDragId('');
      setDragOverId('');
    },
    onDragEnd: () => {
      setDragId('');
      setDragOverId('');
    },
  });

  return { addCustom, createFieldProps };
}
