import { pageRoExperimentIdentity } from '../lib/abVisitorIdentity.js';

export function authForTargetPage({ publicLandingSlug, targetPage, authUser }) {
  return publicLandingSlug && targetPage?.projectId ? null : authUser;
}

export function pageExperimentTrackingFields(targetPage = {}) {
  const experiment = targetPage?.__experiment && typeof targetPage.__experiment === 'object'
    ? targetPage.__experiment
    : null;
  if (!experiment?.experimentId || !experiment?.variantId || !experiment?.variantKey) return {};
  return {
    experimentId: String(experiment.experimentId),
    variantId: String(experiment.variantId),
    variantKey: String(experiment.variantKey).toUpperCase(),
    assignmentVersion: Math.max(1, Number(experiment.assignmentVersion || 1)),
    sourceRevision: Math.max(0, Number(experiment.sourceRevision || 0)),
  };
}

export function createPageEventTracker({
  page,
  authUser,
  publicLandingSlug,
  currentTrafficAttribution,
  detectDeviceType,
  uid,
  setEvents,
  persistEvent,
  experimentIdentity = pageRoExperimentIdentity,
}) {
  const authForPage = (targetPage = {}) => authForTargetPage({ publicLandingSlug, targetPage, authUser });
  const trackForPage = (targetPage, ev) => {
    const traffic = currentTrafficAttribution();
    const identity = experimentIdentity();
    const event = {
      id: uid(),
      type: ev.type,
      label: ev.label || '',
      channel: ev.channel || traffic.channel,
      utmSource: ev.utmSource || traffic.utmSource,
      utmMedium: ev.utmMedium || traffic.utmMedium,
      utmCampaign: ev.utmCampaign || traffic.utmCampaign,
      sourceUrl: ev.sourceUrl || traffic.sourceUrl,
      referrer: ev.referrer || traffic.referrer,
      sourceLabel: ev.sourceLabel || traffic.sourceLabel,
      isTest: ev.isTest ?? traffic.isTest ?? false,
      device: ev.device || detectDeviceType(),
      visitorId: String(ev.visitorId || identity.visitorId || ''),
      sessionId: String(ev.sessionId || identity.sessionId || ''),
      ...pageExperimentTrackingFields(targetPage),
      createdAt: new Date().toISOString(),
    };
    setEvents((list) => [event, ...list].slice(0, 1000));
    persistEvent(event, targetPage, authForPage(targetPage)).catch((error) => {
      console.warn('Server event save failed:', error);
    });
  };
  return { authForTargetPage: authForPage, trackForPage, track: (ev) => trackForPage(page, ev) };
}

export function createLeadPatchSync({ leads, page, authUser, updateServerLead, isLeadConflictError }) {
  return function syncLeadPatch(id, patch) {
    const current = leads.find((lead) => lead.id === id) || null;
    const expectedUpdatedAt = current?.updatedAt || current?.savedAt || current?.createdAt || '';
    updateServerLead(id, { ...patch, __expectedUpdatedAt: expectedUpdatedAt }, page, authUser).catch((error) => {
      console.warn('Server lead sync failed:', error);
      if (isLeadConflictError(error)) {
        console.warn('Server lead sync skipped because the lead changed elsewhere.');
      }
    });
  };
}
