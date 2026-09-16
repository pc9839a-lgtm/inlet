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

function leadApiMessage(error) {
  return String(error?.details?.message || error?.message || '').trim();
}

export function leadCaptureServerErrorMessage(error) {
  const status = Number(error?.status || 0);
  const message = leadApiMessage(error);
  if (status === 409) return message || '이미 접수된 연락처입니다.';
  if (status === 429) return message || '접수가 너무 빠르게 반복되었습니다. 잠시 후 다시 시도해주세요.';
  return `접수 저장에 실패했습니다.${message ? ` ${message}` : ''}`;
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
      status: '신규',
      memo: '',
      createdAt: new Date().toISOString(),
      delivery: { status: 'pending', summary: '알림 전송 대기', logs: [] },
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
                summary: '접수는 저장됐지만 알림 전송에 실패했습니다.',
                logs: [{
                  target: '알림 전송',
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
          showToast(leadCaptureServerErrorMessage(error), 'error');
          throw error;
        }
        const delivery = {
          status: 'failed',
          summary: '접수 저장에 실패했습니다.',
          logs: [{
            target: '접수 저장',
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
