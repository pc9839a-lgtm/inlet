import { useEffect, useMemo, useState } from 'react';
import {
  AI_MODEL_OPTIONS,
  AI_STORAGE_NOTICE,
  getAiStatusLabel,
  isValidOpenAiKey,
  maskApiKey,
  normalizeAiSettings,
} from './aiSettings';
import {
  AI_APPLY_MODE_OPTIONS,
  AI_CONTACT_OPTIONS,
  AI_GOAL_OPTIONS,
  AI_SECTION_OPTIONS,
  AI_TEMPLATE_OPTIONS,
  AI_TONE_OPTIONS,
  EMPTY_AI_DRAFT_INPUT,
  normalizeAiDraftInput,
} from './aiDraftSchema';
import { generateAiDraft, testOpenAiKey } from './aiDraftGenerator';
import { AI_BLOCK_LABELS, applyAiDraftToPage } from './aiDraftApply';
import { isClientAiKeyStorageEnabled, isServerAiMode } from '../config/runtimeConfig.js';
import { deleteServerAiDraft, fetchServerAiDrafts, saveServerAiDraft } from '../lib/aiDraftRepository.js';
import './ai.css';

const GOAL_LABELS = ['상담 신청', '방문 예약', '견적 문의', '이벤트 신청', '상품 문의'];
const CONTACT_LABELS = ['상담 폼', '방문 예약', '전화', '카카오톡', '상담 폼 + 전화'];
const TEMPLATE_LABELS = ['자동 추천', '신뢰형', '프로모션형', '예약 전환형', '스토리형', '비교형'];
const TONE_LABELS = ['심플', '고급', '친근', '전문', '강한 CTA'];
const SECTION_LABELS = {
  hero: '첫 화면',
  benefit: '혜택',
  links: '문의 링크',
  map: '지도',
  timer: '마감 타이머',
  activity: '실시간 접수',
  form: '상담 폼',
  reservation: '예약',
  faq: 'FAQ',
};

