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
    } catch {
      // Non-JSON websocket payloads are forwarded unchanged.
    }
    return nativeSend.call(this, data);
  };
}
