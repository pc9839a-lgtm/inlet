import { useEffect, useMemo, useState } from 'react';
import {
  authAccountErrorMessage,
  confirmEmailVerification,
  isValidAccountPassword,
  normalizeAccountPhone,
  requestEmailVerification,
} from '../lib/authAccounts.js';
import { acceptServerManagerInvite, fetchServerManagerInvite } from '../lib/managerInvites.js';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function inviteErrorMessage(error) {
  const status = Number(error?.status || 0);
  const code = error?.details?.code || error?.details?.errorCode || '';
  const message = String(error?.message || error || '');
  if (['AUTH_EMAIL_DUPLICATE', 'AUTH_PHONE_DUPLICATE', 'AUTH_PHONE_REQUIRED', 'AUTH_LOGIN_INVALID', 'AUTH_LOGIN_REQUIRED'].includes(code)) return authAccountErrorMessage(error);
  if (status === 403 && code === 'INVITE_EMAIL_MISMATCH') return '초대받은 이메일을 확인해 주세요.';
  if (status === 403 && code === 'EMAIL_VERIFICATION_REQUIRED') return '이메일 인증을 완료해야 회원가입할 수 있습니다.';
  if (status === 409) return '이미 처리된 초대입니다. 초대 상태를 다시 확인해 주세요.';
  if (status === 410) return '만료된 초대 링크입니다. 다시 초대를 요청해 주세요.';
  if (status === 404) return '초대 링크를 찾을 수 없습니다.';
  return message || '초대 처리 중 오류가 발생했습니다.';
}

