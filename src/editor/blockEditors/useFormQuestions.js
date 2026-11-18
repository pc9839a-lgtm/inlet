import { useState } from 'react';
import {
  createQuestionByType,
  duplicateQuestionInList,
  moveDraggedQuestionList,
  moveQuestionInList,
  removeQuestionFromList,
  updateQuestionList,
} from './formQuestionListModel.js';

// The responsive workspace moves its active widget between DOM regions.
// Remember only the expanded card, not data or unsaved form content.
const openedQuestionByForm = new Map();
const MAX_REMEMBERED_FORMS = 100;

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
  // New cards should focus their label exactly once. A restored expanded
  // card after resize must NOT steal focus or select existing text.
  const [newlyCreatedQuestionId, setNewlyCreatedQuestionId] = useState('');
  const [dragQuestionId, setDragQuestionId] = useState('');
  const [dragOverQuestionId, setDragOverQuestionId] = useState('');

  const updateQuestion = (id, patch) => set({ questions: updateQuestionList(questions, id, patch) });

  const removeQuestion = (id) => {
    const next = removeQuestionFromList(questions, id);
    set({ questions: next });
    if (openQuestionId === id) selectOpenQuestion(next[0]?.id || '');
    if (newlyCreatedQuestionId === id) setNewlyCreatedQuestionId('');
  };

  const duplicateQuestion = (question) => {
    const { copy, questions: next } = duplicateQuestionInList(questions, question);
    set({ questions: next });
    selectOpenQuestion(copy.id);
    setNewlyCreatedQuestionId(copy.id);
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
    setNewlyCreatedQuestionId(question.id);
  };

  return {
    openQuestionId,
    newlyCreatedQuestionId,
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
