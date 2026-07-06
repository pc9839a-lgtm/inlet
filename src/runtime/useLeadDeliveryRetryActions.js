import { isServerLeadMode } from '../config/runtimeConfig.js';
import { retryFailedServerLeads } from '../lib/leadRepository.js';
import { normalizeLeadItem } from '../lib/leadModel.js';

export function useLeadDeliveryRetryActions({
  authUser,
  leads,
  page,
  runLeadDelivery,
  setLeads,
  syncLeadPatch,
}) {
  const retryLeadDelivery = (lead) => {
    const pending = { status: 'pending', summary: '외부 전송 재시도 중', logs: lead.delivery?.logs || [] };
    setLeads((list) => list.map((item) => item.id === lead.id ? { ...item, delivery: pending } : item));
    syncLeadPatch(lead.id, { delivery: pending });

    runLeadDelivery({ ...lead, delivery: pending })
      .then((report) => {
        if (!report) return;
        setLeads((list) => list.map((item) => item.id === lead.id ? { ...item, delivery: report } : item));
        if (!isServerLeadMode()) syncLeadPatch(lead.id, { delivery: report });
      })
      .catch((error) => {
        console.warn('Integration retry failed:', error);
        const delivery = {
          status: 'failed',
          summary: '외부 전송 재시도 실패',
          logs: [
            ...(lead.delivery?.logs || []),
            { target: '외부 전송', status: 'failed', message: String(error?.message || error), at: new Date().toISOString() },
          ],
        };
        setLeads((list) => list.map((item) => item.id === lead.id ? { ...item, delivery } : item));
        syncLeadPatch(lead.id, { delivery });
      });
  };

  const retryFailedDeliveries = async () => {
    const failed = leads.filter((lead) => ['failed', 'partial'].includes(lead.delivery?.status));
    if (!failed.length) return;

    if (isServerLeadMode()) {
      try {
        const result = await retryFailedServerLeads(page, authUser);
        if (result?.leads?.length) setLeads(result.leads.map(normalizeLeadItem));
      } catch (error) {
        console.warn('Server failed deliveries retry failed:', error);
      }
      return;
    }

    failed.forEach((lead) => retryLeadDelivery(lead));
  };

  return { retryFailedDeliveries, retryLeadDelivery };
}