export default function InviteAcceptScreen({ token, authUser = null, onAccepted, onBack, onLogout }) {
  const [invite, setInvite] = useState(null);
  const [mode, setMode] = useState(authUser ? 'login' : 'login');
  const [form, setForm] = useState({
    name: '',
    email: normalizeEmail(authUser?.email),
    phone: '',
    password: '',
    password2: '',
    verificationCode: '',
  });
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const invitedEmail = normalizeEmail(invite?.email);
  const currentEmail = normalizeEmail(form.email);
  const emailMatches = !!invitedEmail && currentEmail === invitedEmail;
  const canSubmit = !!invite && !!currentEmail && emailMatches && (mode !== 'signup' || emailVerified);

  const helperText = useMemo(() => {
    if (!invite) return '';
    if (!currentEmail) return '초대받은 이메일로 로그인하거나 회원가입해 주세요.';
    if (!emailMatches) return '초대받은 이메일을 확인해 주세요.';
    if (mode === 'signup' && !emailVerified) return '회원가입은 이메일 인증 완료 후 진행됩니다.';
    return '이 이메일로 초대된 페이지를 바로 불러옵니다.';
  }, [currentEmail, emailMatches, emailVerified, invite, mode]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchServerManagerInvite(token)
      .then((nextInvite) => {
        if (!alive) return;
        if (!nextInvite) {
          setError('초대 링크를 찾을 수 없습니다.');
          return;
        }
        setInvite(nextInvite);
        setForm((current) => ({
          ...current,
          name: current.name || nextInvite.name || authUser?.name || '',
          email: normalizeEmail(authUser?.email || current.email || nextInvite.email),
        }));
      })
      .catch((err) => {
        if (alive) setError(inviteErrorMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [authUser?.email, authUser?.name, token]);

  const set = (key, value) => {
    setError('');
    setNotice('');
    if (key === 'email') setEmailVerified(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const verifyEmail = async () => {
    setError('');
    setNotice('');
    if (!currentEmail) {
      setError('이메일을 입력해 주세요.');
      return;
    }
    if (!emailMatches) {
      setError('초대받은 이메일을 확인해 주세요.');
      return;
    }

    setSaving(true);
    try {
      if (form.verificationCode.trim()) {
        await confirmEmailVerification({ email: currentEmail, token: form.verificationCode.trim() });
        setEmailVerified(true);
        setNotice('이메일 인증이 완료되었습니다.');
        return;
      }

      const verification = await requestEmailVerification(currentEmail, 'signup');
      const verificationToken = String(verification?.token || '').trim();
      if (!verificationToken) {
        setNotice('인증 메일을 보냈습니다. 이메일로 받은 인증 코드를 입력해 주세요.');
        return;
      }
      await confirmEmailVerification({ email: currentEmail, token: verificationToken });
      setForm((current) => ({ ...current, verificationCode: verificationToken }));
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
    setError('');
    setNotice('');

    if (!currentEmail || !form.password) {
      setError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    if (!emailMatches) {
      setError('초대받은 이메일을 확인해 주세요.');
      return;
    }
    if (mode === 'signup') {
      const phone = normalizeAccountPhone(form.phone);
      if (!form.name.trim()) {
        setError('이름을 입력해 주세요.');
        return;
      }
      if (!phone) {
        setError('휴대폰번호를 입력해 주세요.');
        return;
      }
      if (!isValidAccountPassword(form.password)) {
        setError('비밀번호는 영문과 숫자를 포함해 6자 이상으로 입력해 주세요.');
        return;
      }
      if (form.password !== form.password2) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      if (!emailVerified) {
        setError('이메일 인증을 완료해야 회원가입할 수 있습니다.');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await acceptServerManagerInvite(token, {
        name: form.name,
        email: currentEmail,
        phone: normalizeAccountPhone(form.phone),
        password: form.password,
        authMode: mode,
        token: mode === 'signup' ? form.verificationCode.trim() : '',
      });
      onAccepted(result);
    } catch (err) {
      setError(inviteErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        {onBack && <button className="auth-back" type="button" onClick={onBack}>메인으로</button>}
        <div className="auth-brand">
          <strong>Inlet</strong>
          <span>매니저 초대</span>
        </div>
        <div className="auth-copy">
          <h1>{mode === 'signup' ? '회원가입 후 참여' : '로그인 후 참여'}</h1>
          <p>초대받은 이메일과 현재 계정 이메일이 일치해야 페이지가 열립니다.</p>
        </div>
        {loading ? (
          <p className="auth-error">초대 정보를 확인하는 중입니다.</p>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {invite && <p className={emailMatches ? 'auth-notice' : 'auth-error'}>{invite.email} 계정으로 초대되었습니다.</p>}
            {authUser && (
              <p className={emailMatches ? 'auth-notice' : 'auth-error'}>
                현재 로그인: {authUser.email || '이메일 없음'}
                {!emailMatches && onLogout ? ' - 다른 이메일이면 로그아웃 후 다시 로그인하세요.' : ''}
              </p>
            )}
            {mode === 'signup' && (
              <label>
                <span>이름</span>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="이름" />
              </label>
            )}
            {mode === 'signup' && (
              <label>
                <span>핸드폰번호</span>
                <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01012345678" />
              </label>
            )}
            <label>
              <span>이메일</span>
              <input type="text" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set('email', normalizeEmail(e.target.value))} placeholder="email@example.com" readOnly={!!authUser} />
            </label>
            <label>
              <span>비밀번호</span>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="비밀번호" />
            </label>
            {mode === 'signup' && (
              <>
                <label>
                  <span>비밀번호 확인</span>
                  <input type="password" value={form.password2} onChange={(e) => set('password2', e.target.value)} placeholder="비밀번호 확인" />
                </label>
                {!emailVerified && (
                  <label>
                    <span>인증 코드</span>
                    <input value={form.verificationCode} onChange={(e) => set('verificationCode', e.target.value)} placeholder="이메일 인증 코드" />
                  </label>
                )}
                <button className="ghost-btn" type="button" onClick={verifyEmail} disabled={!invite || emailVerified || saving}>
                  {emailVerified ? '이메일 인증 완료' : form.verificationCode ? '인증 코드 확인' : '인증 메일 보내기'}
                </button>
              </>
            )}
            {helperText && <p className={emailMatches ? 'auth-notice' : 'auth-error'}>{helperText}</p>}
            {notice && <p className="auth-notice">{notice}</p>}
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" disabled={saving || !canSubmit}>{saving ? '처리 중' : '초대 페이지 열기'}</button>
          </form>
        )}
        {authUser && onLogout && <button className="auth-switch" type="button" onClick={onLogout}>다른 계정으로 로그인</button>}
        {!authUser && (
          <button className="auth-switch" type="button" onClick={() => { setError(''); setNotice(''); setMode(mode === 'login' ? 'signup' : 'login'); setEmailVerified(false); }}>
            {mode === 'login' ? '계정이 없으면 회원가입' : '이미 계정이 있으면 로그인'}
          </button>
        )}
      </section>
    </div>
  );
}
