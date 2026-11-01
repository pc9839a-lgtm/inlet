import { PRESETS, EXTRA_FIELDS, buildPlan, planAsText } from './logic.mjs';
const form=document.getElementById('planner');
const output=document.getElementById('output');
const fields=document.getElementById('fields');
const resultTitle=document.getElementById('result-title');
const description=document.getElementById('plan-desc');
const submit=document.getElementById('submit-copy');
const complete=document.getElementById('completion-copy');
const caution=document.getElementById('caution');
const steps=document.getElementById('steps');
const checks=document.getElementById('checks');
const guide=document.getElementById('guide-link');
const status=document.getElementById('status');
const copy=document.getElementById('copy');
let current=buildPlan();
const node=(tag,value)=>{const item=document.createElement(tag);item.textContent=value;return item;};
function render(){
 const type=form.querySelector('input[name="type"]:checked')?.value||'consult';
 const extras=[...form.querySelectorAll('input[name="extra"]:checked')].map(input=>input.value);
 current=buildPlan(type,extras);
 resultTitle.textContent=current.label;
 description.textContent=current.description;
 submit.textContent=current.submit;
 complete.textContent=current.complete;
 caution.textContent=current.caution;
 guide.href=current.guide;
 guide.textContent=current.label+' 공식 설명서 읽기';
 fields.replaceChildren(...current.fields.map(field=>{const tr=document.createElement('tr');tr.append(...field.map(value=>node('td',value)));return tr;}));
 steps.replaceChildren(...current.flow.map(s=>node('li',s)));
 checks.replaceChildren(...current.checks.map(s=>node('li',s)));
 status.textContent='';
}
form.addEventListener('change',render);
form.addEventListener('submit',event=>event.preventDefault());
copy.addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(planAsText(current));status.textContent='구성안을 복사했습니다. 실제 운영 조건과 개인정보 안내를 확인한 뒤 사용하세요.';}
 catch{status.textContent='복사가 제한된 브라우저입니다. 입력 항목 표와 안내 문구를 직접 선택해 복사하세요.';}
});
render();
