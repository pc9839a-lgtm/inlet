import { useCallback, useEffect, useState } from 'react';
import {
  createAccountCheckout,
  fetchAccountFinance,
} from '../../lib/accountFinanceRepository.js';

export default function useAccountFinance(authUser = null) {
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!authUser?.session) {
      setLoading(false);
      setError('로그인이 필요합니다.');
      return null;
    }
    setLoading(true);
    setError('');
    try {
      const next = await fetchAccountFinance(authUser);
      setFinance(next);
      return next;
    } catch (requestError) {
      setError(String(requestError?.message || '결제 정보를 불러오지 못했습니다.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [authUser?.session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkout = useCallback(async (service, planCode) => {
    const busyKey = `${service}:${planCode}`;
    setBusy(busyKey);
    setError('');
    setNotice('');
    try {
      const url = await createAccountCheckout(authUser, service, planCode);
      if (!url) throw new Error('결제 페이지 주소를 확인할 수 없습니다.');
      window.location.assign(url);
      return true;
    } catch (requestError) {
      setError(String(requestError?.message || '결제 페이지를 열지 못했습니다.'));
      return false;
    } finally {
      setBusy('');
    }
  }, [authUser?.session]);

  return {
    finance,
    loading,
    busy,
    error,
    notice,
    refresh,
    checkout,
    setNotice,
  };
}
