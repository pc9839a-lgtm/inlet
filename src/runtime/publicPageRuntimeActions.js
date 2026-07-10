export function authForTargetPage({ publicLandingSlug, targetPage, authUser }) {
  return publicLandingSlug && targetPage?.projectId ? null : authUser;
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
}) {
  const authForPage = (targetPage = {}) => authForTargetPage({ publicLandingSlug, targetPage, authUser });
  const trackForPage = (targetPage, ev) => {
    const traffic = currentTrafficAttribution();
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
      device: ev.device || detectDeviceType(),
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
