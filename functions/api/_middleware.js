import { isRequestSessionRevoked } from './auth/_session-revocation.js';
import { enqueuePageroLead } from './call/pagero/_shared.js';
import { notifyPageroLeadAvailable, ownerIdForProject } from './call/push/_shared.js';
import { canonicalLeadFromPageroQueue, intakeCanonicalLead, recordLeadAudit } from './calltag/v1/_shared.js';
import {
  bindApiRequestTrace,
  createApiRequestTrace,
  finalizeApiRequestTrace,
  logApiRequestException,
} from './_requestTrace.js';
import { evaluatePublicLeadAbuse, publicLeadAbuseResponse } from './_publicLeadAbuseGuard.js';

function sessionError(status, code, error) {
  return new Response(JSON.stringify({ ok: false, error, code }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function preserveOriginalResponse(response) {
  return response;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const trace = bindApiRequestTrace(context, createApiRequestTrace(request));
  const finish = (response) => finalizeApiRequestTrace(response, trace);

  try {
    try {
      if (await isRequestSessionRevoked(request, env)) {
        return finish(sessionError(401, 'AUTH_SESSION_REVOKED', 'Session was revoked. Please sign in again.'));
      }
    } catch (error) {
      console.error('auth session revocation check failed', {
        requestId: trace.requestId,
        path: url.pathname,
        errorName: String(error?.name || 'Error').slice(0, 64),
        errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
      });
      return finish(sessionError(503, 'AUTH_SESSION_REVOCATION_CHECK_FAILED', 'Session security check failed.'));
    }

    if (request.method !== 'POST' || url.pathname !== '/api/leads') {
      return finish(await next());
    }

    const abuse = await evaluatePublicLeadAbuse(request, env, { requestId: trace.requestId });
    if (!abuse.allowed) {
      console.warn('public lead request blocked', {
        requestId: trace.requestId,
        status: Number(abuse.status || 429),
        reason: String(abuse.reason || 'rate_limited').slice(0, 64),
      });
      return finish(publicLeadAbuseResponse(abuse));
    }

    let submitted = {};
    try {
      submitted = await request.clone().json();
    } catch {
      submitted = {};
    }

    const response = await next();
    if (!response.ok || !env?.DB) return finish(response);

    try {
      const payload = await response.clone().json();
      if (!payload?.ok || !payload?.lead) return finish(response);
      const savedLead = payload.lead;
      const projectId = savedLead.projectId
        || submitted?.project?.projectId
        || submitted?.project?.id
        || '';
      const queued = await enqueuePageroLead(env.DB, {
        lead: savedLead,
        project: {
          projectId,
          id: projectId,
          slug: savedLead.pageSlug || submitted?.project?.slug || '',
          title: submitted?.project?.title || '',
        },
        page: {
          id: savedLead.pageId || submitted?.page?.id || '',
          slug: savedLead.pageSlug || submitted?.page?.slug || '',
          title: savedLead.pageTitle || submitted?.page?.title || '',
          url: savedLead.pageUrl || submitted?.page?.url || '',
        },
      });

      if (queued?.queued) {
        const ownerId = await ownerIdForProject(env.DB, projectId);
        if (ownerId) {
          try {
            const queueLead = queued.lead || {};
            const canonical = canonicalLeadFromPageroQueue({
              ...queueLead,
              pageSlug: queueLead.siteId || savedLead.pageSlug || submitted?.page?.slug || '',
              customerName: queueLead.customer?.name || '',
              customerPhone: queueLead.customer?.phone || '',
              customerEmail: queueLead.customer?.email || '',
              inquiryContent: queueLead.inquiry?.content || '',
              sourceUrl: queueLead.inquiry?.sourceUrl || '',
              campaign: queueLead.inquiry?.campaign || '',
              metadataJson: JSON.stringify({
                ...(queueLead.metadata || {}),
                leadId: savedLead.id || '',
                pageTitle: savedLead.pageTitle || queueLead.metadata?.pageTitle || '',
                answers: Array.isArray(savedLead.answers) ? savedLead.answers : (queueLead.metadata?.answers || []),
                referrer: savedLead.referrer || queueLead.metadata?.referrer || '',
                utmSource: savedLead.utmSource || savedLead.utm_source || queueLead.metadata?.utmSource || '',
                utmMedium: savedLead.utmMedium || savedLead.utm_medium || queueLead.metadata?.utmMedium || '',
                utmCampaign: savedLead.utmCampaign || savedLead.utm_campaign || queueLead.metadata?.utmCampaign || '',
              }),
            });
            const canonicalResult = await intakeCanonicalLead(env.DB, ownerId, canonical, {
              connectionId: `pagero:${projectId}`,
              idempotencyKey: queueLead.eventId || '',
            });
            await recordLeadAudit(env.DB, {
              requestId: `pagero:${queueLead.eventId || crypto.randomUUID()}`,
              ownerId,
              eventId: canonicalResult.eventId,
              action: 'pagero.adapter',
              result: canonicalResult.result,
              sourceType: 'pagero',
              statusCode: canonicalResult.created ? 201 : 200,
            });
          } catch (error) {
            console.error('Pagero canonical lead dual-write failed', {
              requestId: trace.requestId,
              projectId,
              errorName: String(error?.name || 'Error').slice(0, 64),
              errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
            });
          }

          const notify = notifyPageroLeadAvailable(env, env.DB, ownerId, {
            queueId: queued.lead?.id || 0,
            eventId: queued.lead?.eventId || '',
          }).then((result) => {
            if (Number(result?.attempted || 0) > 0 && Number(result?.sent || 0) === 0) {
              console.warn('CallTag realtime push reached no active device', {
                requestId: trace.requestId,
                ownerId,
                attempted: Number(result?.attempted || 0),
              });
            }
          }).catch((error) => {
            console.error('CallTag realtime push failed', {
              requestId: trace.requestId,
              ownerId,
              errorName: String(error?.name || 'Error').slice(0, 64),
              errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
            });
          });
          if (typeof context.waitUntil === 'function') context.waitUntil(notify);
          else await notify;
        } else {
          console.warn('CallTag realtime push owner not found', {
            requestId: trace.requestId,
            projectId,
          });
        }
      }
    } catch (error) {
      console.error('Pagero CallTag queue enqueue failed', {
        requestId: trace.requestId,
        errorName: String(error?.name || 'Error').slice(0, 64),
        errorCode: String(error?.code || '').replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 64),
      });
    }

    return finish(preserveOriginalResponse(response));
  } catch (error) {
    logApiRequestException(trace, error);
    throw error;
  }
}
