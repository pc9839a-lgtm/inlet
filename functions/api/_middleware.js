import { enqueuePageroLead } from './call/pagero/_shared.js';
import { notifyPageroLeadAvailable, ownerIdForProject } from './call/push/_shared.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== '/api/leads') {
    return next();
  }

  let submitted = {};
  try {
    submitted = await request.clone().json();
  } catch {
    submitted = {};
  }

  const response = await next();
  if (!response.ok || !env?.DB) return response;

  try {
    const payload = await response.clone().json();
    if (!payload?.ok || !payload?.lead) return response;
    const savedLead = payload.lead;
    const projectId = savedLead.projectId
      || submitted?.project?.projectId
      || submitted?.project?.id
      || '';
    const queued = await enqueuePageroLead(env.DB, {
      lead: savedLead,
      project: {
        ...(submitted?.project || {}),
        projectId,
      },
      page: {
        ...(submitted?.page || {}),
        id: savedLead.pageId || submitted?.page?.id || '',
        slug: savedLead.pageSlug || submitted?.page?.slug || '',
      },
    });

    if (queued?.queued) {
      const directOwnerId = String(
        savedLead.ownerId
          || savedLead.ownerAccountId
          || submitted?.project?.ownerId
          || submitted?.project?.ownerAccountId
          || ''
      ).trim();
      const ownerId = directOwnerId || await ownerIdForProject(env.DB, projectId);
      if (ownerId) {
        const notify = notifyPageroLeadAvailable(env, env.DB, ownerId, {
          queueId: queued.lead?.id || 0,
          eventId: queued.lead?.eventId || '',
        }).then((result) => {
          if (Number(result?.attempted || 0) > 0 && Number(result?.sent || 0) === 0) {
            console.warn('CallTag realtime push reached no active device', {
              ownerId,
              attempted: Number(result?.attempted || 0),
            });
          }
        }).catch((error) => {
          console.error('CallTag realtime push failed', {
            ownerId,
            message: String(error?.message || error || 'unknown error'),
          });
        });
        if (typeof context.waitUntil === 'function') context.waitUntil(notify);
        else await notify;
      } else {
        console.warn('CallTag realtime push owner not found', { projectId });
      }
    }
  } catch (error) {
    console.error('Pagero CallTag queue enqueue failed', {
      message: String(error?.message || error || 'unknown error'),
    });
  }

  return response;
}
