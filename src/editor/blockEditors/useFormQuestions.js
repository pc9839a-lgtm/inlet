import { useState } from 'react';
import {
  createQuestionByType,
  duplicateQuestionInList,
  moveDraggedQuestionList,
  moveQuestionInList,
  removeQuestionFromList,
  updateQuestionList,
} from './formQuestionListModel.js';

export function useFormQuestions({ questions, set }) {
  const [openQuestionId, setOpenQuestionId] = useState(questions[0]?.id || '');
  const [dragQuestionId, setDragQuestionId] = useState('');
  const [dragOverQuestionId, setDragOverQuestionId] = useState('');

  const updateQuestion = (id, patch) => set({ questions: updateQuestionList(questions, id, patch) });

  const removeQuestion = (id) => {
    const next = removeQuestionFromList(questions, id);
    set({ questions: next });
    if (openQuestionId === id) setOpenQuestionId(next[0]?.id || '');
  };

  const duplicateQuestion = (question) => {
    const { copy, questions: next } = duplicateQuestionInList(questions, question);
    set({ questions: next });
    setOpenQuestionId(copy.id);
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
    setOpenQuestionId(question.id);
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
    toggleQuestionOpen: (id) => setOpenQuestionId(openQuestionId === id ? '' : id),
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