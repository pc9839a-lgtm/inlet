import { useEffect, useState } from 'react';

export function useBuilderFeedback() {
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail || {};
      setToast({ id: Date.now(), message: detail.message || '', tone: detail.tone || 'info' });
    };
    const onConfirm = (event) => {
      setConfirmDialog(event.detail || null);
    };
    window.addEventListener('builder:toast', onToast);
    window.addEventListener('builder:confirm', onConfirm);
    return () => {
      window.removeEventListener('builder:toast', onToast);
      window.removeEventListener('builder:confirm', onConfirm);
    };
  }, []);

  const showToast = (message, tone = 'info') => {
    setToast({ id: Date.now(), message, tone });
  };

  const requestConfirm = ({ title, message, confirmLabel = '확인', danger = false, onConfirm, onCancel }) => {
    setConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel });
  };

  return {
    toast,
    confirmDialog,
    setToast,
    setConfirmDialog,
    showToast,
    requestConfirm,
  };
}
