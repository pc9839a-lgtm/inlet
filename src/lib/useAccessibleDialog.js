import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusableNodes(root) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle?.(node);
    return style?.display !== 'none' && style?.visibility !== 'hidden';
  });
}

export function useAccessibleDialog(onClose, { lockScroll = false } = {}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    if (lockScroll) document.body.style.overflow = 'hidden';

    const focusInitial = () => {
      const [first] = visibleFocusableNodes(dialog);
      if (first) first.focus({ preventScroll: true });
      else dialog.focus({ preventScroll: true });
    };
    queueMicrotask(focusInitial);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = visibleFocusableNodes(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (lockScroll) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) {
        queueMicrotask(() => previousFocus.focus?.({ preventScroll: true }));
      }
    };
  }, [lockScroll]);

  return dialogRef;
}
