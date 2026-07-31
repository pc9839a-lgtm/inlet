const NativeWebSocket = globalThis.WebSocket;

if (NativeWebSocket?.prototype?.send) {
  const nativeSend = NativeWebSocket.prototype.send;
  NativeWebSocket.prototype.send = function sendWithFormQaSession(data) {
    try {
      const payload = JSON.parse(String(data));
      if (
        payload?.method === 'Runtime.evaluate'
        && typeof payload?.params?.expression === 'string'
        && payload.params.expression.includes("localStorage.setItem('inlet-auth-v1'")
        && !payload.params.expression.includes('form-e2e-session')
      ) {
        payload.params.expression = payload.params.expression.replace(
          '"status":"active"',
          '"status":"active","session":"form-e2e-session"',
        );
        return nativeSend.call(this, JSON.stringify(payload));
      }
    } catch {
      // Non-JSON websocket payloads are forwarded unchanged.
    }
    return nativeSend.call(this, data);
  };
}
