export function notify(message, tone = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('builder:toast', {
    detail: { message: String(message || ''), tone },
  }));
}

export function confirmAction({ title, message = '', confirmLabel = '확인', danger = false } = {}) {
  if (typeof window === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('builder:confirm', {
      detail: {
        title,
        message,
        confirmLabel,
        danger,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      },
    }));
  });
}
