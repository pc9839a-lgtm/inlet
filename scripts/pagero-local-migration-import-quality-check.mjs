import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareLegacyImport, commitLegacyImport, LEGACY_IMPORT_CONFIRM } from '../server/storage/localLegacyImport.mjs';

const project={projectId:'owner_a_page_1',slug:'page-1',ownerId:'owner-a'};
const lead={id:'lead-original',projectId:project.projectId,pageSlug:project.slug,name:'김OO',
  phone:'010-1111-2222',createdAt:'2026-05-10T01:00:00.000Z',
  delivery:{status:'success',logs:[{target:'sms',message:'sent'}]}};
const plan=await prepareLegacyImport({kind:'leads',items:[lead]},project);
assert.equal(plan.records.length,1);
const row=plan.records[0].row;
assert(row.id.startsWith('local_l_') && row.id!==lead.id);
assert.equal(row.project_id,project.projectId);
assert.equal(row.delivery_status,'none');
assert(!row.values_json.includes('"sent"'),'old delivery logs must not be imported');
assert.equal(lead.delivery.status,'success','source must remain unchanged');
assert.equal((await prepareLegacyImport({kind:'leads',items:[lead]},project)).records[0].id,plan.records[0].id);
for(const invalid of [{...lead,projectId:'other'},{...lead,projectId:undefined},
  {...lead,pageSlug:'different'},{...lead,ownerId:'other-owner'}]){
  await assert.rejects(()=>prepareLegacyImport({kind:'leads',items:[invalid]},project),/원본/);
}
await assert.rejects(()=>prepareLegacyImport({kind:'leads',items:[lead,lead]},project),/중복/);
await assert.rejects(()=>prepareLegacyImport({kind:'leads',items:Array(21).fill(lead)},project),/1~20/);
const event={id:'e1',projectId:project.projectId,type:'page_view',
  sourceUrl:'https://example.com/?utm_source=naver&email=private%40example.com',email:'private@example.com'};
const eventPlan=await prepareLegacyImport({kind:'events',items:[event]},project);
assert.equal(eventPlan.records[0].row.channel,'naver');
assert.equal(eventPlan.records[0].id,eventPlan.records[0].row.id,'privacy sanitizer must keep migration event ID');
assert(!eventPlan.records[0].row.payload_json.includes('private@example.com'));
assert(!eventPlan.records[0].row.payload_json.includes('sourceUrl'));

function fakeDb(){
  const tables={leads:new Map(),events:new Map()};
  let mutations=0;
  return {
    tables,
    get mutations(){return mutations},
    prepare(sql){
      const table=/(?:FROM|INTO) (leads|events)/.exec(sql)?.[1];
      if(!table || !/^(SELECT|INSERT OR IGNORE)/.test(sql))throw Error('unexpected D1 '+sql);
      return {bind(...args){return{
        async first(){
          const row=tables[table].get(args[0])||null;
          return row && (!sql.includes('AND project_id = ?')||row.project_id===args[1])?row:null;
        },
        async run(){
          const cols=sql.match(/\(([^)]+)\) VALUES/)?.[1]?.split(',').map(x=>x.trim());
          if(!cols)throw Error('missing insert columns');
          const row=Object.fromEntries(cols.map((col,i)=>[col,args[i]]));
          if(!tables[table].has(row.id)){tables[table].set(row.id,row);mutations++}
          return {success:true};
        }
      }}};
    }
  };
}
const db=fakeDb();
const first=await commitLegacyImport(db,plan,project);
assert.deepEqual([first.inserted,first.verified,first.alreadyPresent],[1,1,0]);
assert.equal(db.tables.leads.get(plan.records[0].id).delivery_status,'none');
const twice=await commitLegacyImport(db,plan,project);
assert.deepEqual([twice.inserted,twice.verified,twice.alreadyPresent],[0,1,1]);
assert.equal(db.mutations,1);
const events=await commitLegacyImport(db,eventPlan,project);
assert.equal(events.verified,1);
db.tables.leads.set(plan.records[0].id,{id:plan.records[0].id,project_id:'other'});
await assert.rejects(()=>commitLegacyImport(db,plan,project),/충돌/);
const api=await readFile('functions/api/local-migration.js','utf8');
assert(api.includes('requireSignedSession:true') && api.includes('INLET_LOCAL_MIGRATION_ENABLED'));
assert(api.includes('originalBackupConfirmed') && api.includes('LEGACY_IMPORT_CONFIRM'));
assert(!api.includes('sendLeadDelivery(') && !api.includes('sendSavedLeadDelivery'));
const active = await readFile('src/screens/workspace/WorkspaceActivePanel.jsx', 'utf8');
assert(!active.includes('LegacyLocalDataBanner'), 'the retired import UI must stay absent from the workspace');
await assert.rejects(
  readFile('src/screens/workspace/LegacyLocalDataBanner.jsx', 'utf8'),
  { code: 'ENOENT' },
);
await assert.rejects(
  readFile('src/screens/workspace/LegacyLocalDataBanner.css', 'utf8'),
  { code: 'ENOENT' },
);
assert.equal(LEGACY_IMPORT_CONFIRM,'I_CONFIRM_LOCAL_DATA_IMPORT');
console.log(JSON.stringify({ok:true,name:'pagero-local-migration-import',repeatedWrites:db.mutations,readback:true,originalPreserved:true}));
