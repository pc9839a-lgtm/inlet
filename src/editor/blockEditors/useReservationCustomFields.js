import { useState } from 'react';
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
  const [optionDrafts, setOptionDrafts] = useState({});

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
    setCustomFields(appendCustomField(customFields));
  };

  const moveCustom = (targetId) => {
    const next = moveCustomFieldList(customFields, dragId, targetId);
    if (next !== customFields) setCustomFields(next);
  };

  const createFieldProps = (field) => ({
    isDragging: dragId === field.id,
    isDragOver: dragOverId === field.id,
    optionDraft: optionDrafts[field.id],
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