const TEMPLATE_RECOMMENDATIONS = [
  { match: 1, name: '예약 전환형', summary: '방문 시간 선택과 문의 행동을 앞쪽에 배치합니다.', aiStyle: 'booking', sections: ['hero', 'benefit', 'reservation', 'links', 'faq'] },
  { match: 2, name: '견적 문의형', summary: '조건 확인과 상담 폼 중심으로 초안을 구성합니다.', aiStyle: 'compare', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
  { match: 3, name: '이벤트 신청형', summary: '마감감과 신청 흐름을 강조합니다.', aiStyle: 'promo', sections: ['hero', 'benefit', 'timer', 'links', 'form'] },
  { match: 0, name: '상담 신청형', summary: '핵심 혜택과 상담 신청을 빠르게 연결합니다.', aiStyle: 'trust', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
  { match: 4, name: '상품 문의형', summary: '상품 장점과 문의 전환을 균형 있게 배치합니다.', aiStyle: 'trust', sections: ['hero', 'benefit', 'links', 'form', 'faq'] },
];

function optionLabel(options, labels, value) {
  const index = options.findIndex(([key]) => key === value);
  return labels[index] || options[index]?.[1] || value || '';
}

function recommendTemplateForInput(input = {}) {
  const goalIndex = AI_GOAL_OPTIONS.findIndex(([key]) => key === input.goal);
  return TEMPLATE_RECOMMENDATIONS.find((item) => item.match === goalIndex) || TEMPLATE_RECOMMENDATIONS[3];
}

function recommendedInputPatch(recommendation = {}) {
  return {
    templateStyle: recommendation.aiStyle || 'trust',
    sections: recommendation.sections || EMPTY_AI_DRAFT_INPUT.sections,
  };
}

function Field({ label, value, onChange, textarea = false, placeholder = '', type = 'text' }) {
  return (
    <label className={`ai-field ${textarea ? 'textarea' : ''}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options, labels }) {
  return (
    <label className="ai-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([key, text], index) => <option key={key} value={key}>{labels?.[index] || text}</option>)}
      </select>
    </label>
  );
}

function GoalPicker({ value, onChange }) {
  return (
    <div className="ai-purpose-grid" role="group" aria-label="AI 랜딩 목적">
      {AI_GOAL_OPTIONS.map(([key], index) => (
        <button key={key} type="button" className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {GOAL_LABELS[index] || key}
        </button>
      ))}
    </div>
  );
}

function ToggleGroup({ options, labels, value, onChange }) {
  return (
    <div className="ai-chip-group">
      {options.map(([key, text], index) => (
        <button key={key} type="button" className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {labels?.[index] || text}
        </button>
      ))}
    </div>
  );
}

function SectionPicker({ value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="ai-section-picker compact">
      <span>포함할 섹션</span>
      <div>
        {AI_SECTION_OPTIONS.map(([key]) => (
          <button
            key={key}
            type="button"
            className={selected.includes(key) ? 'active' : ''}
            onClick={() => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key])}
          >
            {SECTION_LABELS[key] || key}
          </button>
        ))}
      </div>
    </div>
  );
}

function draftHistoryItem(draft, input, model) {
  const createdAt = new Date().toISOString();
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt,
    pageTitle: draft.pageTitle || 'AI 초안',
    blockCount: blocks.length,
    model,
    input,
    draft,
  };
}

function draftBlockKey(block, index) {
  return `${block?.type || 'block'}-${index}`;
}

function formatDraftTime(value = '') {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR');
}

function templateLabel(value = '') {
  return optionLabel(AI_TEMPLATE_OPTIONS, TEMPLATE_LABELS, value) || 'AI 초안';
}

function extractDraftInput(input) {
  const prompt = String(input.prompt || '').trim();
  const fallbackIndustry = prompt.split(/\s+/).slice(0, 3).join(' ');
  return normalizeAiDraftInput({
    ...input,
    industry: String(input.industry || '').trim() || fallbackIndustry,
  });
}

function draftQualityWarnings(draft) {
  const safeDraft = draft || {};
  return Array.isArray(safeDraft.qualityWarnings) ? safeDraft.qualityWarnings.filter(Boolean) : [];
}

function draftEditabilitySummary(draft) {
  const safeDraft = draft || {};
  const blocks = Array.isArray(safeDraft.blocks) ? safeDraft.blocks : [];
  const types = [...new Set(blocks.map((block) => block?.type).filter(Boolean))];
  const hasLeadCapture = types.includes('form') || types.includes('reservation');
  const hasQuestionBlock = blocks.some((block) => Array.isArray(block?.questions) || Array.isArray(block?.customFields));
  return {
    blockCount: blocks.length,
    types,
    ok: blocks.length >= 4 && hasLeadCapture && hasQuestionBlock,
  };
}

function useServerDraftHistory(serverAi, page, authUser, updateAi) {
  useEffect(() => {
    if (!serverAi) return undefined;
    let alive = true;
    fetchServerAiDrafts(page, authUser)
      .then((items) => {
        if (alive && items) updateAi({ draftHistory: items });
      })
      .catch((error) => console.warn('Server AI drafts load failed:', error));
    return () => { alive = false; };
  }, [serverAi, page.slug, page.projectId, authUser]);
}

export function AiPanel({ page, updateAi, setPage, authUser = null }) {
  const ai = normalizeAiSettings(page.ai || {});
  const serverAi = isServerAiMode();
  const canStoreClientKey = isClientAiKeyStorageEnabled();
  const [apiKeyDraft, setApiKeyDraft] = useState(ai.apiKey || '');
  const [input, setInput] = useState(() => normalizeAiDraftInput(page.ai?.draftInput || EMPTY_AI_DRAFT_INPUT));
  const [detailOpen, setDetailOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState(null);
  const [excludedBlockKeys, setExcludedBlockKeys] = useState([]);
  const [applyMode, setApplyMode] = useState('replace');
  const [applyOptions, setApplyOptions] = useState({ updateTheme: true, updateFixed: true });
  const [error, setError] = useState('');
  const draftHistory = Array.isArray(ai.draftHistory) ? ai.draftHistory : [];
  const recommendedTemplate = useMemo(() => recommendTemplateForInput(input), [input.goal]);
  const hasPrompt = String(input.prompt || '').trim().length > 0;
  const clientApiKey = apiKeyDraft.trim() || ai.apiKey;
  const canGenerate = (serverAi || isValidOpenAiKey(clientApiKey)) && hasPrompt && !generating;
  const generateUnavailableReason = !hasPrompt
    ? '먼저 만들 페이지를 한 문장 이상 입력하세요.'
    : serverAi
      ? ''
      : !isValidOpenAiKey(clientApiKey)
        ? 'OpenAI API Key를 저장하거나 서버 AI 모드로 실행해야 합니다.'
        : '';
  const selectedDraftBlocks = (draft?.blocks || []).filter((block, index) => !excludedBlockKeys.includes(draftBlockKey(block, index)));
  const qualityWarnings = draftQualityWarnings(draft);
  const editability = draftEditabilitySummary(draft);
  const connectionTitle = serverAi
    ? '서버 중계 + 고객 API 키'
    : canStoreClientKey
      ? '브라우저 API 키 저장 허용'
      : '현재 화면에서만 API 키 사용';
  const connectionNote = serverAi
    ? '입력한 API 키는 저장하지 않고 이번 요청에만 서버로 전달합니다. 입력하지 않으면 서버 환경변수 키를 사용합니다.'
    : canStoreClientKey
      ? 'API 키를 브라우저 저장소에 저장합니다. 개인 기기에서만 사용하세요.'
      : '기본 정책상 API 키를 저장하지 않습니다. 새로고침하면 다시 입력해야 합니다.';

  useServerDraftHistory(serverAi, page, authUser, updateAi);

  const updateInput = (patch) => {
    const next = normalizeAiDraftInput({ ...input, ...patch });
    setInput(next);
    updateAi({ ...ai, draftInput: next });
  };

  const saveApi = () => {
    if (serverAi) {
      const key = apiKeyDraft.trim();
      if (key && !isValidOpenAiKey(key)) {
        updateAi({ ...ai, lastTestStatus: 'failed', lastTestMessage: 'API 키 형식을 확인해주세요.' });
        return;
      }
      updateAi({
        ...ai,
        enabled: true,
        apiKey: '',
        updatedAt: new Date().toISOString(),
        lastTestStatus: 'saved',
        lastTestMessage: key ? '고객 API 키를 이번 세션에서만 사용합니다. 저장하지 않습니다.' : '서버 환경변수 API 키를 사용합니다.',
      });
      return;
    }

    const key = apiKeyDraft.trim();
    if (key && !isValidOpenAiKey(key)) {
      updateAi({ ...ai, lastTestStatus: 'failed', lastTestMessage: 'API 키 형식을 확인해주세요.' });
      return;
    }

    updateAi({
      ...ai,
      enabled: !!key,
      apiKey: canStoreClientKey ? key : '',
      updatedAt: new Date().toISOString(),
      lastTestStatus: key ? 'saved' : 'idle',
      lastTestMessage: key ? (canStoreClientKey ? 'API 키를 저장했습니다.' : 'API 키를 현재 화면에서만 사용합니다. 새로고침하면 다시 입력해야 합니다.') : '',
    });
  };

  const clearApi = () => {
    setApiKeyDraft('');
    updateAi({
      ...ai,
      enabled: false,
      apiKey: '',
      lastTestStatus: 'idle',
      lastTestMessage: '',
      updatedAt: new Date().toISOString(),
    });
  };

  const runTest = async () => {
    setError('');
    const key = apiKeyDraft.trim();
    if (!serverAi && !isValidOpenAiKey(key)) {
      updateAi({ ...ai, lastTestStatus: 'failed', lastTestMessage: 'API 키 형식을 확인해주세요.' });
      return;
    }

    setTesting(true);
    updateAi({ ...ai, apiKey: serverAi || !canStoreClientKey ? '' : key, enabled: true, lastTestStatus: 'testing', lastTestMessage: '연결 확인 중' });
    try {
      await testOpenAiKey({ apiKey: key, model: ai.model });
      updateAi({
        ...ai,
        apiKey: serverAi || !canStoreClientKey ? '' : key,
        enabled: true,
        lastTestStatus: 'success',
        lastTestMessage: serverAi ? '서버 AI 연결을 확인했습니다.' : 'API 연결을 확인했습니다.',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      updateAi({
        ...ai,
        apiKey: serverAi || !canStoreClientKey ? '' : key,
        enabled: true,
        lastTestStatus: 'failed',
        lastTestMessage: `연결 테스트 실패: ${String(err?.message || err).slice(0, 320)}`,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setTesting(false);
    }
  };

  const generate = async () => {
    setError('');
    setDraft(null);

    if (!serverAi && !isValidOpenAiKey(clientApiKey)) {
      setError('상단에서 OpenAI API 키를 먼저 저장해주세요.');
      return;
    }

    if (!hasPrompt) {
      setError('무엇을 만들지 한 문장 이상 입력해주세요.');
      return;
    }

    setGenerating(true);
    try {
      const autoTemplatePatch = input.templateStyle === 'auto'
        ? {
            templateStyle: recommendedTemplate.aiStyle || 'trust',
            templateMeta: {
              industry: recommendedTemplate.industry,
              receivedDb: '',
              recommendedFor: recommendedTemplate.summary,
              formPreview: '',
            },
          }
        : {};
      const inputForGenerate = extractDraftInput({
        ...input,
        inputMode: detailOpen ? 'detail' : 'simple',
        ...autoTemplatePatch,
      });
      setInput(inputForGenerate);
      const result = await generateAiDraft({ apiKey: clientApiKey, model: ai.model, input: inputForGenerate });
      const item = draftHistoryItem(result, inputForGenerate, ai.model);
      setDraft({ ...result, historyId: item.id });
      setExcludedBlockKeys([]);
      updateAi({
        ...ai,
        draftInput: inputForGenerate,
        draftHistory: [item, ...draftHistory.filter((history) => history.id !== item.id)].slice(0, 8),
        updatedAt: item.createdAt,
      });
      saveServerAiDraft(item, page, authUser).catch((err) => console.warn('Server AI draft save failed:', err));
    } catch (err) {
      setError(String(err?.message || err).slice(0, 420));
    } finally {
      setGenerating(false);
    }
  };

  const apply = () => {
    if (!draft) return;
    const effectiveDraft = {
      ...draft,
      blocks: (draft.blocks || []).filter((block, index) => !excludedBlockKeys.includes(draftBlockKey(block, index))),
    };
    if (effectiveDraft.blocks.length < 4) {
      setError('적용할 블록이 너무 적습니다. 최소 4개 이상 남겨주세요.');
      return;
    }
    try {
      setPage((prev) => applyAiDraftToPage(prev, effectiveDraft, { mode: applyMode, ...applyOptions }));
      updateAi({ ...ai, lastAppliedDraftId: draft.historyId || '', updatedAt: new Date().toISOString() });
      setDraft(null);
      setExcludedBlockKeys([]);
      setError('');
    } catch (err) {
      setError(String(err?.message || err).slice(0, 420));
    }
  };

  const loadDraft = (item) => {
    if (!item?.draft) return;
    setDraft({ ...item.draft, historyId: item.id });
    setExcludedBlockKeys([]);
    if (item.input) {
      const nextInput = normalizeAiDraftInput(item.input);
      setInput(nextInput);
      updateAi({ ...ai, draftInput: nextInput });
    }
  };

  const deleteDraft = (id) => {
    updateAi({ ...ai, draftHistory: draftHistory.filter((item) => item.id !== id) });
    deleteServerAiDraft(id, page, authUser).catch((err) => console.warn('Server AI draft delete failed:', err));
  };

  return (
    <div className="ai-panel ai-panel-simple">
      <section className="card ai-card ai-start-card">
        <div className="ai-hero-copy">
          <span>AI로 시작</span>
          <h2>무엇을 만들까요?</h2>
          <p>설명 한 줄과 목적만 정하면 AI가 랜딩 초안을 만듭니다. 세부 설정은 필요할 때만 열어 조정하세요.</p>
        </div>

        <div className="ai-access-card">
          {serverAi ? (
            <div className="ai-access-main">
              <label>
                <span>OpenAI API Key</span>
                <input type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} placeholder="sk-..." />
                <small>{connectionNote}</small>
              </label>
              <em className={`status-${ai.lastTestStatus || 'idle'}`}>{getAiStatusLabel(ai.lastTestStatus)}</em>
            </div>
          ) : (
            <div className="ai-access-main">
              <label>
                <span>OpenAI API Key</span>
                <input type="password" value={apiKeyDraft} onChange={(event) => setApiKeyDraft(event.target.value)} placeholder="sk-..." />
                {canStoreClientKey && ai.apiKey ? <small>저장됨: {maskApiKey(ai.apiKey)}</small> : <small>{connectionNote}</small>}
              </label>
            </div>
          )}
          <div className="ai-access-actions">
            <button type="button" onClick={saveApi}>{serverAi ? '이번 세션 사용' : 'API 키 저장'}</button>
            <button type="button" className="ghost" onClick={runTest} disabled={testing}>{testing ? '확인 중' : '연결 테스트'}</button>
            {!serverAi && <button type="button" className="ghost" onClick={clearApi}>삭제</button>}
          </div>
          {(ai.lastTestMessage || !serverAi) && (
            <p className="ai-access-note">
              {ai.lastTestMessage || AI_STORAGE_NOTICE}
            </p>
          )}
        </div>

        <div className="ai-simple-start">
          <Field
            label="자유 설명"
            textarea
            value={input.prompt}
            onChange={(value) => updateInput({ prompt: value })}
            placeholder="예: 피부관리샵 첫 방문 예약 랜딩. 민감성 피부 상담, 카카오 문의, 방문 예약이 필요해."
          />
          <div className="ai-purpose-block">
            <span>목적 선택</span>
            <GoalPicker value={input.goal} onChange={(goal) => updateInput({ goal })} />
          </div>
        </div>

        <div className="ai-required-strip">
          <span className={canGenerate ? 'ready' : ''}>{canGenerate ? '생성 준비 완료' : 'API 설정과 설명 입력이 필요합니다'}</span>
          <small>생성 후에는 블록별로 제외/적용을 고르고, 적용된 초안은 기존 편집기에서 문구·버튼·폼·예약·링크를 수정합니다.</small>
        </div>

        <details className="ai-fold" open={detailOpen} onToggle={(event) => setDetailOpen(event.currentTarget.open)}>
          <summary>상세 입력 선택</summary>
          <div className="ai-fold-body">
            <div className="ai-form-grid">
              <Field label="업종/키워드" value={input.industry} onChange={(value) => updateInput({ industry: value })} placeholder="예: 피부관리샵, 세무 상담" />
              <Field label="서비스명" value={input.serviceName} onChange={(value) => updateInput({ serviceName: value })} placeholder="예: 바른케어" />
              <Field label="주요 혜택" value={input.benefit} onChange={(value) => updateInput({ benefit: value })} placeholder="비워두면 AI가 목적에 맞게 제안" />
              <Field label="대상 고객" value={input.targetCustomer} onChange={(value) => updateInput({ targetCustomer: value })} placeholder="예: 첫 방문 고객, 견적 비교 고객" />
              <Field label="CTA 문구" value={input.cta} onChange={(value) => updateInput({ cta: value })} placeholder="예: 상담 신청하기" />
              <Field label="강조 메시지" value={input.keyMessage} onChange={(value) => updateInput({ keyMessage: value })} placeholder="꼭 들어가야 하는 메시지" />
            </div>
            <div className="ai-detail-grid">
              <div>
                <span>연락 방식</span>
                <ToggleGroup options={AI_CONTACT_OPTIONS} labels={CONTACT_LABELS} value={input.contactMethod} onChange={(contactMethod) => updateInput({ contactMethod })} />
              </div>
              <div>
                <span>톤</span>
                <ToggleGroup options={AI_TONE_OPTIONS} labels={TONE_LABELS} value={input.tone} onChange={(tone) => updateInput({ tone })} />
              </div>
              <div>
                <span>스타일</span>
                <ToggleGroup options={AI_TEMPLATE_OPTIONS} labels={TEMPLATE_LABELS} value={input.templateStyle} onChange={(templateStyle) => updateInput({ templateStyle })} />
              </div>
              <SectionPicker value={input.sections} onChange={(sections) => updateInput({ sections })} />
              <SelectField label="AI model" value={ai.model} onChange={(model) => updateAi({ ...ai, model })} options={AI_MODEL_OPTIONS} />
            </div>
            <div className="ai-template-recommend">
              <div>
                <span>추천 템플릿</span>
                <strong>{recommendedTemplate.name}</strong>
                <p>{recommendedTemplate.summary}</p>
              </div>
              <button type="button" onClick={() => updateInput(recommendedInputPatch(recommendedTemplate))}>추천 적용</button>
            </div>
          </div>
        </details>

        {error && <div className="ai-error"><strong>{error}</strong></div>}

        <div className="ai-generate-actions">
          <button type="button" onClick={generate} disabled={!canGenerate}>{generating ? '초안 생성 중' : 'AI 초안 생성'}</button>
          {generateUnavailableReason && <small>{generateUnavailableReason}</small>}
        </div>
      </section>

      {draft && (
        <section className="card ai-card ai-result-card">
          <div className="ai-result-head">
            <div>
              <h2>{draft.pageTitle || 'AI 초안'}</h2>
              <p>{templateLabel(draft.templateStyle)} · {(draft.blocks || []).length}개 블록 생성</p>
            </div>
          </div>

          <div className="ai-result-list">
            {(draft.blocks || []).map((block, index) => {
              const key = draftBlockKey(block, index);
              return (
                <button
                  key={key}
                  type="button"
                  className={excludedBlockKeys.includes(key) ? 'excluded' : ''}
                  onClick={() => setExcludedBlockKeys((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key])}
                >
                  <b>{index + 1}</b>
                  <span>{AI_BLOCK_LABELS[block.type] || block.type}</span>
                  <em>{excludedBlockKeys.includes(key) ? '제외' : '적용'}</em>
                </button>
              );
            })}
          </div>

          <div className="ai-result-review">
            <div>
              <span>편집 가능성 확인</span>
              <strong>{editability.ok ? `기존 편집 블록 ${editability.blockCount}개로 변환 가능합니다.` : '폼/예약 또는 편집 블록 구성이 부족합니다.'}</strong>
            </div>
            <div>
              <span>생성 블록</span>
              <strong>{editability.types.join(', ') || '없음'}</strong>
            </div>
            {qualityWarnings.length > 0 && (
              <div className="warning">
                <span>품질 경고</span>
                <strong>{qualityWarnings.slice(0, 3).join(' / ')}</strong>
              </div>
            )}
          </div>

          <div className="ai-apply-area">
            <div className="ai-apply-mode">
              <span>적용 방식</span>
              <div>
                {AI_APPLY_MODE_OPTIONS.map(([key, label]) => (
                  <button key={key} type="button" className={applyMode === key ? 'active' : ''} onClick={() => setApplyMode(key)}>
                    {key === 'replace' ? '기존 화면 교체' : '아래에 추가'}
                  </button>
                ))}
              </div>
            </div>

            {applyMode === 'replace' && (
              <div className="ai-apply-options">
                <label>
                  <input type="checkbox" checked={applyOptions.updateTheme} onChange={(event) => setApplyOptions((prev) => ({ ...prev, updateTheme: event.target.checked }))} />
                  <span>AI 추천 색상/테마 적용</span>
                </label>
                <label>
                  <input type="checkbox" checked={applyOptions.updateFixed} onChange={(event) => setApplyOptions((prev) => ({ ...prev, updateFixed: event.target.checked }))} />
                  <span>상단 메뉴/하단 버튼도 초안에 맞춤</span>
                </label>
              </div>
            )}
          </div>

          <div className="ai-actions">
            <button type="button" onClick={apply} disabled={selectedDraftBlocks.length < 4}>
              {applyMode === 'append' ? '선택 블록 추가' : '선택 블록 적용'}
            </button>
            <button type="button" className="ghost" onClick={generate} disabled={generating}>다시 생성</button>
            <button type="button" className="ghost" onClick={() => setDraft(null)}>닫기</button>
          </div>
        </section>
      )}

      {!!draftHistory.length && (
        <section className="card ai-card ai-history-box">
          <div className="ai-history-head">
            <div>
              <strong>최근 초안</strong>
              <span>생성한 초안은 필요할 때 다시 불러옵니다.</span>
            </div>
          </div>
          <div className="ai-history-list">
            {draftHistory.map((item) => (
              <div key={item.id} className="ai-history-item">
                <button type="button" onClick={() => loadDraft(item)}>
                  <strong>{item.pageTitle || 'AI 초안'}</strong>
                  <span>{templateLabel(item.draft?.templateStyle)} · {item.blockCount || item.draft?.blocks?.length || 0}개 블록 · {formatDraftTime(item.createdAt)}</span>
                </button>
                <button type="button" className="delete" onClick={() => deleteDraft(item.id)}>삭제</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
