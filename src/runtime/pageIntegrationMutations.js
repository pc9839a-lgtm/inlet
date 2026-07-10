export function normalizeFreeEmailIntegrations({ sourcePage, authUser, normalizeIntegrations }) {
  const sourceIntegrations = normalizeIntegrations(sourcePage?.integrations || {});
  const accountEmail = String(
    authUser?.email
    || sourcePage?.ownership?.ownerEmail
    || sourcePage?.ownerEmail
    || sourcePage?.clientEmail
    || sourceIntegrations?.email?.to
    || ''
  ).trim().toLowerCase();
  const plan = String(sourcePage?.plan || sourcePage?.billingPlan || sourcePage?.billing?.plan || authUser?.plan || authUser?.billingPlan || 'free').trim().toLowerCase();
  const isFreePlan = !['paid', 'pro', 'premium', 'business', 'agency', 'enterprise'].includes(plan);
  if (!isFreePlan || !accountEmail) return sourcePage;
  return {
    ...sourcePage,
    integrations: normalizeIntegrations({
      ...sourceIntegrations,
      email: {
        ...(sourceIntegrations.email || {}),
        to: accountEmail,
        lockedToAccount: true,
      },
    }),
  };
}
