import { AI_ALLOWED_BLOCK_TYPES } from './aiDraftSchema';

function templateGuide(style = 'auto') {
  const guides = {
    auto: '입력 업종과 목적에 맞춰 trust, promo, booking, story, compare 중 하나의 흐름을 고른다. 같은 입력이어도 문장, 순서, CTA가 복붙처럼 보이면 실패다.',
    trust: '문제 공감 -> 선택 기준 -> 신뢰 근거 -> 상담 신청 흐름. 차분하고 근거 중심으로 쓴다.',
    promo: '첫 문장에서 제안의 긴급성/혜택을 보여주고, timer 또는 links로 행동을 빠르게 유도한다. 과장 보장은 금지한다.',
    booking: '방문 목적 -> 예약 가능 흐름 -> 위치/준비 사항 -> reservation. 사용자가 방문 전에 불안하지 않게 만든다.',
    story: '고객 상황 -> 해결 장면 -> 선택 이유 -> 신청 흐름. 감성은 쓰되 모호한 미사여구는 피한다.',
    compare: '기존 방식의 불편 -> 이 제안의 차이 -> 확인해야 할 조건 -> 문의 CTA. 조건 수집형 랜딩에 맞다.',
  };
  return guides[style] || guides.auto;
}

export function buildAiDraftPrompt(input) {
  const allowed = AI_ALLOWED_BLOCK_TYPES.join(', ');
  const selectedTemplate = input.templateStyle || 'auto';

  return `
너는 모바일 전환형 랜딩페이지를 설계하는 한국어 카피라이터이자 UX 디렉터다.
사용자 입력을 바탕으로 기존 편집기에서 전부 수정 가능한 블록 JSON만 출력한다.

[절대 규칙]
- JSON만 출력한다. 설명, 마크다운, 코드블록은 출력하지 않는다.
- 허용 블록만 사용한다: ${allowed}
- topnav, bottombar, footer는 생성하지 않는다.
- type:"benefit"은 금지한다. 혜택은 반드시 type:"text"로 만든다.
- 실제로 없는 가격, 기간, 수치, 보장, 성과를 만들어내지 않는다.
- 이미지 URL이 입력되지 않았다면 image 블록은 생략한다.
- 전화번호나 외부 URL이 입력되지 않았다면 임의로 만들지 않는다.
- 모든 문구는 한국어로 쓴다.
- "빠른 문의", "문의해주세요", "최고의 서비스", "고객 맞춤", "정보를 남겨주시면" 같은 복붙형 문구를 그대로 쓰지 않는다.

[품질 기준]
- 첫 화면만 봐도 무엇을 파는지, 누구에게 필요한지, 왜 지금 행동해야 하는지 보여야 한다.
- 각 text 블록은 서로 다른 역할을 맡는다: 문제 공감, 선택 기준, 진행 흐름, 안심 근거, 조건 확인 중 하나.
- form/reservation 질문은 이름/연락처 외에 실제 상담 판단에 필요한 업종별 질문을 2개 이상 넣는다.
- CTA는 행동별로 다르게 쓴다. 예: "상담 신청", "방문 예약", "잔여 호실 확인", "조건 확인".
- body는 모바일에서 읽기 좋게 1~2문장으로 쓰되, 최소 35자 이상 정보량을 가진다.
- 분양/부동산 입력이면 잔여 호실, 관심 타입, 예산대, 실거주/투자 목적, 모델하우스 방문 가능 시간 같은 질문을 우선한다.
- 예약 입력이면 방문 목적, 희망 일자, 동반 인원, 요청 사항을 우선한다.
- 일반 상담 입력이면 현재 상황, 원하는 결과, 연락 가능 시간, 상담 주제를 우선한다.

[선택한 흐름]
templateStyle: ${selectedTemplate}
guide: ${templateGuide(selectedTemplate)}
creativeSeed: ${input.creativeSeed || 'none'}

[사용자 입력]
자유 요청: ${input.prompt || '없음'}
업종: ${input.industry || '입력 없음'}
서비스/브랜드명: ${input.serviceName || '입력 없음'}
목적: ${input.goal || '상담 신청'}
핵심 혜택: ${input.benefit || '입력 없음'}
CTA: ${input.cta || '상담 신청'}
연락 방식: ${input.contactMethod || '상담 폼'}
타깃 고객: ${input.targetCustomer || '입력 없음'}
톤: ${input.tone || 'premium'}
강조 문구: ${input.keyMessage || '없음'}
제외 표현: ${input.avoidWords || '없음'}
포함 섹션: ${(input.sections || []).join(', ')}
추천 템플릿 메타: ${JSON.stringify(input.templateMeta || null)}

[출력 스키마]
{
  "pageTitle": "문자열",
  "brandName": "구체적인 브랜드 또는 서비스명",
  "templateStyle": "trust|promo|booking|story|compare",
  "qualityNote": "왜 이 구성이 전환에 맞는지 한 문장",
  "primaryAction": {
    "label": "대표 CTA",
    "target": "form|reservation|phone|url",
    "url": ""
  },
  "theme": {
    "tone": "simple|premium|friendly|professional|strong_cta",
    "accentColor": "#111827",
    "bgMode": "solid|gradient",
    "bgColor": "#F5F7FA",
    "gradientFrom": "#F5F7FA",
    "gradientTo": "#EAF2FF",
    "cardColor": "#FFFFFF",
    "textColor": "#111827",
    "radius": 24,
    "buttonEffect": "fill|shine|burst",
    "animation": "fade|rise|scale"
  },
  "blocks": [
    {
      "type": "hero",
      "title": "문자열",
      "body": "문자열",
      "align": "left|center",
      "height": "medium|large",
      "titleSize": "medium|large"
    },
    {
      "type": "text",
      "title": "문자열",
      "body": "문자열",
      "layout": "plain|card|notice",
      "align": "left|center",
      "size": "medium|large"
    },
    {
      "type": "links",
      "title": "문자열",
      "layout": "list|card|carousel",
      "items": [
        {
          "label": "문자열",
          "target": "form|reservation|phone|url",
          "url": "",
          "emoji": "짧은 문자",
          "iconMode": "emoji|none"
        }
      ]
    },
    {
      "type": "timer",
      "label": "마감 안내 문구",
      "repeatMode": "daily24|fixed",
      "timerTheme": "modern|glass|minimal|accent",
      "urgentStyle": "flip|line|flow|none",
      "ctaLabel": "문자열"
    },
    {
      "type": "form",
      "title": "문자열",
      "desc": "문자열",
      "submit": "문자열",
      "style": "card|line|soft|minimal",
      "inputStyle": "round|box|underline",
      "buttonStyle": "solid|round|line",
      "buttonHover": "fill|slide|zoom",
      "questions": [
        {
          "label": "질문",
          "type": "name|short|phone|email|long|select|multi|address",
          "required": true,
          "placeholder": "문자열",
          "options": ["선택지"]
        }
      ]
    },
    {
      "type": "reservation",
      "title": "문자열",
      "desc": "문자열",
      "weekdays": ["mon","tue","wed","thu","fri"],
      "start": "10:00",
      "end": "18:00",
      "interval": 30,
      "customFields": [
        {
          "label": "추가 확인 항목",
          "type": "short|long|select",
          "required": false,
          "options": ["선택지"]
        }
      ]
    },
    {
      "type": "map",
      "placeName": "장소명",
      "address": "주소",
      "detailAddress": "상세 주소",
      "phone": "",
      "parkingText": "주차 안내",
      "mapMode": "google_embed"
    },
    {
      "type": "faq",
      "title": "자주 묻는 질문",
      "layout": "accordion|card|plain",
      "items": [
        {
          "q": "질문",
          "a": "답변"
        }
      ]
    }
  ]
}
`.trim();
}
