export function createLeadDeliveryActions({
  page,
  authUser,
  isServerLeadMode,
  deliverServerLead,
  sendLeadIntegrations,
}) {
  const runLeadDelivery = (lead) => (
    isServerLeadMode()
      ? deliverServerLead(lead, page, authUser)
      : sendLeadIntegrations(lead, page)
  );

  const runLeadDeliveryForPage = (lead, targetPage, targetAuthUser = authUser) => (
    isServerLeadMode()
      ? deliverServerLead(lead, targetPage, targetAuthUser)
      : sendLeadIntegrations(lead, targetPage)
  );

  return { runLeadDelivery, runLeadDeliveryForPage };
}

export function createVisibleLeadUpdater({ normalizeLeadItem, setLeads }) {
  return function upsertVisibleLead(nextLead) {
    const normalized = normalizeLeadItem(nextLead);
    setLeads((list) => {
      const existingIndex = list.findIndex((item) => String(item.id) === String(normalized.id));
      if (existingIndex < 0) return [normalized, ...list];
      return list.map((item, index) => (index === existingIndex ? { ...item, ...normalized } : item));
    });
  };
}

export function createLeadCaptureAction({
  currentTrafficAttribution,
  uid,
  normalizeLeadItem,
  setLeads,
  setLeadPageMeta,
  trackForPage,
  isReservationLead,
  authForTargetPage,
  persistLead,
  runLeadDeliveryForPage,
  isServerLeadMode,
  syncLeadPatch,
  upsertVisibleLead,
  showToast,
}) {
  return function addLeadForPage(targetPage, lead) {
    const traffic = currentTrafficAttribution();
    const savedLead = normalizeLeadItem({
      id: uid(),
      status: '??',
      memo: '',
      createdAt: new Date().toISOString(),
      delivery: { status: 'pending', summary: '?? ?? ?? ?', logs: [] },
      ...lead,
      channel: lead.channel || traffic.channel,
      utmSource: lead.utmSource || traffic.utmSource,
      utmMedium: lead.utmMedium || traffic.utmMedium,
      utmCampaign: lead.utmCampaign || traffic.utmCampaign,
      sourceUrl: lead.sourceUrl || traffic.sourceUrl,
      referrer: lead.referrer || traffic.referrer,
      sourceLabel: lead.sourceLabel || traffic.sourceLabel,
    });
    setLeads((l) => [savedLead, ...l]);
    setLeadPageMeta((meta) => ({ ...meta, total: Number(meta.total || 0) + 1 }));
    trackForPage(targetPage, {
      type: isReservationLead(savedLead) ? 'reservation_submit' : 'form_submit',
      label: savedLead.type,
    });

    const targetAuthUser = authForTargetPage(targetPage);
    const savePromise = persistLead(savedLead, targetPage, targetAuthUser)
      .then((persistedLead) => {
        const leadForDelivery = normalizeLeadItem({ ...savedLead, ...(persistedLead || {}) });
        const leadIds = [savedLead.id, leadForDelivery.id].filter(Boolean).map(String);
        upsertVisibleLead(leadForDelivery);
        if (isServerLeadMode() && persistedLead?.delivery) {
          return { report: persistedLead.delivery, leadIds, lead: leadForDelivery };
        }
        return runLeadDeliveryForPage(leadForDelivery, targetPage, targetAuthUser)
          .then((report) => ({ report, leadIds, lead: leadForDelivery }))
          .catch((error) => {
            console.warn('Lead delivery failed after save:', error);
            return {
              report: {
                status: 'failed',
                summary: '??? ????? ?? ??? ??????.',
                logs: [{
                  target: '?? ??',
                  status: 'failed',
                  message: String(error?.message || error),
                  at: new Date().toISOString(),
                }],
              },
              leadIds,
              lead: leadForDelivery,
            };
          });
      })
      .then(({ report, leadIds, lead: persistedLead } = {}) => {
        if (!report) return persistedLead || savedLead;
        const ids = Array.isArray(leadIds) && leadIds.length ? leadIds : [savedLead.id];
        setLeads((list) => list.map((item) => (
          ids.includes(String(item.id)) ? { ...item, delivery: report, deliveryStatus: report.status } : item
        )));
        if (!isServerLeadMode()) syncLeadPatch(savedLead.id, { delivery: report, deliveryStatus: report.status });
        return persistedLead || savedLead;
      })
      .catch((error) => {
        console.warn('Lead save or delivery failed:', error);
        if (isServerLeadMode()) {
          setLeads((list) => list.filter((item) => item.id !== savedLead.id));
          setLeadPageMeta((meta) => ({ ...meta, total: Math.max(0, Number(meta.total || 0) - 1) }));
          showToast(
            [409, 429].includes(Number(error?.status || 0))
              ? '?? ??? ??? ?? ??????. ?? ?? ??? ?????.'
              : `?? ??? ??????. ${String(error?.message || error)}`,
            'error',
          );
          throw error;
        }
        const delivery = {
          status: 'failed',
          summary: '?? ?? ??',
          logs: [{
            target: '?? ??',
            status: 'failed',
            message: String(error?.message || error),
            at: new Date().toISOString(),
          }],
        };
        setLeads((list) => list.map((item) => (item.id === savedLead.id ? { ...item, delivery } : item)));
        syncLeadPatch(savedLead.id, { delivery });
        return savedLead;
      });

    return savePromise;
  };
}
