import { getD1ProjectById } from '../../server/storage/d1Adapter.mjs';
import { commitLegacyImport, LEGACY_IMPORT_CONFIRM, prepareLegacyImport } from '../../server/storage/localLegacyImport.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from './_shared.js';

const METHODS = 'GET, POST, OPTIONS';

function error(message, status = 403) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  try {
    if (!['GET','POST'].includes(request.method)) return jsonResponse(request, env, 405, {ok:false,error:'Method not allowed'}, METHODS);
    const db = assertD1(env);
    const body = request.method === 'POST' ? await readJson(request) : {};
    const project = projectFromRequest(new URL(request.url), body, request);
    const authorized = await authorizeProject(request, env, project, {
      tab:'inbox', write:request.method === 'POST' && body.mode === 'commit', requireSignedSession:true,
    });
    const identity = authorized.identity;
    const role = String(identity?.role || '').toLowerCase();
    if (!['owner','builder','master'].includes(role)) throw error('서버 이관은 프로젝트 편집 권한이 있는 계정만 사용할 수 있습니다.');
    if (!identity?.ownerId || !identity?.projectId || identity.ownerId !== project.ownerId || identity.projectId !== project.projectId) {
      throw error('로그인 세션의 소유자·프로젝트와 이관 대상이 다릅니다.');
    }
    const registered = await getD1ProjectById(db, project.projectId);
    if (!registered || registered.ownerId !== identity.ownerId || registered.slug !== project.slug) {
      throw error('D1에 등록된 프로젝트 소유자·페이지와 이관 대상이 일치하지 않습니다.');
    }
    const enabled = String(env.INLET_LOCAL_MIGRATION_ENABLED || '') === '1';
    if (request.method === 'GET') return jsonResponse(request, env, 200, {ok:true,enabled}, METHODS);
    if (!['preview','commit'].includes(body.mode)) throw error('이관 실행 모드를 지정해야 합니다.', 400);
    const plan = await prepareLegacyImport(body, { projectId:project.projectId, ownerId:identity.ownerId, slug:project.slug });
    if (body.mode === 'preview') return jsonResponse(request, env, 200, {
      ok:true, mode:'preview', kind:plan.kind, eligible:plan.records.length,
      warning:'고객 데이터는 아직 서버에 저장되지 않았습니다. 원본 백업과 프로젝트 확인 후 진행하세요.',
    }, METHODS);
    if (!enabled) throw error('운영 관리자가 데이터 이관 기능을 활성화해야 합니다.');
    if (body.confirm !== LEGACY_IMPORT_CONFIRM || body.originalBackupConfirmed !== true) {
      throw error('원본 백업 확인 및 이관 승인값이 필요합니다.',400);
    }
    const result = await commitLegacyImport(db, plan, {projectId:project.projectId});
    return jsonResponse(request, env, 200, {ok:true, mode:'commit', ...result}, METHODS);
  } catch (cause) {
    return handleApiError(request, env, cause, METHODS);
  }
}
