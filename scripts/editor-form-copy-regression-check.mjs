import assert from 'node:assert/strict';
import { duplicateQuestionInList } from '../src/editor/blockEditors/formQuestionListModel.js';
import { sanitizeBlock } from '../src/lib/pageModel.js';

for (const type of ['select', 'multi']) {
  const source = { id: 'original', label: '상담 시간', type, required: true, placeholder: '시간 선택', options: ['평일 오후', '주말 오전'] };
  const { copy, questions } = duplicateQuestionInList([source], source);
  assert.notEqual(copy.id, source.id);
  assert.notStrictEqual(copy.options, source.options);
  const block = sanitizeBlock({ id: 'form', type: 'form', visible: true, s: { questions } });
  assert.deepEqual(block.s.questions.map(q => q.options), [['평일 오후', '주말 오전'], ['평일 오후', '주말 오전']]);
  assert.equal(block.s.questions[1].required, true);
  assert.equal(block.s.questions[1].placeholder, '시간 선택');
  copy.options[0] = '복사본만 변경';
  assert.equal(source.options[0], '평일 오후');
}
console.log(JSON.stringify({ ok: true, scope: 'form-question-copy-options', types: ['select', 'multi'], normalizedCopyPreserved: true, independentOptions: true }));
