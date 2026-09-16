import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const screenshotDir = process.env.INLET_EDITOR_BROWSER_QA_SCREENSHOT_DIR || '.tmp-editor-browser-regression';
await mkdir(screenshotDir, { recursive: true });
await writeFile(
  path.join(screenshotDir, 'run-started.txt'),
  `authenticated editor browser regression started at ${new Date().toISOString()}\n`,
  'utf8',
);

const NativeWebSocket = globalThis.WebSocket;
if (NativeWebSocket?.prototype?.send) {
  const nativeSend = NativeWebSocket.prototype.send;
  NativeWebSocket.prototype.send = function sendWithChromeCdpCompatibility(data) {
    try {
      const payload = JSON.parse(String(data));

      if (
        payload?.method === 'Emulation.setTouchEmulationEnabled'
        && payload?.params?.enabled === false
        && Number(payload?.params?.maxTouchPoints) === 0
      ) {
        payload.params = { enabled: false };
        return nativeSend.call(this, JSON.stringify(payload));
      }

      if (
        payload?.method === 'Runtime.evaluate'
        && typeof payload?.params?.expression === 'string'
        && payload.params.expression.includes("document.querySelector('.workspace-tabs')")
      ) {
        payload.params.expression = payload.params.expression.replaceAll(
          "document.querySelector('.workspace-tabs')",
          "document.querySelector('.top-tabs')",
        );
        return nativeSend.call(this, JSON.stringify(payload));
      }

      if (
        payload?.method === 'Runtime.evaluate'
        && typeof payload?.params?.expression === 'string'
        && payload.params.expression.includes('.screen-order-v2-list #editor-block-editor-image .screen-order-v2-head')
        && payload.params.expression.includes('element.click()')
      ) {
        payload.params.expression = `new Promise((resolve) => {
          const deadline = Date.now() + 3000;
          const clickWhenReady = () => {
            const element = document.querySelector('#editor-block-editor-image .screen-order-v2-head');
            if (element) {
              element.scrollIntoView({ block: 'center', inline: 'center' });
              element.click();
              resolve(true);
              return;
            }
            if (Date.now() >= deadline) {
              resolve(false);
              return;
            }
            setTimeout(clickWhenReady, 50);
          };
          clickWhenReady();
        })`;
        payload.params.awaitPromise = true;
        return nativeSend.call(this, JSON.stringify(payload));
      }

      if (
        payload?.method === 'Runtime.evaluate'
        && typeof payload?.params?.expression === 'string'
        && payload.params.expression.includes('.screen-order-v2-list #editor-block-editor-image .screen-order-v2-head')
      ) {
        payload.params.expression = payload.params.expression.replaceAll(
          '.screen-order-v2-list #editor-block-editor-image .screen-order-v2-head',
          '#editor-block-editor-image .screen-order-v2-head',
        );
        return nativeSend.call(this, JSON.stringify(payload));
      }
    } catch {
      // Non-JSON websocket payloads are forwarded unchanged.
    }
    return nativeSend.call(this, data);
  };
}

if (NativeWebSocket?.prototype?.addEventListener) {
  const nativeAddEventListener = NativeWebSocket.prototype.addEventListener;
  NativeWebSocket.prototype.addEventListener = function addEventListenerWithEditorApiCompatibility(type, listener, options) {
    if (type !== 'message' || typeof listener !== 'function') {
      return nativeAddEventListener.call(this, type, listener, options);
    }

    const wrappedListener = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        const request = payload?.params?.request;
        const requestUrl = request?.url ? new URL(request.url) : null;
        if (
          payload?.method === 'Fetch.requestPaused'
          && request?.method === 'POST'
          && requestUrl?.pathname === '/api/events'
        ) {
          request.method = 'GET';
          return listener.call(this, { data: JSON.stringify(payload) });
        }
      } catch {
        // Unrelated websocket messages are forwarded unchanged.
      }
      return listener.call(this, event);
    };

    return nativeAddEventListener.call(this, type, wrappedListener, options);
  };
}