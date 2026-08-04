import React, { useState } from 'react';
import { authAccountErrorMessage, changeAuthPassword, confirmEmailVerification, isValidAccountPassword, loginAuthAccount, normalizeAccountPhone, registerAuthAccount, requestEmailVerification, startGoogleAuthLogin } from '../lib/authAccounts.js';

function partnerCodeFromLocation() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search || '');
  return String(params.get('ref') || params.get('partner') || params.get('partnerCode') || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 32);
}

function AuthScreen({ onAuth, initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [partnerCode] = useState(() => partnerCodeFromLocation());
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', password2: '', verificationCode: '' });
  const [emailVerified, setEmailVerified] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => {
    setError('');
    setNotice('');
    if (key === 'email') setEmailVerified(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const verifyEmail = async () => {
    const email = form.email.trim().toLowerCase();
    const purpose = mode === 'reset' ? 'password-reset' : 'signup';
    setError('');
    setNotice('');
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      if (form.verificationCode.trim()) {
        await confirmEmailVerification({ email, token: form.verificationCode.trim(), purpose });
        setEmailVerified(true);
        setNotice('이메일 인증이 완료되었습니다.');
        return;
      }
      const verification = await requestEmailVerification(email, purpose);
      const token = String(verification?.token || '').trim();
      if (!token) {
        setNotice('인증 메일을 보냈습니다. 이메일로 받은 인증 코드를 입력한 뒤 다시 인증해주세요.');
        return;
      }
      await confirmEmailVerification({ email, token, purpose });
      setEmailVerified(true);
      setNotice('이메일 인증이 완료되었습니다.');
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const phone = normalizeAccountPhone(form.phone);

    if (!email || !form.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (mode === 'reset') {
      if (!emailVerified) {
        setError('이메일 인증을 완료해야 비밀번호를 바꿀 수 있습니다.');
        return;
      }
      if (!isValidAccountPassword(form.password)) {
        setError('비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.');
        return;
      }
      if (form.password !== form.password2) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      setSaving(true);
      try {
        await changeAuthPassword({ email, password: form.password, token: form.verificationCode.trim() });
        setForm((prev) => ({ ...prev, password: '', password2: '', verificationCode: '' }));
        setEmailVerified(false);
        setMode('login');
        setNotice('비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.');
      } catch (err) {
        setError(authAccountErrorMessage(err));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!form.name.trim()) {
        setError('이름을 입력해주세요.');
        return;
      }

      if (!phone) {
        setError('핸드폰번호를 입력해주세요.');
        return;
      }

      if (!isValidAccountPassword(form.password)) {
        setError('비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해주세요.');
        return;
      }

      if (form.password !== form.password2) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }

      if (!emailVerified) {
        setError('이메일 인증을 먼저 완료해주세요.');
        return;
      }
    }

    setSaving(true);
    try {
      const authUser = mode === 'signup'
        ? await registerAuthAccount({
          name: form.name.trim(),
          email,
          phone,
          password: form.password,
          token: form.verificationCode.trim(),
          source: 'signup',
          partnerCode,
        })
        : await loginAuthAccount({ email, password: form.password });
      onAuth({
        ...(authUser || {}),
        name: authUser?.name || (mode === 'signup' ? form.name.trim() : (form.name.trim() || '사용자')),
        email,
        phone: authUser?.phone || phone,
        signedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(authAccountErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const googleLogin = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await startGoogleAuthLogin({ next: '/dashboard', partnerCode });
    } catch (err) {
      setError(authAccountErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        {onBack && <button className="auth-back" type="button" onClick={onBack}>← 메인으로</button>}
        <div className="auth-brand">
          <strong>페이지로</strong>
          <span>고객 인입 랜딩 빌더</span>
        </div>

        <div className="auth-copy">
          <h1>{mode === 'login' ? '로그인' : '페이지로 시작하기'}</h1>
          <p>고객이 들어오는 첫 화면을 만들고 관리하세요.</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <button className="auth-google-btn" type="button" onClick={googleLogin} disabled={saving}>
            {mode === 'signup' ? 'Google로 회원가입' : 'Google로 로그인'}
          </button>

          <div className="auth-divider"><span>또는</span></div>

          {mode === 'signup' && (
            <label>
              <span>이름</span>
              <input value={form.name} onChange={(e)=>set('name', e.target.value)} placeholder="이름" />
            </label>
          )}

          {mode === 'signup' && (
            <label>
              <span>핸드폰번호</span>
              <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e)=>set('phone', e.target.value)} placeholder="01012345678" />
            </label>
          )}

          <label>
            <span>이메일</span>
            <input type="text" inputMode="email" autoComplete="email" value={form.email} onChange={(e)=>set('email', e.target.value)} placeholder="email@example.com" />
          </label>

          <label>
            <span>비밀번호</span>
            <input type="password" value={form.password} onChange={(e)=>set('password', e.target.value)} placeholder="비밀번호" />
          </label>

          {(mode === 'signup' || mode === 'reset') && (
            <label>
              <span>비밀번호 확인</span>
              <input type="password" value={form.password2} onChange={(e)=>set('password2', e.target.value)} placeholder="비밀번호 확인" />
            </label>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <>
              {!emailVerified && (
                <label>
                  <span>이메일 인증 코드</span>
                  <input value={form.verificationCode} onChange={(e)=>set('verificationCode', e.target.value)} placeholder="인증 코드" />
                </label>
              )}
              <button className="ghost-btn" type="button" onClick={verifyEmail} disabled={emailVerified || saving}>
                {emailVerified ? '이메일 인증 완료' : form.verificationCode ? '인증 코드 확인' : '인증 메일 보내기'}
              </button>
            </>
          )}

          {notice && <p className="auth-notice">{notice}</p>}
          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={saving}>{saving ? '처리 중' : mode === 'login' ? '로그인' : mode === 'reset' ? '비밀번호 변경' : '회원가입'}</button>
        </form>

        <button className="auth-switch" type="button" onClick={()=>{ setError(''); setNotice(''); setEmailVerified(false); setMode(mode === 'login' ? 'signup' : 'login'); }}>
          {mode === 'login' ? '아직 계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
        {mode === 'login' && (
          <button className="auth-switch" type="button" onClick={()=>{ setError(''); setNotice(''); setEmailVerified(false); setMode('reset'); }}>
            이메일 인증 후 비밀번호 변경
          </button>
        )}
      </section>
    </div>
  );
}

export default AuthScreen;
export { AuthScreen };
