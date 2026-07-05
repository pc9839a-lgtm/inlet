import { uid } from '../../lib/pageModel.js';

export function normalizeFaqItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item.id || uid(),
    q: item.q || item.question || `질문 ${index + 1}`,
    a: item.a || item.answer || '답변을 입력하세요.',
  }));
}

export function createFaqItem(index = 0) {
  return { id: uid(), q: `질문 ${index + 1}`, a: '답변을 입력하세요.' };
}
