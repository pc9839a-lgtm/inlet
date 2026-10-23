import assert from 'node:assert/strict';
import { readCodeContentFields, updateCodeContentField } from '../src/editor/blockEditors/codeContentFields.js';

const html = `<!doctype html><html><head><title>Never edit</title><style>.hero{color:red}</style></head><body>
<!-- <h1>Comment</h1> -->
<section class="dyjh-wedding-cover"><H1 data-pagero-label="초대 제목">  도윤 &amp; 지혜  </H1>
<img class="photo" src="https://cdn.example/old.jpg?a=1&amp;b=2" alt="" decoding="async">
<a class='cta' href='https://example.com/?a=1&amp;b=2' target='_blank'>초대장 보기</a>
<script>const template='<h1>Not a title</h1><img src="x">';</script>
<div hidden><p>Hidden</p></div><p>{{dynamic}}</p><p><strong>이름</strong></p>
<img src="responsive.jpg" srcset="retina.jpg 2x"><img src="one" src="two">
</section></body></html>`;
const fields = readCodeContentFields(html);
assert.deepEqual(fields.map((f) => f.value), ['  도윤 & 지혜  ', 'https://cdn.example/old.jpg?a=1&b=2', 'https://example.com/?a=1&b=2', '초대장 보기', '이름']);
const title = fields.find((f) => f.label === '초대 제목');
assert.equal(updateCodeContentField(html, title.id, '<새 제목> & "초대"'), html.slice(0, title.start) + '&lt;새 제목&gt; &amp; &quot;초대&quot;' + html.slice(title.end));
const image = fields.find((f) => f.kind === 'image');
const next = updateCodeContentField(html, image.id, 'https://cdn.example/new.jpg');
assert.equal(next, html.replace('https://cdn.example/old.jpg?a=1&amp;b=2', 'https://cdn.example/new.jpg'));
const link = fields.find((f) => f.kind === 'link');
for (const unsafe of ['javascript:alert(1)', ' java\nscript:alert(1)', 'data:text/html,hi', 'vbscript:msgbox(1)']) assert.equal(updateCodeContentField(html, link.id, unsafe), html);
assert.equal(updateCodeContentField(html, link.id, 'tel:01012345678'), html.replace('https://example.com/?a=1&amp;b=2', 'tel:01012345678'));
assert.equal(readCodeContentFields(updateCodeContentField(next, title.id, '')).find((f) => f.kind === 'image')?.value, 'https://cdn.example/new.jpg');
assert.equal(updateCodeContentField(html, 'nonexistent', 'lost'), html);
assert.deepEqual(readCodeContentFields('<script><img src="x"><h1>bad</h1>'), []);
assert.deepEqual(readCodeContentFields('<div><script>const value="</div><h1>bad</h1>";</script></div>'), []);
const empty = updateCodeContentField(html, title.id, '');
assert.ok(readCodeContentFields(empty).some((field) => field.id === title.id && field.value === ''), 'clearing a title must keep its input editable');
assert.equal(readCodeContentFields(updateCodeContentField(html, title.id, '함께해 ')).find((field) => field.id === title.id)?.value, '함께해 ', 'typing a trailing space must not erase it before the next word');
assert.deepEqual(readCodeContentFields('<template><p>bad</p></template><textarea>bad</textarea><pre><span>bad</span></pre>'), []);
console.log('editor code content: exact-span edits, entities, isolation, ambiguous sources and URL safety passed');
