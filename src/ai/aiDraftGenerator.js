import { buildAiDraftPrompt } from './aiDraftPrompt.js';
import { normalizeAiDraftInput, validateAiDraftJson } from './aiDraftSchema.js';
import { isServerAiMode } from '../config/runtimeConfig.js';
import { postJson } from '../lib/apiClient.js';

const AI_REQUEST_TIMEOUT_MS = 45000;

async function readOpenAiError(res) {
  const raw = await res.text().catch(() => '');
  if (!raw) return formatOpenAiError('', res.status);

  try {
    const json = JSON.parse(raw);
    return formatOpenAiError(json?.error?.message || raw, res.status);
  } catch {
    return formatOpenAiError(raw, res.status);
  }
}

function formatOpenAiError(message = '', status = 0) {
  const text = String(message || '').trim();
  const requestId = text.match(/request id\s+([A-Za-z0-9_-]+)/i)?.[1];
  const suffix = requestId ? ` 요청 ID: ${requestId}` : '';

  if (/processing your request|help\.openai\.com/i.test(text)) {
    return `OpenAI 서버가 요청 처리에 실패했습니다. 잠시 후 다시 시도하거나 모델을 바꿔보세요.${suffix}`;
  }

  if (status === 401 || /incorrect api key|invalid api key|authentication/i.test(text)) {
    return 'OpenAI API 키 인증에 실패했습니다. 저장된 키가 올바른지 확인해주세요.';
  }

  if (status === 429 || /rate limit|quota|billing/i.test(text)) {
    return 'OpenAI 사용량 한도 또는 결제 설정 문제로 요청이 막혔습니다. OpenAI 계정의 결제/한도를 확인해주세요.';
  }

  if (status >= 500) {
    return `OpenAI 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.${suffix}`;
  }

  return text || `요청 실패: ${status}`;
}

function extractJson(text = '') {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('AI 응답이 비어 있습니다.');

  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last < first) throw new Error('JSON을 찾지 못했습니다.');

  try {
    return JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    throw new Error('JSON 형식이 올바르지 않습니다. 다시 생성해주세요.');
  }
}

function normalizeAiDraftResponse(json) {
  if (!json || !Array.isArray(json.blocks)) return json;

  return {
    ...json,
    blocks: json.blocks.map((block) => {
      if (block?.type === 'benefit') {
        return {
          ...block,
          type: 'text',
          title: block.title || '혜택',
          body: block.body || block.desc || '',
        };
      }

      return block;
    }),
  };
}

function fallbackTemplateStyle(input = {}) {
  const styles = ['trust', 'promo', 'booking', 'story', 'compare'];
  if (styles.includes(input.templateStyle)) return input.templateStyle;
  const seed = String(input.creativeSeed || input.industry || 'seed');
  const sum = [...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return styles[sum % styles.length];
}

function finalizeAiDraftResponse(json, input) {
  const normalized = normalizeAiDraftResponse(json);
  if (!normalized || typeof normalized !== 'object') return normalized;
  return {
    ...normalized,
    templateStyle: ['trust', 'promo', 'booking', 'story', 'compare'].includes(normalized.templateStyle)
      ? normalized.templateStyle
      : fallbackTemplateStyle(input),
  };
}

function getResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;

  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
      if (typeof content?.output_text === 'string') parts.push(content.output_text);
    }
  }
  return parts.join('');
}

function createCreativeSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function requestOpenAiText({ apiKey, model, input, temperature = 0.78, max_output_tokens = 3200 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input,
        temperature,
        max_output_tokens,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`OpenAI 요청 시간이 초과되었습니다. ${Math.round(AI_REQUEST_TIMEOUT_MS / 1000)}초 안에 응답하지 않았습니다.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errorText = await readOpenAiError(res);
    throw new Error(errorText || `AI 요청 실패: ${res.status}`);
  }

  return getResponseText(await res.json());
}

function draftTextBlob(draft = {}) {
  return JSON.stringify({
    pageTitle: draft.pageTitle,
    brandName: draft.brandName,
    qualityNote: draft.qualityNote,
    primaryAction: draft.primaryAction,
    blocks: draft.blocks,
  });
}

function keywordTokens(input = {}) {
  return [input.prompt, input.industry, input.serviceName, input.benefit, input.targetCustomer, input.keyMessage]
    .join(' ')
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12);
}

function draftQualityIssues(draft = {}, input = {}) {
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  const text = draftTextBlob(draft);
  const compact = text.replace(/\s+/g, '');
  const issues = [];
  const genericPhrases = ['제목과내용만', '쉽고예쁘게', '고객맞춤', '빠른문의', '문의해주세요', '정보를남겨주시면', '확인후연락', '맞춤형서비스', '최상의서비스', '전문적인상담'];
  const genericHits = genericPhrases.filter((phrase) => compact.includes(phrase));
  const tokens = keywordTokens(input);
  const tokenHits = tokens.filter((token) => text.includes(token)).length;
  const hero = blocks.find((block) => block.type === 'hero');
  const heroText = `${hero?.title || ''} ${hero?.body || ''}`;
  const titleLikeBlocks = blocks.filter((block) => ['hero', 'text', 'form', 'reservation', 'faq', 'links'].includes(block.type));
  const textBodies = blocks
    .filter((block) => block.type === 'text')
    .map((block) => String(block.body || '').replace(/\s+/g, ''))
    .filter(Boolean);
  const form = blocks.find((block) => block.type === 'form');
  const reservation = blocks.find((block) => block.type === 'reservation');
  const links = blocks.filter((block) => block.type === 'links');
  const questions = Array.isArray(form?.questions) ? form.questions : [];
  const reservationFields = Array.isArray(reservation?.customFields) ? reservation.customFields : [];
  const meaningfulQuestions = questions.filter((question) => !['name', 'phone', 'email'].includes(question?.type));
  const meaningfulReservationFields = reservationFields.filter((field) => String(field?.label || '').trim());
  const weakQuestionLabels = meaningfulQuestions.filter((question) => /문의|내용|기타|요청/i.test(String(question.label || ''))).length;
  const requestedSections = Array.isArray(input.sections) ? input.sections : [];
  const ctaLabels = [
    draft.primaryAction?.label,
    ...blocks.flatMap((block) => [
      block.submit,
      block.ctaLabel,
      ...(Array.isArray(block.items) ? block.items.map((item) => item.label) : []),
    ]),
  ].filter(Boolean);
  const uniqueCtas = new Set(ctaLabels.map((label) => String(label).replace(/\s+/g, ''))).size;

  if (blocks.length < 5) issues.push('AI 초안 블록 구성이 너무 단순합니다.');
  if (titleLikeBlocks.some((block) => String(block.title || block.label || '').trim().length > 42)) issues.push('모바일 편집에 비해 블록 제목이 너무 깁니다.');
  if (reservation && meaningfulReservationFields.length < 1) issues.push('예약 블록에 업종별 확인 항목이 없습니다.');
  if (links.some((block) => !Array.isArray(block.items) || block.items.length < 1)) issues.push('문의 링크 블록에 버튼이 없습니다.');
  if (text.length < 420) issues.push('전체 카피 정보량이 부족합니다.');
  if (genericHits.length) issues.push(`복붙형 일반 문구가 남아 있습니다: ${genericHits.slice(0, 3).join(', ')}`);
  if (tokens.length >= 2 && tokenHits < Math.min(2, tokens.length)) issues.push('사용자 입력 키워드가 충분히 반영되지 않았습니다.');
  if (tokens.length >= 2 && tokens.filter((token) => heroText.includes(token)).length < 1) issues.push('히어로에 사용자의 핵심 키워드가 보이지 않습니다.');
  if (textBodies.length >= 2 && new Set(textBodies).size < textBodies.length) issues.push('텍스트 블록 내용이 반복됩니다.');
  if (form && questions.length < 3) issues.push('상담폼 질문이 너무 얕습니다.');
  if (form && meaningfulQuestions.length < 2 && !requestedSections.includes('reservation')) issues.push('폼에 업종 판단 질문이 부족합니다.');
  if (form && meaningfulQuestions.length && weakQuestionLabels >= meaningfulQuestions.length) issues.push('폼 질문 라벨이 너무 일반적입니다.');
  if (requestedSections.includes('reservation') && !blocks.some((block) => block.type === 'reservation')) issues.push('방문예약 목적에 예약 블록이 없습니다.');
  if (requestedSections.includes('timer') && !blocks.some((block) => block.type === 'timer')) issues.push('이벤트/마감 목적에 타이머 블록이 없습니다.');
  if (ctaLabels.length >= 2 && uniqueCtas < 2) issues.push('CTA/버튼 문구가 행동별로 구분되지 않습니다.');

  return issues.slice(0, 5);
}

function buildQualityRepairPrompt(basePrompt, draft, issues, input) {
  return `
아래 초안은 품질 검사에서 탈락했다. 같은 JSON 스키마를 유지하되 더 깊고 구체적인 전환형 랜딩페이지 초안으로 전면 재작성하라.

[탈락 사유]
${issues.map((issue) => `- ${issue}`).join('\n')}

[보강 지시]
- 업종/서비스/타깃/혜택 키워드를 카피에 자연스럽게 더 넣는다.
- 각 text 블록은 서로 다른 역할을 맡긴다: 문제 공감, 선택 기준, 진행 흐름, 안심 근거 중 하나.
- body는 최소 35자 이상, 모바일에서 읽히는 1~2문장으로 쓴다.
- 폼 질문은 이름/연락처 외에 업종별 판단에 필요한 항목을 1~3개 추가한다.
- 질문 라벨은 "문의내용" 같은 일반어보다 희망 일정, 현재 상황, 관심 항목, 예산/규모처럼 판단 가능한 항목으로 쓴다.
- 버튼 문구는 상담/예약/전화/확인 등 행동이 구분되게 쓴다.
- 요청 섹션에 reservation/timer가 있으면 해당 블록을 우선 포함한다.
- 일반 템플릿 문구를 제거하고 실제 ${input.industry || '서비스'} 랜딩처럼 보이게 만든다.

[원래 요청]
${basePrompt}

[탈락 초안]
${JSON.stringify(draft)}
`.trim();
}

async function repairDraftIfWeak({ apiKey, model, basePrompt, draft, input }) {
  const issues = draftQualityIssues(draft, input);
  if (!issues.length) return { ...draft, qualityWarnings: [] };

  try {
    const repairText = await requestOpenAiText({
      apiKey,
      model,
      input: buildQualityRepairPrompt(basePrompt, draft, issues, input),
      temperature: 0.72,
      max_output_tokens: 3600,
    });
    const repaired = finalizeAiDraftResponse(extractJson(repairText), input);
    const check = validateAiDraftJson(repaired);
    if (!check.ok) return { ...draft, qualityWarnings: issues };
    const repairedIssues = draftQualityIssues(repaired, input);
    return repairedIssues.length <= Math.max(0, issues.length - 1)
      ? { ...repaired, qualityWarnings: repairedIssues }
      : { ...draft, qualityWarnings: issues };
  } catch (err) {
    console.warn('AI draft quality repair failed:', err);
    return { ...draft, qualityWarnings: issues };
  }
}

export async function generateAiDraft({ apiKey, model = 'gpt-4.1', input }) {
  const normalizedInput = normalizeAiDraftInput({
    ...input,
    creativeSeed: createCreativeSeed(),
  });

  if (isServerAiMode()) {
    const data = await postJson('/api/ai/draft', { model, input: normalizedInput });
    const json = finalizeAiDraftResponse(data?.draft || data, normalizedInput);
    const check = validateAiDraftJson(json);
    if (!check.ok) throw new Error(check.message);
    return { ...json, qualityWarnings: draftQualityIssues(json, normalizedInput) };
  }

  const prompt = buildAiDraftPrompt(normalizedInput);
  const text = await requestOpenAiText({ apiKey, model, input: prompt });
  const json = finalizeAiDraftResponse(extractJson(text), normalizedInput);
  const check = validateAiDraftJson(json);
  if (!check.ok) throw new Error(check.message);

  return repairDraftIfWeak({ apiKey, model, basePrompt: prompt, draft: json, input: normalizedInput });
}

export async function testOpenAiKey({ apiKey, model = 'gpt-4.1' }) {
  if (isServerAiMode()) {
    await postJson('/api/ai/test', { model });
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: '정상 연결 확인용입니다. OK만 출력하세요.',
        max_output_tokens: 16,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('OpenAI 연결 테스트 시간이 초과되었습니다.');
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errorText = await readOpenAiError(res);
    throw new Error(errorText || `연결 실패: ${res.status}`);
  }

  return true;
}
