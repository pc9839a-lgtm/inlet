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
const bridge=fs.readFileSync('public/c63-practical-bridge.js','utf8');
assert(bridge.includes("createGuideSection"),'Visible hydrated C63 home must have the guide section');
assert(bridge.includes("home.insertBefore(createGuideSection(),home.querySelector('.c63-life-bridge') || footer || null)"),'Guide must precede LIFE/footer without replacing existing sections');
assert(bridge.includes("if(!home.querySelector('.c63-guide-bridge'))"),'Guide insert must be idempotent during C63 hydration');
const css=fs.readFileSync('public/c63-practical-bridge.css','utf8');
assert(css.includes('.pagero-exact-home .c63-guide-bridge'),'Guide section must match existing C63 design');
const legacy=fs.readFileSync('public/c63-life-bridge.js','utf8');
assert(legacy.includes('createCallTagSection')&&legacy.includes('createLifeSection'),'Existing service bridges must remain');
assert(landing.includes('c63-practical-bridge.js?v=20261101-1600-b'),'Actual homepage must load practical guide hydration script');
assert(landing.includes('c63-life-bridge.js?v=20261101-1600-b') && landing.includes('c63-life-bridge.css?v=20261101-1600-b'),'Updated LIFE/CallTag resources must use unique URLs');
assert(landing.includes('c63-practical-bridge.css?v=20261101-1600-b'),'Updated practical section CSS must use unique URL');
assert(landing.includes('만들고, 받고, 확인하세요.'),'Concise hero of practical guide must be visible in initial HTML');
assert(!landing.includes('가입 없이 볼 수 있는 설명서와 무료 도구입니다.'),'Removed redundant promotional intro must not reappear');
assert(!bridge.includes('가입 없이 볼 수 있는 설명서와 무료 도구입니다.'),'Hydrated guide must not show redundant copy');
assert(bridge.includes('c63-guide-resources') && bridge.includes('c63-guide-card-top'),'Guide must use compact 3-stage cards and categorized quick links');
assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'Three stages must align in one row on desktop');
assert(css.includes('grid-template-columns:1fr'),'Mobile content must collapse to one column');
assert(landing.includes('class="pagero-ssr-footer"'),'One server fallback footer remains for non-JS visitors');
assert(landing.includes('#root:has(> .pagero-exact-home) > .pagero-ssr-fallback'),'Server fallback must be hidden on C63 hydration');
assert(landing.includes("node.classList?.contains('pagero-ssr-fallback')"),'Hydration must remove the duplicate fallback footer');
assert(landing.includes("home.querySelectorAll('footer, .footer')"),'Both semantic and legacy C63 footers must be deduped');
assert(landing.includes('topLevel.find((node) => node.querySelector(\'.footer-links\'))'),'Retain primary footer navigation when deduping');
assert(legacy.includes("home.querySelector('footer, .footer')"),'LIFE/CallTag must insert ahead of either footer implementation');
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
