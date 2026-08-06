import { useCallback, useEffect, useState } from 'react';
import {
  applyAccountReferralCode,
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

  const applyReferral = useCallback(async (code) => {
    setBusy('referral');
    setError('');
    setNotice('');
    try {
      const next = await applyAccountReferralCode(authUser, code);
      setFinance(next);
      setNotice('추천인 코드가 등록되었습니다. 무료 이용 기간 5일이 추가됩니다.');
      return true;
    } catch (requestError) {
      setError(String(requestError?.message || '추천인 코드를 등록하지 못했습니다.'));
      return false;
    } finally {
      setBusy('');
    }
  }, [authUser?.session]);

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
    applyReferral,
    checkout,
    setNotice,
  };
}
