import { encodeD1Lead, encodeD1Event } from './d1Adapter.mjs';

export const LEGACY_IMPORT_CONFIRM = 'I_CONFIRM_LOCAL_DATA_IMPORT';
export const LEGACY_IMPORT_BATCH_LIMIT = 20;

function reject(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sourceIdentity(item, project) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) reject('이관 항목 형식이 잘못되었습니다.');
  const id = String(item.id || '').trim();
  if (!id || id.length > 120 || !/^[a-zA-Z0-9_-]+$/.test(id)) reject('원본 ID가 없거나 형식이 잘못되었습니다.');
  const sources = [item.projectId, item.project?.projectId, item.project?.id].filter(value => value != null && String(value).trim());
  if (!sources.length || sources.some(value => String(value) !== String(project.projectId))) reject('원본 프로젝트 ID가 현재 페이지와 다릅니다.');
  const slugs = [item.pageSlug, item.page?.slug, item.project?.slug].filter(value => value != null && String(value).trim());
  if (slugs.some(value => String(value) !== String(project.slug))) reject('원본 페이지 주소가 현재 페이지와 다릅니다.');
  if (item.ownerId && String(item.ownerId) !== String(project.ownerId)) reject('원본 소유자 ID가 다릅니다.');
  return id;
}

async function migrationId(kind, projectId, originalId) {
  const bytes = new TextEncoder().encode(['pagero-local-v1',kind,projectId,originalId].join(':'));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digest = Array.from(hash.slice(0, 20), value => value.toString(16).padStart(2,'0')).join('');
  // Event privacy sanitizer forbids long numeric runs in opaque IDs.
  // Fixed 8-char hex groups keep the ID stable and always admissible.
  return 'local_' + (kind === 'leads' ? 'l_' : 'e_') + (digest.match(/.{1,8}/g) || []).join('-');
}

export async function prepareLegacyImport(input = {}, project = {}) {
  if (!project.projectId || !project.slug || !project.ownerId) reject('프로젝트 소유권 정보가 누락되었습니다.');
  const kind = String(input.kind || '');
  if (!['leads','events'].includes(kind)) reject('지원하지 않는 이관 종류입니다.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > LEGACY_IMPORT_BATCH_LIMIT) reject('한 번에 1~20개만 이관할 수 있습니다.');
  const ids = new Set();
  const records = [];
  for (const item of input.items) {
    const originalId = sourceIdentity(item, project);
    if (ids.has(originalId)) reject('이관 요청에 같은 원본 ID가 중복되었습니다.');
    ids.add(originalId);
    const createdAt = String(item.createdAt || '');
    if (createdAt && (!Number.isFinite(Date.parse(createdAt)) || Date.parse(createdAt) > Date.now()+86400000)) reject('원본 생성일이 잘못되었습니다.');
    const id = await migrationId(kind, project.projectId, originalId);
    if (kind === 'leads') {
      if (!String(item.name || item.phone || item.email || item.message || item.type || '').trim()) reject('접수 내용이 비어 있습니다.');
      const archived = {
        id, projectId:project.projectId, pageSlug:project.slug,
        pageId: String(item.pageId || ''),
        type:String(item.type || 'lead'), kind:String(item.kind || item.type || 'lead'),
        name:String(item.name || ''), phone:String(item.phone || ''), email:String(item.email || ''),
        address:String(item.address || ''), message:String(item.message || ''), memo:String(item.memo || ''),
        status:String(item.status || '신규'), answers:Array.isArray(item.answers)?item.answers:[],
        values:item.values && typeof item.values==='object' && !Array.isArray(item.values)?item.values:{},
        createdAt: createdAt || new Date().toISOString(),
        deliveryStatus:'none', delivery:{status:'none',summary:'이전 자료 이관 · 알림 미발송',logs:[]},
        migration:{source:'legacy-local',originalId},
      };
      records.push({id,originalId,row:encodeD1Lead(archived,{projectId:project.projectId,pageSlug:project.slug})});
    } else {
      if (!String(item.type || item.eventType || '').trim()) reject('이벤트 종류가 누락되었습니다.');
      const event = {...item,id,projectId:project.projectId,pageSlug:project.slug,createdAt:createdAt||new Date().toISOString()};
      records.push({id,originalId,row:encodeD1Event(event,{projectId:project.projectId,pageSlug:project.slug})});
    }
  }
  return {kind,records};
}

const LEAD_COLS = ['id','project_id','page_id','page_slug','kind','status','name','phone','email','contact_key',
  'client_id','ip_hash','user_agent_hash','phone_normalized','email_normalized','duplicate','duplicate_reason',
  'risk_score','submitted_at','values_json','delivery_status','source_url','created_month','created_at','updated_at'];
const EVENT_COLS = ['id','project_id','page_id','page_slug','event_type','visitor_id','session_id','dedupe_key',
  'channel','device','payload_json','created_month','created_at'];

export async function commitLegacyImport(db, plan, project) {
  const table = plan.kind === 'leads' ? 'leads' : 'events';
  const columns = plan.kind === 'leads' ? LEAD_COLS : EVENT_COLS;
  let inserted = 0, alreadyPresent = 0, verified = 0;
  for (const record of plan.records) {
    const existing = await db.prepare('SELECT id, project_id FROM '+table+' WHERE id = ? LIMIT 1').bind(record.id).first();
    if (existing && existing.project_id !== project.projectId) reject('이관 ID의 소유권 충돌을 감지했습니다.',409);
    if (!existing) {
      const values = columns.map(col => record.row[col] ?? null);
      const sql = 'INSERT OR IGNORE INTO '+table+' ('+columns.join(', ')+') VALUES ('+columns.map(()=>'?').join(', ')+')';
      await db.prepare(sql).bind(...values).run();
    }
    const readback = await db.prepare('SELECT id, project_id FROM '+table+' WHERE id = ? AND project_id = ? LIMIT 1')
      .bind(record.id,project.projectId).first();
    if (!readback) reject('서버 이관 결과를 재조회하지 못했습니다. 로컬 원본을 유지하세요.',503);
    if (existing) alreadyPresent++; else inserted++;
    verified++;
  }
  return {kind:plan.kind,total:plan.records.length,inserted,alreadyPresent,verified,originalPreserved:true};
}
