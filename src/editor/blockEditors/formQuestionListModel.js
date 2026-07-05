import { T, createFormQuestion, duplicateFormQuestion, questionLabels } from './formEditorModel.js';

const optionQuestionTypes = ['select', 'multi'];

export function updateQuestionList(questions, id, patch) {
  return questions.map((question) => (question.id === id ? { ...question, ...patch } : question));
}

export function removeQuestionFromList(questions, id) {
  return questions.filter((question) => question.id !== id);
}

export function duplicateQuestionInList(questions, question) {
  const index = questions.findIndex((item) => item.id === question.id);
  const copy = duplicateFormQuestion(question);
  const next = [...questions];
  next.splice(index + 1, 0, copy);
  return { copy, questions: next };
}

export function moveQuestionInList(questions, id, direction) {
  const index = questions.findIndex((question) => question.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= questions.length) return questions;
  const next = [...questions];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function moveDraggedQuestionList(questions, dragId, targetId) {
  if (!dragId || dragId === targetId) return questions;
  const from = questions.findIndex((question) => question.id === dragId);
  const to = questions.findIndex((question) => question.id === targetId);
  if (from < 0 || to < 0) return questions;
  const next = [...questions];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function createQuestionByType(type = 'short') {
  return createFormQuestion({
    type,
    label: questionLabels[type] || T.newItem,
    options: optionQuestionTypes.includes(type) ? [`${T.optional} 1`, `${T.optional} 2`] : [],
  });
}