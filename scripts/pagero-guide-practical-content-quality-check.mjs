import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRESETS, EXTRA_FIELDS,buildPlan,planAsText} from '../public/tools/form-planner/logic.mjs';
import {onRequest} from '../functions/index.js';
const landing=await onRequest().text();
assert(landing.includes('id="calltag"'),'Must preserve existing CallTag section');
assert(landing.includes('c63-assets/index-pagero-main-fix-20260615.js'),'Original frozen C63 design must remain');
assert(landing.includes('<section class="pagero-ssr-life" id="pagero-workflows"'),'Actual root must expose practical guide HTML');
for(const url of ['/tools/form-planner/','/guide/contact-form/','/guide/reservation-form/','/guide/analytics/','/guide/troubleshooting/']){
 assert(landing.includes('href="'+url+'"'),'Public homepage must link real resource '+url);
}
const bridge=fs.readFileSync('public/c63-life-bridge.js','utf8');
assert(bridge.includes("createGuideSection"),'Visible hydrated C63 home must have the guide section');
assert(bridge.includes("home.insertBefore(createGuideSection(), footer || null)"),'Guide must appear alongside existing footer bridges');
assert(bridge.includes("if (!home.querySelector('.c63-guide-bridge'))"),'Guide insert must be idempotent during C63 hydration');
const css=fs.readFileSync('public/c63-life-bridge.css','utf8');
assert(css.includes('.pagero-exact-home .c63-guide-bridge'),'Guide section must match existing C63 design');
assert(bridge.includes("createCallTagSection")&&bridge.includes("createLifeSection"),'Existing service bridges must remain');
const html=fs.readFileSync('public/tools/form-planner/index.html','utf8');
assert(html.includes('href="/guide/contact-form/"')&&html.includes('href="/guide/reservation-form/"'),'Tool must link actual product manuals');
assert(html.includes('id="planner"')&&html.includes('id="fields"')&&html.includes('app.mjs'),'Planner must be actually interactive');
assert.equal(Object.keys(PRESETS).length,3,'Must cover consultation, booking and event workflows');
for(const type of Object.keys(PRESETS)){
 const p=buildPlan(type,['email','email','budget','unexpected']);
 assert.equal(p.selected.length,2,'Optional fields must be unique and validated');
 assert(p.fields.length>=4,'Must return meaningful form structure');
 assert(p.flow.length>=4&&p.checks.length>=6,'Must include real execution and validation steps');
 assert(planAsText(p).includes('개인정보')&&planAsText(p).includes('https://pagero.kr/guide/'),'Copy must include privacy & source');
}
assert.throws(()=>buildPlan('not-a-type'),/지원하지 않는/,'Unknown plan must be rejected');
console.log('PASS C63 original main preserved, server/hydrated guides connected, real 3-use-case form planner and privacy checks');
