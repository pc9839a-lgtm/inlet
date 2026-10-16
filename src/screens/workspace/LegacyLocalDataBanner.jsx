import React, { useEffect, useRef, useState } from 'react';
import { isServerLeadMode } from '../../config/runtimeConfig.js';
import { projectContext } from '../../lib/projectContext.js';
import { apiFetch, postJson, projectAuthHeaders } from '../../lib/apiClient.js';
import { buildLegacyLocalArchive, collectScopedLegacyRows, inspectLegacyLocalData } from '../../lib/legacyLocalMigration.js';
import './LegacyLocalDataBanner.css';

const APPROVAL = 'I_CONFIRM_LOCAL_DATA_IMPORT';
const MAX_MANUAL_ROWS = 100;
const BATCH_LIMIT = 20;

function readSummary() {
  if (typeof window === 'undefined') return { items:[], total:0, needsAttention:false, hasErrors:false };
  try { return inspectLegacyLocalData(window.localStorage); }
  catch { return {items:[{kind:'leads',count:0,unreadable:true}], total:0, needsAttention:true, hasErrors:true}; }
}

function chooseRows(context) {
  try { return collectScopedLegacyRows(window.localStorage, context); }
  catch { return {eligible:{leads:[],events:[]}, excluded:0, unreadable:true, reason:'로컬 저장소 접근 오류'}; }
}

