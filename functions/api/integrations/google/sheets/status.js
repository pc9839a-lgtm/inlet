import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { getGoogleSheetsIntegration } from './_oauth.js';

const METHODS = 'GET, OPTIONS';

export async function onRequestOptions({ request, env }) {
  return optionsResponse(request, env, METHODS);
}

export async function onRequestGet({ request, env }) {
  try {
    assertD1(env);
    const url = new URL(request.url);
    const projectId = String(url.searchParams.get('projectId') || '').trim();
    if (!projectId) {
      const error = new Error('projectId is required');
      error.status = 400;
      throw error;
    }

    const integration = await getGoogleSheetsIntegration(env.DB, projectId);
    if (!integration) {
      return jsonResponse(request, env, 200, {
        ok: true,
        provider: 'google_sheets',
        mode: 'oauth',
        status: 'disconnected',
        connected: false,
      }, METHODS);
    }

    const settings = integration.settings || {};
    return jsonResponse(request, env, 200, {
      ok: true,
      provider: 'google_sheets',
      mode: 'oauth',
      status: integration.status || 'disconnected',
      connected: integration.status === 'connected',
      connectedEmail: integration.connectedEmail || '',
      spreadsheetId: settings.spreadsheetId || integration.externalId || '',
      spreadsheetUrl: settings.spreadsheetUrl || '',
      sheetName: settings.sheetName || 'Leads',
      lastSyncAt: integration.lastSyncAt || '',
      hasError: !!integration.lastError,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
