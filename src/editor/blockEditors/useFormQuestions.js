import { useState } from 'react';
// The form editor intentionally changes its React position when desktop and
// laptop layouts switch. Remember only the open card, keyed to the exact page
// and form block; no content, answers, or unsaved draft values are cached.
const openedQuestionByForm = new Map();
const MAX_REMEMBERED_FORMS = 100;

import {
  createQuestionByType,
  duplicateQuestionInList,
  moveDraggedQuestionList,
  moveQuestionInList,
  removeQuestionFromList,
  updateQuestionList,
} from './formQuestionListModel.js';

export function useFormQuestions({ questions, set, persistKey = '' }) {
  const [openQuestionId, setOpenQuestionId] = useState(() => {
    const remembered = persistKey ? openedQuestionByForm.get(persistKey) : '';
    return questions.some((question) => question.id === remembered) ? remembered : '';
  });
  const selectOpenQuestion = (id) => {
    if (persistKey) {
      openedQuestionByForm.delete(persistKey);
      if (id) {
        openedQuestionByForm.set(persistKey, id);
        if (openedQuestionByForm.size > MAX_REMEMBERED_FORMS) {
          openedQuestionByForm.delete(openedQuestionByForm.keys().next().value);
        }
      }
    }
    setOpenQuestionId(id);
  };
  const [dragQuestionId, setDragQuestionId] = useState('');
  const [dragOverQuestionId, setDragOverQuestionId] = useState('');

  const updateQuestion = (id, patch) => set({ questions: updateQuestionList(questions, id, patch) });

  const removeQuestion = (id) => {
    const next = removeQuestionFromList(questions, id);
    set({ questions: next });
    if (openQuestionId === id) selectOpenQuestion(next[0]?.id || '');
  };

  const duplicateQuestion = (question) => {
    const { copy, questions: next } = duplicateQuestionInList(questions, question);
    set({ questions: next });
    selectOpenQuestion(copy.id);
  };

  const moveQuestionByDrag = (targetId) => {
    const next = moveDraggedQuestionList(questions, dragQuestionId, targetId);
    if (next === questions) return;
    set({ questions: next });
    setDragOverQuestionId(targetId);
  };

  const moveQuestion = (id, direction) => {
    const next = moveQuestionInList(questions, id, direction);
    if (next !== questions) set({ questions: next });
  };

  const addQuestion = (type = 'short') => {
    const question = createQuestionByType(type);
    set({ questions: [...questions, question] });
    selectOpenQuestion(question.id);
  };

  return {
    openQuestionId,
    dragQuestionId,
    dragOverQuestionId,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    moveQuestion,
    toggleQuestionOpen: (id) => selectOpenQuestion(openQuestionId === id ? '' : id),
    moveQuestionByDrag,
    startQuestionDrag: (id) => {
      setDragQuestionId(id);
      setDragOverQuestionId(id);
    },
    dropQuestion: (event) => {
      event.preventDefault();
      setDragOverQuestionId('');
    },
    endQuestionDrag: () => {
      setDragQuestionId('');
      setDragOverQuestionId('');
    },
  };
}