export default function LegacyLocalDataBanner({ authUser = null, page = {} }) {
  const [summary,setSummary] = useState(readSummary);
  const [error,setError] = useState('');
  const [info,setInfo] = useState('');
  const [backedUp,setBackedUp] = useState(false);
  const [confirming,setConfirming] = useState(false);
  const [acknowledged,setAcknowledged] = useState(false);
  const [enabled,setEnabled] = useState(false);
  const [busy,setBusy] = useState(false);
  const backedUpSnapshotRef = useRef(null);
  const context = projectContext(page,authUser);
  const selection = chooseRows(context);
  const selectedCount = selection.eligible.leads.length + selection.eligible.events.length;

  useEffect(() => {
    if (!isServerLeadMode() || !authUser) return undefined;
    const refresh = () => setSummary(readSummary());
    refresh();
    window.addEventListener('storage',refresh);
    return () => window.removeEventListener('storage',refresh);
  }, [authUser?.session, authUser?.ownerId]);

  useEffect(() => {
    setEnabled(false);
    setBackedUp(false);
    setConfirming(false);
    setAcknowledged(false);
    backedUpSnapshotRef.current=null;
  }, [authUser?.session,context.projectId,context.ownerId,context.slug]);

  useEffect(() => {
    if (!backedUp || !isServerLeadMode() || !authUser?.session || !context.projectId) return undefined;
    let alive=true;
    // Consent-driven only: never query migration APIs on ordinary page load.
    const params=new URLSearchParams({projectId:context.projectId,ownerId:context.ownerId,slug:context.slug});
    apiFetch('/api/local-migration?'+params.toString(),{headers:projectAuthHeaders(context)})
      .then(async response => response.ok?response.json():{enabled:false})
      .then(result => {if(alive)setEnabled(result.enabled === true)})
      .catch(()=>{if(alive)setEnabled(false)});
    return () => {alive=false};
  }, [backedUp,authUser?.session,context.projectId,context.ownerId,context.slug]);

  if (!isServerLeadMode() || !authUser || !summary.needsAttention) return null;

  const downloadBackup = () => {
    try {
      const archive=buildLegacyLocalArchive(window.localStorage);
      const file=new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(file);
      const link=document.createElement('a');
      link.href=url;
      link.download='pagero-local-recovery-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),30000); }
      backedUpSnapshotRef.current=archive.snapshots;
      setBackedUp(true);
      setError('');
      setInfo('원본 백업 다운로드를 요청했습니다. 파일이 실제 저장됐는지 확인하고 이관을 진행하세요.');
      setConfirming(false);
    } catch (cause) {
      setBackedUp(false);
      backedUpSnapshotRef.current=null;
      setError(String(cause?.message||'로컬 백업 파일 생성에 실패했습니다.'));
    }
  };

  const importConfirmed = async () => {
    if (busy || !backedUp || !acknowledged || !enabled) return;
    setBusy(true);
    setError('');
    setInfo('');
    let count=0, reused=0;
    try {
      const before=backedUpSnapshotRef.current;
      const current=buildLegacyLocalArchive(window.localStorage).snapshots;
      if (!before || new Set([...Object.keys(before),...Object.keys(current)]).size !== Object.keys(before).length
        || Object.keys(before).some(key => before[key] !== current[key])) {
        throw new Error('백업 이후 로컬 데이터가 바뀌었습니다. 원본을 다시 백업하고 진행하세요.');
      }
      const scoped=chooseRows(context);
      const total=scoped.eligible.leads.length+scoped.eligible.events.length;
      if (scoped.unreadable || total===0 || total>MAX_MANUAL_ROWS) throw new Error(scoped.reason||'이관 가능한 원본 1~100개를 확인해 주세요.');
      for (const kind of ['leads','events']) {
        const all=scoped.eligible[kind];
        for (let i=0;i<all.length;i+=BATCH_LIMIT) {
          const items=all.slice(i,i+BATCH_LIMIT);
          const payload={project:context,kind,items};
          const preview=await postJson('/api/local-migration',{...payload,mode:'preview'},{headers:projectAuthHeaders(context)});
          if (preview?.eligible!==items.length) throw new Error('미리보기 결과가 원본과 일치하지 않습니다.');
          const result=await postJson('/api/local-migration',{
            ...payload,mode:'commit',confirm:APPROVAL,originalBackupConfirmed:true,
          },{headers:projectAuthHeaders(context)});
          if (result?.verified!==items.length) throw new Error('서버 저장 후 재조회 결과가 일치하지 않습니다.');
          count+=result.inserted||0;
          reused+=result.alreadyPresent||0;
          setInfo('서버 재조회 완료: 신규 '+count+'건, 기존 '+reused+'건. 원본 데이터는 그대로 보존합니다.');
        }
      }
      setConfirming(false);
    } catch (cause) {
      setError('서버 이관 중단: '+String(cause?.message||'요청 실패')+'. 이미 확인된 저장 '+count+'건, 중복 '+reused+'건. 로컬 원본은 보존되어 재시도할 수 있습니다.');
    } finally {
      setBusy(false);
    }
  };

  const leads=summary.items.find(x=>x.kind==='leads')?.count||0;
  const events=summary.items.find(x=>x.kind==='events')?.count||0;
  return (
    <section className="pagero-legacy-data-banner" aria-label="브라우저 데이터 이전 안내">
      <div className="pagero-legacy-data-copy">
        <strong>이전 브라우저 데이터가 남아 있습니다</strong>
        <p>접수 {leads}건 · 이벤트 {events}건{summary.hasErrors?' · 읽기 오류 또는 형식 확인 필요':''}</p>
        <small>서버에 자동 병합하지 않습니다. 원본 JSON 백업 후 출처 프로젝트가 확인된 자료만 수동 이관할 수 있습니다.</small>
        <small>현재 페이지 이관 가능: {selectedCount}건 · 출처 불명 또는 다른 프로젝트 제외: {selection.excluded}건</small>
        {!enabled ? <small>{backedUp ? '서버 이관은 운영자 활성화 후 이용할 수 있습니다. 원본은 그대로 유지됩니다.' : '백업 파일을 먼저 받은 후 서버 이관 활성화 상태를 확인합니다.'}</small> : null}
        {selection.unreadable ? <small className="pagero-legacy-data-error">{selection.reason}</small> : null}
        {info ? <small role="status">{info}</small> : null}
        {error ? <small role="alert" className="pagero-legacy-data-error">{error}</small> : null}
        {confirming ? (
          <div className="pagero-legacy-migration-confirm">
            <label>
              <input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)} />
              백업 파일 저장을 확인했고, 현재 프로젝트의 자료만 서버에 이관하는 데 동의합니다.
            </label>
            <div>
              <button type="button" disabled={!acknowledged||busy} onClick={importConfirmed}>
                {busy?'이관 및 서버 재조회 중':'확인 후 서버 이관'}
              </button>
              <button type="button" disabled={busy} onClick={()=>setConfirming(false)}>취소</button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="pagero-legacy-data-actions">
        <button type="button" disabled={busy} onClick={downloadBackup}>로컬 원본 백업 (JSON)</button>
        {enabled && backedUp && !confirming && selectedCount>0 && selectedCount<=MAX_MANUAL_ROWS && !selection.unreadable ? (
          <button type="button" disabled={busy} onClick={()=>{setAcknowledged(false);setConfirming(true)}}>서버 이관 내용 확인</button>
        ) : null}
      </div>
    </section>
  );
}
