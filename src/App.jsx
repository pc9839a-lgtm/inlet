import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  Smartphone,
  Upload,
} from 'lucide-react';
import { Component } from 'react';
import PanelHeader from './builder/PanelHeader.jsx';
import { ConfirmModal, PageConflictModal, PreviewCopyModal, ToastNotice } from './builder/BuilderFeedback.jsx';
import { isLeadConflictError, leadConflictMessage } from './builder/conflictUtils.js';
import { NAV } from './builder/navigation.js';
import { useBuilderFeedback } from './builder/useBuilderFeedback.js';
import { usePageConflict } from './builder/usePageConflict.js';
import { BRAND_KO, BRAND_NAME } from './config/brand.js';
import { META, SINGLETON_BLOCK_TYPES } from './config/blockMeta.jsx';
import { AUTH_KEY, DASHBOARD_KEY, EVENTS_KEY, LEADS_KEY, START_MODE_KEY, STORAGE_KEY } from './config/storageKeys.js';
import BlockEditor from './editor/BlockEditor.jsx';
import { Color, Range } from './editor/compactControls.jsx';
import { alignOptions, formQuestionOptions, questionOptions, sizeOptions } from './editor/editorOptions.js';
import EditPanel from './editor/EditPanel.jsx';
import TargetControl from './editor/TargetControl.jsx';
import RichField from './editor/RichField.jsx';
import { normalizeButtons } from './lib/blockButtons.js';
import { canUseAdminSurface, canUseBuilderSurface, canWriteTab, isClientAdminMode, tabsForAccessMode, accessModeFor } from './lib/authContext.js';
import { logoutAuthAccount, refreshAuthSession, updateAuthAccount } from './lib/authAccounts.js';
import { normalizeAuthUser } from './lib/authIdentity.js';
import { generateStandaloneFormHtml } from './lib/formEmbed.js';
import { fetchAllServerEvents, persistEvent } from './lib/eventRepository.js';
import { sendLeadIntegrations } from './lib/leadIntegrations.js';
import { deleteServerLead, deliverServerLead, downloadServerLeadsCsv, fetchAllServerLeads, fetchServerLeads, persistLead, retryFailedServerLeads, updateServerLead } from './lib/leadRepository.js';
import { isOwnerAdminModeEnabled, isServerLeadMode } from './config/runtimeConfig.js';
import { downloadLeadsCsv } from './lib/leadCsv.js';
import { clampDateRangeToMonth, currentMonthValue, monthDateRange } from './lib/monthRange.js';
import { fetchServerPage, persistPage } from './lib/pageRepository.js';
import { canUsePageDuplication, createDuplicatedPage } from './lib/pageDuplication.js';
import { projectContext } from './lib/projectContext.js';
import { fetchLinkPreview, linkThumbnailFromUrl, normalizeExternalUrl } from './lib/linkPreview.js';
import { isReservationLead, normalizeLeadItem } from './lib/leadModel.js';
import { getPeriodRange } from './lib/statsMetrics.js';
import { clone, defaultPage, ensureUniqueAnchors, newBlock, normalize, normalizeIntegrations, normalizePageForSave, sanitizeBlock, uid } from './lib/pageModel.js';
import { load, save as saveJson, storageErrorMessage } from './lib/storage.js';
import { normalizeAiDraftInput } from './ai/aiDraftSchema.js';

const PreviewRenderer = lazy(() => import('./preview/LandingRenderer.jsx'));
const ActivityEditor = lazy(() => import('./editor/blockEditors/BasicBlockEditors.jsx').then((module) => ({ default: module.ActivityEditor })));
const DividerEditor = lazy(() => import('./editor/blockEditors/BasicBlockEditors.jsx').then((module) => ({ default: module.DividerEditor })));
const FooterEditor = lazy(() => import('./editor/blockEditors/BasicBlockEditors.jsx').then((module) => ({ default: module.FooterEditor })));
const SpacerEditor = lazy(() => import('./editor/blockEditors/BasicBlockEditors.jsx').then((module) => ({ default: module.SpacerEditor })));
const FaqEditor = lazy(() => import('./editor/blockEditors/InfoEditors.jsx').then((module) => ({ default: module.FaqEditor })));
const MapEditor = lazy(() => import('./editor/blockEditors/InfoEditors.jsx').then((module) => ({ default: module.MapEditor })));
const ScheduleEditor = lazy(() => import('./editor/blockEditors/InfoEditors.jsx').then((module) => ({ default: module.ScheduleEditor })));
const CodeEditor = lazy(() => import('./editor/blockEditors/UtilityEditors.jsx').then((module) => ({ default: module.CodeEditor })));
const SearchEditor = lazy(() => import('./editor/blockEditors/UtilityEditors.jsx').then((module) => ({ default: module.SearchEditor })));
const HeroEditor = lazy(() => import('./editor/blockEditors/HeroEditor.jsx'));
const ImageEditor = lazy(() => import('./editor/blockEditors/ImageEditor.jsx'));
const LinksEditor = lazy(() => import('./editor/blockEditors/LinksEditor.jsx'));
const FormEditor = lazy(() => import('./editor/blockEditors/FormEditor.jsx'));
const ReservationEditor = lazy(() => import('./editor/blockEditors/ReservationEditor.jsx'));
const BottomBarEditor = lazy(() => import('./editor/blockEditors/BottomBarEditor.jsx'));
const TextEditor = lazy(() => import('./editor/blockEditors/TextEditor.jsx'));
const CardsEditor = lazy(() => import('./editor/blockEditors/CardsEditor.jsx'));
const TimerEditor = lazy(() => import('./editor/blockEditors/TimerEditor.jsx'));
const TopNavEditor = lazy(() => import('./editor/blockEditors/TopNavEditor.jsx'));

const BLOCK_EDITORS = {
  topnav: TopNavEditor,
  hero: HeroEditor,
  image: ImageEditor,
  text: TextEditor,
  cards: CardsEditor,
  map: MapEditor,
  faq: FaqEditor,
  links: LinksEditor,
  schedule: ScheduleEditor,
  timer: TimerEditor,
  activity: ActivityEditor,
  spacer: SpacerEditor,
  divider: DividerEditor,
  code: CodeEditor,
  search: SearchEditor,
  form: FormEditor,
  reservation: ReservationEditor,
  bottombar: BottomBarEditor,
  footer: FooterEditor,
};

const TAB_KEYS = new Set(NAV.map(([key]) => key));

function tabFromLocation(fallback = 'edit') {
  if (typeof location === 'undefined') return fallback;
  const requested = new URLSearchParams(location.search).get('tab') || '';
  return TAB_KEYS.has(requested) ? requested : fallback;
}

function hasTabDeepLink() {
  if (typeof location === 'undefined') return false;
  return TAB_KEYS.has(new URLSearchParams(location.search).get('tab') || '');
}

function replaceLocationTab(nextTab) {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  if (!TAB_KEYS.has(nextTab)) return;
  const url = new URL(location.href);
  url.searchParams.set('tab', nextTab);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

const InboxPanel = lazy(() => import('./panels/InboxPanel.jsx'));
const StatsPanel = lazy(() => import('./panels/StatsPanel.jsx'));
const StylePanel = lazy(() => import('./panels/StylePanel.jsx'));
const SettingsPanel = lazy(() => import('./panels/SettingsPanel.jsx'));
const AdminPanel = lazy(() => import('./panels/AdminPanel.jsx'));
const TemplatesPanel = lazy(() => import('./panels/TemplatesPanel'));
const InviteAcceptScreen = lazy(() => import('./screens/InviteAcceptScreen.jsx'));
const AuthScreen = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.AuthScreen })));
const CreateLandingModal = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.CreateLandingModal })));
const Dashboard = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.Dashboard })));
const PublicHome = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.PublicHome })));
const StartModeOverlay = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.StartModeOverlay })));
const INBOX_PAGE_SIZE = 50;

function dateInputValue(date) {
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function LazyPanelFallback() {
  return <section className="card"><div className="section-title"><h2>패널을 불러오는 중입니다.</h2></div></section>;
}

const WAYZI_STATIC_PAGES = {
  '/about': {
    eyebrow: '사이트 소개',
    title: 'WAYZI 소개',
    updatedAt: '2026.05.26',
    links: [
      ['홈으로', '/'],
      ['개인정보처리방침', '/privacy'],
      ['이용약관', '/terms'],
      ['문의하기', '/contact'],
    ],
    intro: [
      'WAYZI는 랜딩페이지 제작, 문의 접수, 전환 통계, 관리자 운영을 한 곳에서 처리할 수 있도록 만든 웹 기반 제작·운영 서비스입니다.',
    ],
    sections: [
      {
        title: '무엇을 제공하나요?',
        items: [
          '랜딩페이지 제작 및 수정',
          '문의 폼, 예약 폼, 상담 신청 폼 구성',
          '접수함, 리드 관리, CSV 내보내기',
          '페이지 방문, CTA 클릭, 전환 통계 확인',
          '관리자, 클라이언트, 매니저 권한 관리',
        ],
      },
      {
        title: '서비스 운영 방향',
        body: ['WAYZI는 단순히 화면을 만드는 도구가 아니라, 광고 유입 이후 문의 접수와 운영 관리까지 이어지는 흐름을 빠르게 만들 수 있도록 설계되었습니다. 사용자는 페이지 문구, 이미지, 폼 항목, 연결 설정을 직접 수정할 수 있고 운영자는 접수 데이터와 통계를 확인할 수 있습니다.'],
      },
      {
        title: '안내',
        body: ['서비스 내 일부 기능은 외부 이메일, 웹훅, 광고 추적 도구, 결제 또는 인증 서비스와 연결될 수 있습니다. 실제 제공 범위와 설정 가능 항목은 이용 중인 요금제, 운영 환경, 외부 서비스 정책에 따라 달라질 수 있습니다.'],
      },
      {
        title: '문의',
        body: ['서비스 이용, 제작 의뢰, 운영 문의는 문의하기 페이지 또는 서비스 내 문의 채널을 통해 접수할 수 있습니다.'],
      },
    ],
  },
  '/contact': {
    eyebrow: '문의 안내',
    title: '문의하기',
    updatedAt: '2026.05.26',
    links: [
      ['홈으로', '/'],
      ['사이트 소개', '/about'],
      ['개인정보처리방침', '/privacy'],
      ['이용약관', '/terms'],
    ],
    intro: [
      'WAYZI 서비스 이용, 랜딩페이지 제작, 접수함·통계·권한 관리 설정과 관련해 궁금한 점이 있다면 아래 안내를 참고해 문의해주세요.',
    ],
    sections: [
      {
        title: '서비스 문의',
        body: ['서비스 도입, 제작 의뢰, 기능 설정, 운영 지원이 필요한 경우 관리자에게 문의할 수 있습니다.'],
      },
      {
        title: '접수 경로',
        body: ['공개 페이지의 문의 폼 또는 별도 안내받은 연락 채널을 통해 문의를 남길 수 있습니다. 접수된 문의는 운영자가 확인한 뒤 순차적으로 응대합니다.'],
      },
      {
        title: '안내',
        body: ['기능 제공 범위, 결제 조건, 외부 연동 가능 여부는 이용 환경과 계약 조건에 따라 달라질 수 있으므로 실제 적용 전 최종 확인이 필요합니다.'],
      },
    ],
  },
  '/privacy': {
    eyebrow: '정책 안내',
    title: '개인정보처리방침',
    updatedAt: '2026.05.26',
    links: [
      ['홈으로', '/'],
      ['사이트 소개', '/about'],
      ['이용약관', '/terms'],
      ['문의하기', '/contact'],
    ],
    intro: [
      'WAYZI는 서비스 제공, 문의 접수, 계정 관리, 운영 지원을 위해 필요한 범위의 개인정보를 수집·이용합니다. 본 페이지는 이용자에게 개인정보 수집, 이용, 보관, 파기 기준을 안내하기 위해 작성되었습니다.',
    ],
    sections: [
      {
        title: '1. 수집하는 개인정보 항목',
        items: ['이름 또는 담당자명', '이메일 주소', '휴대폰 번호 또는 연락처', '문의 내용 및 접수 폼 답변', '계정, 권한, 페이지 설정 정보', '접속 환경 정보(기기, 브라우저, 유입 경로, 페이지 URL 등)'],
      },
      {
        title: '2. 개인정보 수집 목적',
        items: ['회원가입, 로그인, 본인 확인 및 계정 관리', '문의 접수 확인 및 상담 응대', '랜딩페이지 운영, 리드 관리, 통계 제공', '결제, 계약, 서비스 이용 상태 확인', '중복 가입, 비정상 이용, 보안 사고 방지'],
      },
      {
        title: '3. 보유 및 이용 기간',
        body: ['수집된 개인정보는 서비스 제공 및 문의 응대 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다. 다만, 계약 이행, 분쟁 대응, 부정 이용 방지 또는 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관할 수 있습니다.'],
      },
      {
        title: '4. 제3자 제공',
        body: ['WAYZI는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자의 별도 동의가 있거나 법령에 따라 제공이 필요한 경우는 예외로 합니다.'],
      },
      {
        title: '5. 개인정보 처리 위탁',
        body: ['원활한 서비스 제공을 위해 일부 업무를 외부 서비스에 위탁할 수 있습니다. 예: 호스팅, 데이터 저장, 이메일 발송, 결제 처리, 분석 도구, 고객 응대 도구.'],
      },
      {
        title: '6. 이용자의 권리',
        body: ['이용자는 언제든지 본인의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 요청은 아래 문의처를 통해 접수할 수 있습니다.'],
      },
      {
        title: '7. 문의처',
        body: ['개인정보 열람, 정정, 삭제, 처리정지 요청은 서비스 내 문의 채널 또는 관리자에게 접수할 수 있습니다.'],
      },
    ],
  },
  '/terms': {
    eyebrow: '정책 안내',
    title: '이용약관',
    updatedAt: '2026.05.26',
    links: [
      ['홈으로', '/'],
      ['사이트 소개', '/about'],
      ['개인정보처리방침', '/privacy'],
      ['문의하기', '/contact'],
    ],
    intro: [
      '본 약관은 WAYZI 서비스 이용과 관련하여 서비스 제공자와 이용자 간의 기본적인 권리와 의무를 정리한 문서입니다.',
    ],
    sections: [
      {
        title: '1. 서비스 목적',
        body: ['WAYZI는 랜딩페이지 제작, 폼 접수, 리드 관리, 통계 확인, 권한 관리, 외부 연동 설정 등 온라인 마케팅 운영에 필요한 기능 제공을 목적으로 운영됩니다.'],
      },
      {
        title: '2. 제공 정보의 성격',
        body: ['서비스 화면, 템플릿, 통계, 예시 문구, 자동 생성 결과는 이용자의 제작과 운영을 돕기 위한 참고 자료입니다. 실제 광고 집행, 고객 응대, 계약, 결제, 법적 고지는 이용자가 최종 확인하고 책임져야 합니다.'],
      },
      {
        title: '3. 이용자의 책임',
        items: ['허위 정보 입력 금지', '타인의 개인정보 또는 계정 도용 금지', '권한 없는 페이지 접근 또는 데이터 열람 금지', '서비스 운영을 방해하는 행위 금지', '불법·허위·과장 광고 목적의 사용 금지'],
      },
      {
        title: '4. 저작권',
        body: ['서비스 내 UI, 코드, 템플릿, 디자인 구성 등 자체 제작 콘텐츠의 저작권은 WAYZI 또는 정당한 권리자에게 있습니다. 이용자가 업로드한 문구, 이미지, 고객 데이터의 권리와 책임은 해당 이용자에게 있습니다.'],
      },
      {
        title: '5. 외부 링크 및 제휴 안내',
        body: ['서비스에는 이메일, 웹훅, 광고 추적 도구, 결제, 인증, 외부 링크 등 제3자 서비스 연결 기능이 포함될 수 있습니다. 외부 서비스 이용 시 해당 서비스의 약관과 정책이 별도로 적용됩니다.'],
      },
      {
        title: '6. 면책 조항',
        body: ['WAYZI는 안정적인 서비스 제공을 위해 노력하지만, 외부 서비스 장애, 네트워크 문제, 이용자 설정 오류, 브라우저 또는 기기 환경에 따라 일부 기능 이용이 제한될 수 있습니다. 이용자는 공개 전 페이지 내용, 폼 항목, 개인정보 고지, 광고 추적 설정을 직접 확인해야 합니다.'],
      },
      {
        title: '7. 문의처',
        body: ['서비스 이용 및 약관 관련 문의는 서비스 내 문의 채널 또는 관리자에게 접수할 수 있습니다.'],
      },
    ],
  },
};

const WAYZI_FOOTER_MENU = [
  ['사이트소개', '/about'],
  ['문의안내', '/contact'],
  ['개인정보처리방침', '/privacy'],
  ['이용약관', '/terms'],
];

function WayziStaticPage({ page }) {
  return (
    <main className="wayzi-static-page">
      <section className="wayzi-static-card">
        <p>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <small>최종 수정일: {page.updatedAt}</small>
        <div className="wayzi-static-intro">
          {page.intro.map((line) => <span key={line}>{line}</span>)}
        </div>
        <div className="wayzi-static-sections">
          {page.sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              {section.body?.map((line) => <span key={line}>{line}</span>)}
              {!!section.items?.length && (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
        <nav className="wayzi-static-links" aria-label="정책 페이지 이동">
          {page.links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
        </nav>
      </section>
    </main>
  );
}

function WayziFooter() {
  return (
    <footer className="wayzi-global-footer" aria-label="WAYZI 서비스 정보">
      <div className="wayzi-footer-brand">
        <strong>WAYZI</strong>
        <span>대표 김도윤 · 사업자번호 538-42-01450</span>
      </div>
      <nav className="wayzi-footer-menu" aria-label="WAYZI 하단 메뉴">
        {WAYZI_FOOTER_MENU.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
      </nav>
    </footer>
  );
}

function withWayziFooter(content) {
  return (
    <>
      {content}
      <WayziFooter />
    </>
  );
}

function LazyEditorFallback() {
  return <div className="muted small">편집기를 불러오는 중입니다.</div>;
}

function renderLazyEditor(Editor, props) {
  return (
    <LazyEditorBoundary resetKey={props?.s?.anchorId || props?.s?.title || ''}>
      <Suspense fallback={<LazyEditorFallback />}>
        <Editor {...props} />
      </Suspense>
    </LazyEditorBoundary>
  );
}

class LazyEditorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.warn('Fixed block editor load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="muted small" role="alert">
          편집기를 불러오지 못했습니다. 블록을 다시 열거나 새로고침해 주세요.
        </div>
      );
    }

    return this.props.children;
  }
}

const TEMP_LEAD_IDS = ['temp-lead-20260502', 'temp-lead-20260508', 'temp-lead-20260514', 'temp-lead-20260520', 'temp-lead-20260526'];

function makeTempLead({ id, type, createdAt, name, phone, email, message, answers = [], values = {} }) {
  return normalizeLeadItem({
    id,
    type,
    name,
    phone,
    email,
    message,
    answers,
    values,
    createdAt,
    sourceBlockTitle: type === 'reservation' ? '방문 예약 신청' : '상담 신청',
    delivery: { status: 'success', summary: '임시 데이터', logs: [{ target: 'local', status: 'success', message: 'CSV 확인용 샘플', at: createdAt }] },
  });
}

function devTempLeads(existing = []) {
  if (!import.meta.env.DEV) return existing;
  const ids = new Set(existing.map((lead) => String(lead.id || '')));
  if (TEMP_LEAD_IDS.every((id) => ids.has(id))) return existing;
  const samples = [
    makeTempLead({ id: TEMP_LEAD_IDS[0], type: 'lead', createdAt: '2026-05-02T10:12:00+09:00', name: '김민준', phone: '010-2345-1001', email: 'minjun@example.com', message: '상담 가능 시간과 비용 안내 부탁드립니다.', answers: [{ label: '관심 서비스', value: '빠른 상담 DB형' }, { label: '연락 가능 시간', value: '오전 10시 이후' }], values: { 유입경로: '네이버 검색', 희망상담: '신규 제작' } }),
    makeTempLead({ id: TEMP_LEAD_IDS[1], type: 'reservation', createdAt: '2026-05-08T14:35:00+09:00', name: '이서연', phone: '010-3456-1002', email: 'seoyeon@example.com', message: '다음 주 방문 예약 가능 여부 확인해주세요.', answers: [{ label: '예약일', value: '2026-05-13' }, { label: '예약시간', value: '15:00' }], values: { 예약일: '2026-05-13', 예약시간: '15:00', 방문목적: '상담' } }),
    makeTempLead({ id: TEMP_LEAD_IDS[2], type: 'lead', createdAt: '2026-05-14T09:20:00+09:00', name: '박도현', phone: '010-4567-1003', email: 'dohyun@example.com', message: '광고용 랜딩페이지 제작 견적 문의합니다.', answers: [{ label: '희망 조건', value: '폼, 통계, 카카오 연결' }, { label: '예산 범위', value: '100만원 이하' }], values: { 문의유형: '견적 문의', 예산: '100만원 이하' } }),
    makeTempLead({ id: TEMP_LEAD_IDS[3], type: 'reservation', createdAt: '2026-05-20T18:05:00+09:00', name: '최하윤', phone: '010-5678-1004', email: 'hayoon@example.com', message: '금요일 오후 방문 상담 희망합니다.', answers: [{ label: '예약일', value: '2026-05-22' }, { label: '예약시간', value: '16:30' }], values: { 예약일: '2026-05-22', 예약시간: '16:30', 요청사항: '주차 가능 여부 확인' } }),
    makeTempLead({ id: TEMP_LEAD_IDS[4], type: 'lead', createdAt: '2026-05-26T11:48:00+09:00', name: '정우진', phone: '010-6789-1005', email: 'woojin@example.com', message: '기존 페이지를 관리자용으로 넘기는 기능 문의입니다.', answers: [{ label: '관심 기능', value: '접수함, 통계, 설정 권한' }, { label: '연락 가능 시간', value: '오늘 오후' }], values: { 문의유형: '기능 문의', 담당자: '정우진' } }),
  ];
  return [...samples.filter((lead) => !ids.has(lead.id)), ...existing];
}

function App() {
  const [page, setPage] = useState(() => normalize(load(STORAGE_KEY, defaultPage)));
  const [leads, setLeads] = useState(() => devTempLeads(load(LEADS_KEY, []).map(normalizeLeadItem)));
  const [leadsSyncing, setLeadsSyncing] = useState(false);
  const [leadPageMeta, setLeadPageMeta] = useState({ total: 0, nextCursor: null, hasMore: false });
  const [statsEventPageMeta, setStatsEventPageMeta] = useState({ total: 0, nextCursor: null, hasMore: false, source: 'local' });
  const [statsLeadPageMeta, setStatsLeadPageMeta] = useState({ total: 0, nextCursor: null, hasMore: false, source: 'local' });
  const [statsPartial, setStatsPartial] = useState(false);
  const [inboxFilters, setInboxFilters] = useState({ kind: 'all', status: 'all', q: '', month: currentMonthValue() });
  const [statsPeriod, setStatsPeriod] = useState('7d');
  const [leadConflict, setLeadConflict] = useState(null);
  const [events, setEvents] = useState(() => load(EVENTS_KEY, []));
  const [tab, setTab] = useState(() => tabFromLocation('edit'));
  const [openId, setOpenId] = useState(page.blocks[0]?.id || '');
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState({
    tone: 'idle',
    label: '저장 대기',
    detail: '편집 내용이 바뀌면 브라우저에 자동 저장됩니다.',
  });
  const [pageConflict, setPageConflict] = useState(null);
  const [previewCopyIssue, setPreviewCopyIssue] = useState(null);
  const saveErrorNoticeRef = useRef('');
  const sessionRefreshRef = useRef('');
  const templateModuleRef = useRef(null);
  const { toast, confirmDialog, setToast, setConfirmDialog, showToast, requestConfirm } = useBuilderFeedback();
  const [connectionsEditing, setConnectionsEditing] = useState(true);
  const [startMode, setStartMode] = useState(() => load(START_MODE_KEY, ''));
  const [authUser, setAuthUser] = useState(() => normalizeAuthUser(load(AUTH_KEY, null)));
  const [workspaceOpen, setWorkspaceOpen] = useState(() => load(DASHBOARD_KEY, { open: false })?.open || false);
  const [createOpen, setCreateOpen] = useState(false);
  const [authView, setAuthView] = useState('');
  const [stylePreviewTheme, setStylePreviewTheme] = useState(null);
  const [templateChoices, setTemplateChoices] = useState([]);
  const mobileBlocked = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 900, []);
  const tabDeepLink = useMemo(() => hasTabDeepLink(), []);
  const { handlePageSaveError, useLatestServerPage, keepLocalPageDraft, forceSaveLocalPage } = usePageConflict({
    authUser,
    pageConflict,
    setPageConflict,
    setPage,
    setStylePreviewTheme,
  });
  const hasPendingStyle = useMemo(
    () => !!stylePreviewTheme && JSON.stringify(stylePreviewTheme) !== JSON.stringify(page.theme || {}),
    [stylePreviewTheme, page.theme],
  );
  const ownerAdminModeEnabled = isOwnerAdminModeEnabled();
  const accessMode = useMemo(() => accessModeFor({ authUser, page, clientAdminEnabled: ownerAdminModeEnabled }), [authUser, ownerAdminModeEnabled, page]);
  const canUseBuilder = canUseBuilderSurface(accessMode, page, authUser);
  const canManageAdmin = canUseAdminSurface(accessMode);
  const clientAdminMode = isClientAdminMode(accessMode);
  const allowedTabs = useMemo(() => tabsForAccessMode(accessMode, page, authUser), [accessMode, page, authUser]);
  const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key);
  const canWriteCurrentTab = canWriteTabKey(tab);
  const mapSiteId = useMemo(() => projectContext(page, authUser).projectId, [page.slug, page.projectId, authUser]);
  const previewPage = useMemo(() => {
    const nextPage = stylePreviewTheme ? { ...page, theme: { ...page.theme, ...stylePreviewTheme } } : page;
    return { ...nextPage, mapSiteId };
  }, [page, stylePreviewTheme, mapSiteId]);
  const inviteToken = useMemo(() => {
    if (typeof location === 'undefined') return '';
    const match = location.pathname.match(/^\/invite\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, []);
  const adminRoute = useMemo(() => {
    if (typeof location === 'undefined') return false;
    return /^\/(?:admin|[^/?#]+\/admin)\/?$/.test(location.pathname);
  }, []);
  const staticPage = useMemo(() => {
    if (typeof location === 'undefined') return null;
    const pathname = location.pathname.replace(/\/+$/, '') || '/';
    return WAYZI_STATIC_PAGES[pathname] || null;
  }, []);

  const markSaveStatus = (tone, label, detail = '') => {
    setSaveStatus({ tone, label, detail, at: new Date().toISOString() });
  };

  const saveLocalJson = (key, value, label, options = {}) => {
    const result = saveJson(key, value);
    if (result?.ok) {
      if (!options.quietSuccess && (!saveErrorNoticeRef.current || saveErrorNoticeRef.current.startsWith(`${key}:`))) {
        saveErrorNoticeRef.current = '';
        markSaveStatus('ok', '로컬 저장됨', `${label} 저장 완료`);
      }
      return result;
    }

    const message = `${label} 로컬 저장 실패: ${storageErrorMessage(result?.error)}`;
    const signature = `${key}:${result?.reason || 'unknown'}:${String(result?.error?.message || result?.error || '')}`;
    markSaveStatus('error', '로컬 저장 실패', message);
    if (saveErrorNoticeRef.current !== signature) {
      saveErrorNoticeRef.current = signature;
      showToast(message, 'error');
    }
    return result;
  };

  useEffect(() => {
    saveLocalJson(STORAGE_KEY, normalizePageForSave(page), '페이지');
  }, [page]);
  useEffect(() => {
    saveLocalJson(LEADS_KEY, leads, '접수 데이터', { quietSuccess: true });
  }, [leads]);
  useEffect(() => {
    saveLocalJson(EVENTS_KEY, events, '통계 이벤트', { quietSuccess: true });
  }, [events]);
  useEffect(() => {
    if (!authUser) return;
    const normalized = normalizeAuthUser(authUser);
    saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
    if (JSON.stringify(normalized) !== JSON.stringify(authUser)) setAuthUser(normalized);
  }, [authUser]);

  useEffect(() => {
    const session = String(authUser?.session || '').trim();
    if (!session || sessionRefreshRef.current === session) return;
    sessionRefreshRef.current = session;
    let alive = true;
    refreshAuthSession({ session, projectId: page.projectId || '' })
      .then((nextUser) => {
        if (!alive || !nextUser) return;
        const normalized = normalizeAuthUser({
          ...authUser,
          ...nextUser,
          session: nextUser.session || session,
          signedAt: new Date().toISOString(),
        });
        sessionRefreshRef.current = String(normalized.session || session);
        saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
        setAuthUser(normalized);
      })
      .catch((error) => {
        if (!alive) return;
        const status = Number(error?.status || 0);
        if (status === 401 || status === 403 || status === 404) {
          localStorage.removeItem(AUTH_KEY);
          setAuthUser(null);
          setWorkspaceOpen(false);
          showToast('로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 'error');
        }
      });
    return () => { alive = false; };
  }, [authUser?.session, page.projectId]);
  useEffect(() => {
    let alive = true;
    fetchServerPage(page.slug, projectContext(page, authUser))
      .then((serverPage) => {
        if (!alive || !serverPage) return;
        setPage(normalize(serverPage));
      })
      .catch((error) => {
        console.warn('Server page load failed:', error);
      });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (tab !== 'inbox' || !isServerLeadMode()) return undefined;
    let alive = true;
    const monthRange = monthDateRange(inboxFilters.month);
    setLeadsSyncing(true);
    fetchServerLeads(page, authUser, {
      limit: INBOX_PAGE_SIZE,
      withMeta: true,
      kind: inboxFilters.kind === 'all' ? '' : inboxFilters.kind,
      status: inboxFilters.status === 'all' ? '' : inboxFilters.status,
      q: inboxFilters.q,
      month: monthRange.month,
      dateFrom: monthRange.dateFrom,
      dateTo: monthRange.dateTo,
    })
      .then((result) => {
        if (!alive || !result) return;
        const serverLeads = Array.isArray(result) ? result : result.leads;
        setLeads((serverLeads || []).map(normalizeLeadItem));
        if (Array.isArray(result)) {
          setLeadPageMeta({ total: result.length, nextCursor: null, hasMore: false });
        } else {
          setLeadPageMeta({
            total: Number(result.total || 0),
            nextCursor: result.nextCursor ?? null,
            hasMore: !!result.hasMore,
          });
        }
      })
      .catch((error) => {
        console.warn('Server leads load failed:', error);
        setLeadPageMeta({ total: 0, nextCursor: null, hasMore: false });
      })
      .finally(() => {
        if (alive) setLeadsSyncing(false);
      });
    return () => { alive = false; };
  }, [tab, page.slug, page.projectId, authUser, inboxFilters.kind, inboxFilters.month, inboxFilters.status, inboxFilters.q]);
  useEffect(() => {
    if (tab !== 'stats') return undefined;
    if (!isServerLeadMode()) {
      setStatsEventPageMeta({ total: events.length, nextCursor: null, hasMore: false, source: 'local' });
      setStatsLeadPageMeta({ total: leads.length, nextCursor: null, hasMore: false, source: 'local' });
      setStatsPartial(false);
      return undefined;
    }
    let alive = true;
    const periodRange = getPeriodRange(statsPeriod);
    const statsRange = clampDateRangeToMonth({
      dateFrom: dateInputValue(periodRange.start),
      dateTo: dateInputValue(periodRange.end),
    }, currentMonthValue(periodRange.end));
    setStatsPartial(false);
    Promise.all([
      fetchAllServerEvents(page, authUser, { limit: 1000, max: 5000, withMeta: true, ...statsRange }),
      fetchAllServerLeads(page, authUser, { limit: 1000, max: 5000, withMeta: true, ...statsRange }),
    ])
      .then(([eventResult, leadResult]) => {
        if (!alive) return;
        if (eventResult) {
          setEvents(eventResult.events || []);
          setStatsEventPageMeta({
            total: Number(eventResult.total || 0),
            nextCursor: eventResult.nextCursor ?? null,
            hasMore: !!eventResult.hasMore,
            source: eventResult.source || 'server',
          });
        }
        if (leadResult) {
          setLeads((leadResult.leads || []).map(normalizeLeadItem));
          setStatsLeadPageMeta({
            total: Number(leadResult.total || 0),
            nextCursor: leadResult.nextCursor ?? null,
            hasMore: !!leadResult.hasMore,
            source: leadResult.source || 'server',
          });
        }
        setStatsPartial(!!eventResult?.partial || !!leadResult?.partial);
      })
      .catch((error) => {
        console.warn('Server stats data load failed:', error);
        if (alive) setStatsPartial(true);
      });
    return () => { alive = false; };
  }, [tab, page.slug, page.projectId, authUser, statsPeriod]);
  useEffect(() => {
    if (tab !== 'style') setStylePreviewTheme(null);
  }, [tab]);
  useEffect(() => {
    if (!authUser || canUseBuilder || workspaceOpen) return;
    saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
    setWorkspaceOpen(true);
  }, [authUser, canUseBuilder, workspaceOpen]);
  useEffect(() => {
    if (allowedTabs.includes(tab)) return;
    clearPendingStyle();
    const nextTab = allowedTabs[0] || 'inbox';
    replaceLocationTab(nextTab);
    setTab(nextTab);
  }, [allowedTabs, tab]);
  useEffect(() => {
    if (!hasPendingStyle) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingStyle]);

  const blockWrite = (targetTab = tab) => {
    if (canWriteTabKey(targetTab)) return false;
    showToast('현재 계정에는 이 화면을 수정할 권한이 없습니다.', 'warning');
    markSaveStatus('warning', '권한 없음', '마스터가 부여한 쓰기 권한이 필요합니다.');
    return true;
  };
  const setNormalizedPage = (updater) => {
    if (blockWrite(tab)) return;
    setPage((prev) => normalizePageForSave(typeof updater === 'function' ? updater(prev) : updater));
  };
  const updatePage = (patch) => {
    if (blockWrite(tab)) return;
    setPage((p) => normalizePageForSave({ ...p, ...patch }));
  };
  const updateTheme = (patch) => {
    if (blockWrite('style')) return;
    setPage((p) => ({ ...p, theme: { ...p.theme, ...patch } }));
  };
  const updateMeta = (patch) => {
    if (blockWrite('settings')) return;
    setPage((p) => ({ ...p, meta: { ...p.meta, ...patch } }));
  };
  const updateAi = (patch) => {
    if (blockWrite('admin')) return;
    setPage((p) => ({ ...p, ai: { ...(p.ai || {}), ...patch } }));
  };
  const updateIntegrations = (section, patch) => {
    if (blockWrite(tab === 'inbox' ? 'inbox' : 'settings')) return;
    setPage((p) => ({ ...p, integrations: normalizeIntegrations({ ...(p.integrations || {}), [section]: { ...(p.integrations?.[section] || {}), ...patch } }) }));
  };
  const updateBlock = (id, patch) => {
    if (blockWrite('edit')) return;
    setPage((p) => ({
      ...p,
      blocks: ensureUniqueAnchors(p.blocks.map((b) => b.id === id ? sanitizeBlock({ ...b, s: { ...b.s, ...patch } }) : b)),
    }));
  };
  const toggleVisible = (id) => {
    if (blockWrite('edit')) return;
    setPage((p) => ({ ...p, blocks: p.blocks.map((b) => b.id === id ? { ...b, visible: !b.visible } : b) }));
  };
  const addBlock = (type) => {
    if (blockWrite('edit')) return;
    if (SINGLETON_BLOCK_TYPES.includes(type)) {
      const existing = page.blocks.find((b) => b.type === type);
      if (existing) { setOpenId(existing.id); setAddOpen(false); return; }
    }
    const b = newBlock(type);
    setPage((p) => ({ ...p, blocks: ensureUniqueAnchors([...p.blocks, b]) }));
    setOpenId(b.id);
    setAddOpen(false);
  };
  const removeBlock = (id) => {
    if (blockWrite('edit')) return;
    const idx = page.blocks.findIndex((b) => b.id === id);
    const nextOpen = openId === id
      ? (page.blocks[idx + 1]?.id || page.blocks[idx - 1]?.id || '')
      : openId;
    setPage((p) => ({ ...p, blocks: ensureUniqueAnchors(p.blocks.filter((b) => b.id !== id)) }));
    setOpenId(nextOpen);
    setAddOpen(false);
  };
  const duplicateBlock = (id) => {
    if (blockWrite('edit')) return;
    const source = page.blocks.find((b) => b.id === id);
    if (!source || SINGLETON_BLOCK_TYPES.includes(source.type)) return;
    const cp = clone(source);
    cp.id = uid();
    setPage((p) => {
      const idx = p.blocks.findIndex((b) => b.id === id);
      if (idx < 0 || SINGLETON_BLOCK_TYPES.includes(p.blocks[idx].type)) return p;
      const next = [...p.blocks];
      next.splice(idx + 1, 0, cp);
      return { ...p, blocks: ensureUniqueAnchors(next) };
    });
    setOpenId(cp.id);
    setAddOpen(false);
  };
  const duplicatePageWithUrl = (urlConfig) => {
    if (blockWrite('settings')) {
      return { ok: false, message: '설정 편집 권한이 없습니다.' };
    }
    if (!canUsePageDuplication(page)) {
      return { ok: false, locked: true, message: '페이지 복제는 유료 기능입니다. 결제 연동 후 사용할 수 있습니다.' };
    }
    const nextPage = createDuplicatedPage(page, urlConfig);
    setPage(nextPage);
    setLeads([]);
    setEvents([]);
    setOpenId(nextPage.blocks?.find((block) => block.type === 'hero')?.id || nextPage.blocks?.[0]?.id || '');
    setTab('edit');
    replaceLocationTab('edit');
    saveLocalJson(START_MODE_KEY, 'manual', '시작 방식', { quietSuccess: true });
    showToast(`페이지를 복제했습니다. 새 URL: /${nextPage.slug}`, 'success');
    return { ok: true, page: nextPage };
  };
  const reorderToIndex = (fromId, targetIndex) => {
    if (blockWrite('edit')) return;
    if (!fromId && fromId !== 0) return;
    setPage((p) => {
      const normal = p.blocks.filter((b)=>!['topnav','bottombar','footer'].includes(b.type));
      const fixed = p.blocks.filter((b)=>['topnav','bottombar','footer'].includes(b.type));
      const from = normal.findIndex((b)=>b.id === fromId);
      if (from < 0) return p;
      const nextNormal = [...normal];
      const [moved] = nextNormal.splice(from, 1);
      const requestedIndex = Number(targetIndex);
      const adjustedIndex = from < requestedIndex ? requestedIndex - 1 : requestedIndex;
      const safeIndex = Math.max(0, Math.min(adjustedIndex, nextNormal.length));
      nextNormal.splice(safeIndex, 0, moved);
      return { ...p, blocks: ensureUniqueAnchors([...nextNormal, ...fixed]) };
    });
  };
  const track = (ev) => {
    const event = {
    id: uid(),
    type: ev.type,
    label: ev.label || '',
    channel: ev.channel || detectTrafficChannel(),
    device: ev.device || detectDeviceType(),
    createdAt: new Date().toISOString(),
    };
    setEvents((list) => [event, ...list].slice(0, 1000));
    persistEvent(event, page, authUser).catch((error) => {
      console.warn('Server event save failed:', error);
    });
  };
  const syncLeadPatch = (id, patch) => {
    const current = leads.find((lead) => lead.id === id) || null;
    const expectedUpdatedAt = current?.updatedAt || current?.savedAt || current?.createdAt || '';
    updateServerLead(id, { ...patch, __expectedUpdatedAt: expectedUpdatedAt }, page, authUser).catch((error) => {
      console.warn('Server lead sync failed:', error);
      if (isLeadConflictError(error)) {
        console.warn('Server lead sync skipped because the lead changed elsewhere.');
      }
    });
  };
  const runLeadDelivery = (lead) => (
    isServerLeadMode()
      ? deliverServerLead(lead, page, authUser)
      : sendLeadIntegrations(lead, page)
  );
  const addLead = (lead) => {
    const savedLead = normalizeLeadItem({
      id: uid(),
      status: '신규',
      memo: '',
      createdAt: new Date().toISOString(),
      delivery: { status: 'pending', summary: '외부 전송 확인 중', logs: [] },
      ...lead
    });
    setLeads((l) => [savedLead, ...l]);
    setLeadPageMeta((meta) => ({ ...meta, total: Number(meta.total || 0) + 1 }));
    track({ type: isReservationLead(savedLead) ? 'reservation_submit' : 'form_submit', label: savedLead.type });

    persistLead(savedLead, page, authUser)
      .then(()=>runLeadDelivery(savedLead))
      .then((report) => {
        if (!report) return;
        setLeads((list)=>list.map((item)=>item.id === savedLead.id ? { ...item, delivery: report } : item));
        if (!isServerLeadMode()) syncLeadPatch(savedLead.id, { delivery: report });
      })
      .catch((error)=>{
        console.warn('Lead save or delivery failed:', error);
        if (isServerLeadMode()) {
          setLeads((list)=>list.filter((item)=>item.id !== savedLead.id));
          setLeadPageMeta((meta) => ({ ...meta, total: Math.max(0, Number(meta.total || 0) - 1) }));
          showToast(Number(error?.status || 0) === 409
            ? '이미 접수된 연락처 또는 이메일입니다. 중복 접수 기준을 확인하세요.'
            : `접수 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
          return;
        }
        const delivery = {
          status: 'failed',
          summary: '외부 전송 실패',
          logs: [{ target: '외부 전송', status: 'failed', message: String(error?.message || error), at: new Date().toISOString() }]
        };
        setLeads((list)=>list.map((item)=>item.id === savedLead.id ? {
          ...item,
          delivery
        } : item));
        syncLeadPatch(savedLead.id, { delivery });
      });
  };
  const retryLeadDelivery = (lead) => {
    const pending = { status: 'pending', summary: '외부 전송 재시도 중', logs: lead.delivery?.logs || [] };
    setLeads((list)=>list.map((item)=>item.id === lead.id ? { ...item, delivery: pending } : item));
    syncLeadPatch(lead.id, { delivery: pending });

    runLeadDelivery({ ...lead, delivery: pending })
      .then((report) => {
        if (!report) return;
        setLeads((list)=>list.map((item)=>item.id === lead.id ? { ...item, delivery: report } : item));
        if (!isServerLeadMode()) syncLeadPatch(lead.id, { delivery: report });
      })
      .catch((error) => {
        console.warn('Integration retry failed:', error);
        const delivery = {
          status: 'failed',
          summary: '외부 전송 재시도 실패',
          logs: [
            ...(lead.delivery?.logs || []),
            { target: '외부 전송', status: 'failed', message: String(error?.message || error), at: new Date().toISOString() },
          ],
        };
        setLeads((list)=>list.map((item)=>item.id === lead.id ? { ...item, delivery } : item));
        syncLeadPatch(lead.id, { delivery });
      });
  };
  const retryFailedDeliveries = async () => {
    const failed = leads.filter((lead)=>['failed','partial'].includes(lead.delivery?.status));
    if (!failed.length) return;

    if (isServerLeadMode()) {
      try {
        const result = await retryFailedServerLeads(page, authUser);
        if (result?.leads?.length) setLeads(result.leads.map(normalizeLeadItem));
      } catch (error) {
        console.warn('Server failed deliveries retry failed:', error);
      }
      return;
    }

    failed.forEach((lead)=>retryLeadDelivery(lead));
  };
  const exportLeadsCsv = async (visibleLeads = [], exportFilters = {}) => {
    const monthRange = monthDateRange(exportFilters.month || inboxFilters.month);
    const filters = {
      ...exportFilters,
      month: monthRange.month,
      dateFrom: monthRange.dateFrom,
      dateTo: monthRange.dateTo,
      kind: exportFilters.kind || inboxFilters.kind,
      status: exportFilters.status || inboxFilters.status,
      q: exportFilters.q ?? inboxFilters.q,
    };
    try {
      if (isServerLeadMode()) {
        await downloadServerLeadsCsv(page, authUser, visibleLeads, filters);
        return;
      }
      downloadLeadsCsv(leads, page, { filters });
    } catch (error) {
      console.warn('Lead CSV export failed:', error);
      showToast(`CSV 내보내기에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };
  const refreshServerLeads = async ({ quiet = false } = {}) => {
    if (!isServerLeadMode()) return null;
    const monthRange = monthDateRange(inboxFilters.month);
    setLeadsSyncing(true);
    try {
      const result = await fetchServerLeads(page, authUser, {
        limit: INBOX_PAGE_SIZE,
        withMeta: true,
        kind: inboxFilters.kind === 'all' ? '' : inboxFilters.kind,
        status: inboxFilters.status === 'all' ? '' : inboxFilters.status,
        q: inboxFilters.q,
        month: monthRange.month,
        dateFrom: monthRange.dateFrom,
        dateTo: monthRange.dateTo,
      });
      const serverLeads = (result?.leads || []).map(normalizeLeadItem);
      setLeads(serverLeads);
      setLeadPageMeta({
        total: Number(result?.total || 0),
        nextCursor: result?.nextCursor ?? null,
        hasMore: !!result?.hasMore,
      });
      if (!quiet) showToast('최신 접수 데이터를 불러왔습니다.', 'success');
      return { ...result, leads: serverLeads };
    } catch (error) {
      console.warn('Server leads refresh failed:', error);
      if (!quiet) showToast(`접수 데이터 새로고침에 실패했습니다. ${String(error?.message || error)}`, 'error');
      return null;
    } finally {
      setLeadsSyncing(false);
    }
  };
  const loadMoreLeads = async () => {
    if (!leadPageMeta.hasMore || leadPageMeta.nextCursor == null || leadsSyncing) return;
    const monthRange = monthDateRange(inboxFilters.month);
    setLeadsSyncing(true);
    try {
      const result = await fetchServerLeads(page, authUser, {
        limit: INBOX_PAGE_SIZE,
        cursor: leadPageMeta.nextCursor,
        withMeta: true,
        kind: inboxFilters.kind === 'all' ? '' : inboxFilters.kind,
        status: inboxFilters.status === 'all' ? '' : inboxFilters.status,
        q: inboxFilters.q,
        month: monthRange.month,
        dateFrom: monthRange.dateFrom,
        dateTo: monthRange.dateTo,
      });
      const more = (result?.leads || []).map(normalizeLeadItem);
      setLeads((list) => {
        const seen = new Set(list.map((lead) => String(lead.id)));
        return [...list, ...more.filter((lead) => !seen.has(String(lead.id)))];
      });
      setLeadPageMeta({
        total: Number(result?.total || 0),
        nextCursor: result?.nextCursor ?? null,
        hasMore: !!result?.hasMore,
      });
    } catch (error) {
      console.warn('Server more leads load failed:', error);
    } finally {
      setLeadsSyncing(false);
    }
  };
  const updateLead = (id, patch) => {
    if (blockWrite('inbox')) return;
    const previous = leads.find((lead) => lead.id === id) || null;
    const expectedUpdatedAt = previous?.updatedAt || previous?.savedAt || previous?.createdAt || '';
    const historyEntry = previous && (
      (Object.prototype.hasOwnProperty.call(patch, 'status') && patch.status !== previous.status)
      || (Object.prototype.hasOwnProperty.call(patch, 'memo') && patch.memo !== previous.memo)
    )
      ? {
        id: uid(),
        type: Object.prototype.hasOwnProperty.call(patch, 'status') ? 'status' : 'memo',
        from: Object.prototype.hasOwnProperty.call(patch, 'status') ? previous.status || '' : previous.memo || '',
        to: Object.prototype.hasOwnProperty.call(patch, 'status') ? patch.status || '' : patch.memo || '',
        at: new Date().toISOString(),
      }
      : null;
    const patchWithHistory = historyEntry
      ? { ...patch, history: [...(previous?.history || []), historyEntry].slice(-30) }
      : patch;
    setLeads((list) => list.map((lead) => {
      if (lead.id !== id) return lead;
      return { ...lead, ...patchWithHistory };
    }));
    updateServerLead(id, { ...patchWithHistory, __expectedUpdatedAt: expectedUpdatedAt }, page, authUser).catch((error) => {
      console.warn('Server lead sync failed:', error);
      if (previous) {
        setLeads((list) => list.map((lead) => lead.id === id ? previous : lead));
        const conflict = isLeadConflictError(error);
        if (conflict && isServerLeadMode()) {
          setLeadConflict({
            id,
            action: 'update',
            patch: patchWithHistory,
            previous,
            latest: error?.details?.latest || null,
            message: leadConflictMessage('저장'),
            createdAt: Date.now(),
          });
          return;
        }
        showToast(conflict ? leadConflictMessage('저장') : `접수 데이터 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    });
  };
  const performDeleteLead = (id) => {
    if (blockWrite('inbox')) return;
    const removed = leads.find((lead) => lead.id === id) || null;
    setLeads((list) => list.filter((lead) => lead.id !== id));
    if (removed) setLeadPageMeta((meta) => ({ ...meta, total: Math.max(0, Number(meta.total || 0) - 1) }));
    deleteServerLead(id, page, authUser).catch((error) => {
      console.warn('Server lead delete failed:', error);
      if (removed) {
        setLeads((list) => [removed, ...list]);
        setLeadPageMeta((meta) => ({ ...meta, total: Number(meta.total || 0) + 1 }));
        if (isLeadConflictError(error) && isServerLeadMode()) {
          setLeadConflict({
            id,
            action: 'delete',
            previous: removed,
            latest: error?.details?.latest || null,
            message: leadConflictMessage('삭제'),
            createdAt: Date.now(),
          });
          return;
        }
        showToast(`접수 데이터 삭제에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    });
  };
  const deleteLead = (id) => {
    requestConfirm({
      title: '접수 데이터를 삭제할까요?',
      message: '삭제 후에는 이 화면에서 바로 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      danger: true,
      onConfirm: () => performDeleteLead(id),
    });
  };
  const reloadLeadConflict = async () => {
    await refreshServerLeads({ quiet: false });
    setLeadConflict(null);
  };
  const retryLeadConflict = async () => {
    const conflict = leadConflict;
    if (!conflict?.id) return;
    if (conflict.action === 'delete') {
      setLeadConflict(null);
      performDeleteLead(conflict.id);
      return;
    }

    const snapshot = await refreshServerLeads({ quiet: true });
    const latest = (snapshot?.leads || []).find((lead) => String(lead.id) === String(conflict.id));
    if (!latest) {
      showToast('최신 목록에서 해당 접수 데이터를 찾지 못했습니다. 목록을 새로고침하세요.', 'error');
      return;
    }

    const expectedUpdatedAt = latest.updatedAt || latest.savedAt || latest.createdAt || '';
    const nextLead = normalizeLeadItem({ ...latest, ...(conflict.patch || {}) });
    setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? nextLead : lead));
    try {
      const saved = await updateServerLead(conflict.id, { ...(conflict.patch || {}), __expectedUpdatedAt: expectedUpdatedAt }, page, authUser);
      if (saved) {
        setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? normalizeLeadItem(saved) : lead));
      }
      setLeadConflict(null);
      showToast('내 변경을 최신 접수 데이터에 다시 적용했습니다.', 'success');
    } catch (error) {
      console.warn('Server lead conflict retry failed:', error);
      if (isLeadConflictError(error)) {
        setLeadConflict({
          ...conflict,
          latest: error?.details?.latest || null,
          message: leadConflictMessage('저장'),
          createdAt: Date.now(),
        });
        showToast('다시 충돌했습니다. 최신 목록을 확인한 뒤 다시 시도하세요.', 'error');
      } else {
        setLeads((list) => list.map((lead) => String(lead.id) === String(conflict.id) ? latest : lead));
        showToast(`접수 데이터 재시도에 실패했습니다. ${String(error?.message || error)}`, 'error');
      }
    }
  };

  const confirmLeaveStyleChanges = (onConfirm) => {
    if (tab !== 'style' || !hasPendingStyle) return true;
    requestConfirm({
      title: '저장하지 않은 스타일 변경이 있습니다.',
      message: '저장하지 않고 이동하면 현재 미리보기 스타일은 버려집니다.',
      confirmLabel: '이동',
      onConfirm,
    });
    return false;
  };

  const clearPendingStyle = () => {
    if (hasPendingStyle) setStylePreviewTheme(null);
  };

  const persistStyleNow = async () => {
      if (blockWrite('style')) return;
      const nextPage = normalizePageForSave({ ...page, theme: { ...page.theme, ...stylePreviewTheme } });
      setPage(nextPage);
      saveLocalJson(STORAGE_KEY, nextPage, '페이지');
      try {
        await persistPage(nextPage, authUser);
      } catch (error) {
        const handled = await handlePageSaveError(error, nextPage);
        markSaveStatus(handled ? 'warning' : 'error', handled ? '저장 충돌' : '서버 저장 실패', handled
          ? '다른 곳에서 먼저 저장된 페이지가 있어 확인이 필요합니다.'
          : `로컬에는 남았지만 서버 저장에 실패했습니다. ${String(error?.message || error)}`);
        if (!handled) showToast(`서버 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
        return;
      }
      setStylePreviewTheme(null);
      setConnectionsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1000);
      markSaveStatus('ok', '서버 저장됨', '스타일과 페이지가 서버에 저장되었습니다.');
      showToast('스타일 설정이 저장되었습니다.', 'success');
  };

  const saveNow = async () => {
    if (!allowedTabs.includes(tab)) {
      markSaveStatus('warning', '저장 차단', '현재 권한에서 저장할 수 없는 화면입니다.');
      return;
    }
    if (!canWriteCurrentTab) {
      markSaveStatus('warning', '권한 없음', '마스터가 부여한 쓰기 권한이 필요합니다.');
      showToast('현재 계정에는 이 화면을 저장할 권한이 없습니다.', 'warning');
      return;
    }
    if (tab === 'style' && hasPendingStyle) {
      requestConfirm({
        title: '스타일 설정을 저장할까요?',
        message: '현재 미리보기 중인 스타일 값이 실제 페이지에 적용됩니다.',
        confirmLabel: '저장',
        onConfirm: persistStyleNow,
      });
      return;
    }

    const nextPage = normalizePageForSave(page);
    saveLocalJson(STORAGE_KEY, nextPage, '페이지');
    try {
      await persistPage(nextPage, authUser);
    } catch (error) {
      const handled = await handlePageSaveError(error, nextPage);
      markSaveStatus(handled ? 'warning' : 'error', handled ? '저장 충돌' : '서버 저장 실패', handled
        ? '다른 곳에서 먼저 저장된 페이지가 있어 확인이 필요합니다.'
        : `로컬에는 남았지만 서버 저장에 실패했습니다. ${String(error?.message || error)}`);
      if (!handled) showToast(`서버 저장에 실패했습니다. ${String(error?.message || error)}`, 'error');
      return;
    }
    setConnectionsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
    markSaveStatus('ok', '서버 저장됨', '페이지가 서버에 저장되었습니다.');
  };
  const changeTab = (nextTab) => {
    if (!allowedTabs.includes(nextTab)) return;
    if (nextTab === tab) return;
    const run = () => {
      clearPendingStyle();
      replaceLocationTab(nextTab);
      setTab(nextTab);
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };
  const previewUrl = `${location.origin}/${page.slug || ''}`;
  const loadTemplateModule = async () => {
    if (templateModuleRef.current) return templateModuleRef.current;
    const module = await import('./templates/landingTemplates.js');
    templateModuleRef.current = module;
    setTemplateChoices(module.LANDING_TEMPLATES.map((template) => module.getLandingTemplate(template.id)));
    return module;
  };

  useEffect(() => {
    if (!canUseBuilder) return;
    if (workspaceOpen && !createOpen && startMode !== 'template' && tab !== 'templates') return;
    loadTemplateModule().catch((error) => {
      console.warn('Template module load failed:', error);
      showToast(`템플릿을 불러오지 못했습니다. ${String(error?.message || error)}`, 'error');
    });
  }, [canUseBuilder, createOpen, startMode, tab, workspaceOpen]);
  const openPreview = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(previewUrl);
      setPreviewCopyIssue(null);
      showToast(`미리보기 주소를 복사했습니다. ${previewUrl}`, 'success');
    } catch (error) {
      console.warn('Preview URL copy failed:', error);
      setPreviewCopyIssue({
        url: previewUrl,
        message: '브라우저 권한 또는 보안 설정 때문에 자동 복사가 막혔습니다. 아래 주소를 선택해서 복사할 수 있습니다.',
      });
      showToast('자동 복사가 막혔습니다. 주소를 직접 복사해주세요.', 'warning');
    }
  };
  const chooseStartMode = (mode) => {
    if (!canManageAdmin) return;
    if (mode === 'template') {
      setStartMode('template');
      setTab('edit');
      return;
    }
    saveLocalJson(START_MODE_KEY, mode, '시작 선택', { quietSuccess: true });
    setStartMode(mode);
    if (mode === 'ai') {
      if (typeof history !== 'undefined') history.pushState(null, '', `/${page.slug || 'my-page'}/admin`);
      location.reload();
      return;
    }
    setTab('edit');
  };

  const reopenStartChoice = () => {
    if (!canManageAdmin) return;
    const run = () => {
      clearPendingStyle();
      localStorage.removeItem(START_MODE_KEY);
      setStartMode('');
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };

  const selectPreviewBlock = (id) => {
    if (!canUseBuilder) return;
    if (!id) return;
    const run = () => {
      clearPendingStyle();
      setTab('edit');
      setOpenId(id);
      requestAnimationFrame(() => {
        document.getElementById(`editor-block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };
  const reset = () => {
    requestConfirm({
      title: '저장된 페이지와 접수 데이터를 초기화할까요?',
      message: '로컬에 저장된 페이지, 접수 데이터, 통계 이벤트가 삭제되고 화면이 새로고침됩니다.',
      confirmLabel: '초기화',
      danger: true,
      onConfirm: () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEADS_KEY);
        localStorage.removeItem(EVENTS_KEY);
        location.reload();
      },
    });
  };

  const openWorkspace = (fallbackMode = 'manual') => {
    if (!canUseBuilder) {
      setTab(allowedTabs[0] || 'inbox');
      saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
      setWorkspaceOpen(true);
      return;
    }
    if (canManageAdmin && !startMode) {
      saveLocalJson(START_MODE_KEY, fallbackMode, '시작 선택', { quietSuccess: true });
      setStartMode(fallbackMode);
    }
    saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
    setWorkspaceOpen(true);
  };

  const closeWorkspace = () => {
    if (!confirmLeaveStyleChanges()) return;
    clearPendingStyle();
    saveLocalJson(DASHBOARD_KEY, { open: false }, '작업공간 상태', { quietSuccess: true });
    setWorkspaceOpen(false);
  };

  const logout = () => {
    const session = String(authUser?.session || '').trim();
    if (session) {
      logoutAuthAccount({ session }).catch((error) => {
        console.warn('Session logout request failed:', error);
      });
    }
    localStorage.removeItem(AUTH_KEY);
    saveLocalJson(DASHBOARD_KEY, { open: false }, '작업공간 상태', { quietSuccess: true });
    setAuthUser(null);
    setWorkspaceOpen(false);
  };

  const acceptAuth = (user) => {
    const normalized = normalizeAuthUser(user);
    saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
    setAuthUser(normalized);
    setAuthView('');
  };

  const updateAccountProfile = async (patch = {}) => {
    const session = String(authUser?.session || '').trim();
    if (!session) {
      showToast('로그인 세션이 없습니다. 다시 로그인해주세요.', 'error');
      throw new Error('Missing session');
    }
    const updated = await updateAuthAccount({
      ...patch,
      session,
      projectId: page.projectId || '',
    });
    const normalized = normalizeAuthUser({
      ...authUser,
      ...updated,
      session: updated?.session || session,
      signedAt: new Date().toISOString(),
    });
    saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
    setAuthUser(normalized);
    showToast('계정 정보가 저장되었습니다.', 'ok');
    return normalized;
  };

  const acceptInviteAuth = async (result = {}) => {
    const manager = result.manager || {};
    const project = result.project || {};
    const normalized = normalizeAuthUser({
      name: manager.name || manager.email || '매니저',
      email: manager.email || '',
      workspaceId: manager.ownerId || '',
      role: 'manager',
      accessMode: 'manager',
      session: result.session || '',
      defaultProject: project,
      signedAt: new Date().toISOString(),
    });
    saveLocalJson(AUTH_KEY, normalized, '로그인 정보', { quietSuccess: true });
    setAuthUser(normalized);
    setAuthView('');
    if (typeof history !== 'undefined') history.replaceState(null, '', '/');

    const projectSlug = project.slug || page.slug;
    const projectContextForInvite = {
      projectId: project.projectId || page.projectId,
      ownerId: project.ownerId || '',
      slug: projectSlug,
      session: result.session || '',
    };
    try {
      const serverPage = await fetchServerPage(projectSlug, projectContextForInvite);
      if (serverPage) {
        setPage(normalize(serverPage));
      } else {
        setPage((current) => normalizePageForSave({
          ...current,
          slug: projectSlug,
          projectId: project.projectId || current.projectId,
        }));
      }
    } catch (error) {
      console.warn('Invite project page load failed:', error);
      setPage((current) => normalizePageForSave({
        ...current,
        slug: projectSlug,
        projectId: project.projectId || current.projectId,
      }));
    }
    saveLocalJson(DASHBOARD_KEY, { open: true }, '작업공간 상태', { quietSuccess: true });
    setWorkspaceOpen(true);
  };

  const createWithAi = (draftInput = null) => {
    if (!canManageAdmin) return;
    if (draftInput && typeof draftInput === 'object') {
      const nextInput = normalizeAiDraftInput({
        ...(page.ai?.draftInput || {}),
        ...draftInput,
      });
      const nextPage = normalizePageForSave({
        ...page,
        ai: {
          ...(page.ai || {}),
          draftInput: nextInput,
          updatedAt: new Date().toISOString(),
        },
      });
      setPage(nextPage);
      saveLocalJson(STORAGE_KEY, nextPage, '페이지');
    }
    setCreateOpen(false);
    saveLocalJson(START_MODE_KEY, 'ai', '시작 선택', { quietSuccess: true });
    setStartMode('ai');
    if (typeof location !== 'undefined') {
      location.href = `/${page.slug || 'my-page'}/admin`;
      return;
    }
    openWorkspace('manual');
  };

  const createManual = (footerInfo = {}) => {
    if (!canManageAdmin) return;
    if (footerInfo && Object.keys(footerInfo).length) {
      const nextPage = normalizePageForSave({
        ...page,
        blocks: page.blocks.map((block) => (
          block.type === 'footer'
            ? { ...block, s: { ...block.s, ...footerInfo } }
            : block
        )),
      });
      setPage(nextPage);
      saveLocalJson(STORAGE_KEY, nextPage, '페이지');
    }
    setCreateOpen(false);
    saveLocalJson(START_MODE_KEY, 'manual', '시작 선택', { quietSuccess: true });
    setStartMode('manual');
    setTab('edit');
    openWorkspace('manual');
  };

  const createFromTemplate = async (templateId) => {
    if (!canUseBuilder) return;
    try {
      const templates = await loadTemplateModule();
      const next = templates.createTemplatePage(templateId, page);
      setPage(next);
      saveLocalJson(STORAGE_KEY, normalizePageForSave(next), '페이지');
      saveLocalJson(START_MODE_KEY, 'manual', '시작 선택', { quietSuccess: true });
      setStartMode('manual');
      setTab('edit');
      setOpenId(next.blocks.find((block) => !['topnav', 'bottombar', 'footer'].includes(block.type))?.id || '');
      setCreateOpen(false);
      openWorkspace('manual');
    } catch (error) {
      console.warn('Template apply failed:', error);
      showToast(`템플릿 적용에 실패했습니다. ${String(error?.message || error)}`, 'error');
    }
  };

  if (staticPage) return withWayziFooter(<WayziStaticPage page={staticPage} />);

  if (mobileBlocked) return withWayziFooter(<div className="mobile-block"><div><Smartphone size={42}/><h1>편집은 PC에서 이용해주세요.</h1><p>결과물은 모바일 화면으로 최적화됩니다.</p></div></div>);

  if (authUser && inviteToken) {
    return withWayziFooter(
      <Suspense fallback={<LazyPanelFallback />}>
        <InviteAcceptScreen
          token={inviteToken}
          authUser={authUser}
          onAccepted={acceptInviteAuth}
          onBack={()=>{ history.replaceState(null, '', '/'); setAuthView(''); }}
          onLogout={logout}
        />
      </Suspense>
    );
  }

  if (!authUser) {
    if (inviteToken) {
      return withWayziFooter(
        <Suspense fallback={<LazyPanelFallback />}>
          <InviteAcceptScreen token={inviteToken} onAccepted={acceptInviteAuth} onBack={()=>{ history.replaceState(null, '', '/'); setAuthView(''); }}/>
        </Suspense>
      );
    }
    if (adminRoute) {
      return withWayziFooter(<Suspense fallback={<LazyPanelFallback />}><AuthScreen initialMode="login" onBack={()=>{ history.replaceState(null, '', '/'); setAuthView(''); }} onAuth={acceptAuth}/></Suspense>);
    }
    if (authView) {
      return withWayziFooter(<Suspense fallback={<LazyPanelFallback />}><AuthScreen initialMode={authView} onBack={()=>setAuthView('')} onAuth={acceptAuth}/></Suspense>);
    }

    return withWayziFooter(<Suspense fallback={<LazyPanelFallback />}><PublicHome onLogin={()=>setAuthView('login')} onSignup={()=>setAuthView('signup')}/></Suspense>);
  }

  if (adminRoute) {
    if (!canManageAdmin) {
      return withWayziFooter(
        <div className="mobile-block">
          <div>
            <h1>접근 권한이 없습니다.</h1>
            <p>내부 관리자 화면은 마스터 계정으로 로그인했을 때만 열 수 있습니다.</p>
            <button className="ghost-btn" onClick={()=>{ history.replaceState(null, '', '/'); location.reload(); }}>메인으로</button>
          </div>
        </div>
      );
    }
    return withWayziFooter(
      <Suspense fallback={<LazyPanelFallback />}>
        <AdminPanel
          page={page}
          updatePage={updatePage}
          updateAi={updateAi}
          setPage={setNormalizedPage}
          setStartMode={setStartMode}
          authUser={authUser}
          onExit={()=>{ history.replaceState(null, '', '/'); location.reload(); }}
        />
      </Suspense>
    );
  }

  if (!workspaceOpen && canUseBuilder) {
    return withWayziFooter(
      <>
        <Suspense fallback={<LazyPanelFallback />}>
          <Dashboard
            user={authUser}
            page={page}
            leads={leads}
            onCreate={()=>setCreateOpen(true)}
            onAi={createWithAi}
            onManual={createManual}
            onTemplate={createFromTemplate}
            templates={templateChoices}
            onEdit={openWorkspace}
            onPreview={openPreview}
            onLogout={logout}
            onAccountUpdate={updateAccountProfile}
            TemplatesPanelComponent={TemplatesPanel}
          />
          {canUseBuilder && createOpen && <CreateLandingModal page={page} onClose={()=>setCreateOpen(false)} onAi={createWithAi} onManual={createManual} onTemplate={createFromTemplate} templates={templateChoices} TemplatesPanelComponent={TemplatesPanel}/>}
        </Suspense>
      </>
    );
  }

  return (
    <>
      <div className={`builder-shell${canUseBuilder && startMode === 'template' ? ' template-intro-shell' : ''}`}>
        {canManageAdmin && !startMode && !tabDeepLink && <Suspense fallback={<LazyPanelFallback />}><StartModeOverlay onManual={()=>chooseStartMode('manual')} onAi={()=>chooseStartMode('ai')} onTemplate={()=>chooseStartMode('template')} onClose={()=>setStartMode('manual')} templates={templateChoices}/></Suspense>} 
        <aside className="left-workspace">
          <section className="work-panel">
            {canManageAdmin && startMode === 'template' ? (
              <Suspense fallback={<LazyPanelFallback/>}>
                <TemplatesPanel page={page} templates={templateChoices} onApply={createFromTemplate}/>
              </Suspense>
            ) : (
              <>
                {clientAdminMode ? (
                  <header className="panel-header">
                    <div className="panel-title">
                      <p>{page.title}</p>
                      <h1>관리</h1>
                      <span>{authUser?.email || 'clientAdmin'}</span>
                    </div>
                    <div className="panel-actions">
                      <button className="ghost-btn" onClick={closeWorkspace}>메인</button>
                      <button className="ghost-btn" onClick={openPreview} title={previewUrl}>미리보기</button>
                    </div>
                  </header>
                ) : (
                  <PanelHeader page={page} tab={tab} saved={saved} saveStatus={saveStatus} onSave={saveNow} onPreview={openPreview} onStartChoice={reopenStartChoice} onDashboard={closeWorkspace} previewUrl={previewUrl}/>
                )}
                <nav className="top-tabs">{NAV.filter(([key]) => allowedTabs.includes(key)).map(([key, label, Icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => changeTab(key)}><Icon size={17}/><span>{label}</span></button>)}</nav>
                {canUseBuilder && tab === 'edit' && (
                  <EditPanel
                    page={page}
                    openId={openId}
                    setOpenId={setOpenId}
                    addOpen={addOpen}
                    setAddOpen={setAddOpen}
                    dragId={dragId}
                    setDragId={setDragId}
                    updateTheme={updateTheme}
                    toggleVisible={toggleVisible}
                    addBlock={addBlock}
                    removeBlock={removeBlock}
                    duplicateBlock={duplicateBlock}
                    reorderToIndex={reorderToIndex}
                    renderTopNavEditor={(block)=>renderLazyEditor(TopNavEditor, { s: block.s || {}, set: (patch)=>updateBlock(block.id, patch), page, TargetControl })}
                    renderBottomBarEditor={(block)=>renderLazyEditor(BottomBarEditor, { s: block.s || {}, set: (patch)=>updateBlock(block.id, patch), page })}
                    renderFooterEditor={(block)=>renderLazyEditor(FooterEditor, { s: block.s || {}, set: (patch)=>updateBlock(block.id, patch), page })}
                    renderBlockEditor={(block)=><BlockEditor block={block} page={page} updateBlock={updateBlock} editors={BLOCK_EDITORS} editorDeps={{ Color, Range, RichField, TargetControl, WidgetDesignControls, generateStandaloneFormHtml }}/>}
                  />
                )} 
                <Suspense fallback={<LazyPanelFallback/>}>
                  {canUseBuilder && tab === 'style' && <StylePanel page={page} updateTheme={updateTheme} onPreviewThemeChange={setStylePreviewTheme}/>}
                  {tab === 'inbox' && <InboxPanel leads={leads} page={page} syncing={leadsSyncing} totalLeads={leadPageMeta.total} hasMoreLeads={leadPageMeta.hasMore} loadMoreLeads={loadMoreLeads} onFiltersChange={setInboxFilters} updateIntegrations={updateIntegrations} connectionsEditing={connectionsEditing} setConnectionsEditing={setConnectionsEditing} updateLead={updateLead} deleteLead={deleteLead} retryLeadDelivery={retryLeadDelivery} retryFailedDeliveries={retryFailedDeliveries} exportLeadsCsv={exportLeadsCsv} leadConflict={leadConflict} onReloadLeadConflict={reloadLeadConflict} onRetryLeadConflict={retryLeadConflict} onDismissLeadConflict={() => setLeadConflict(null)} accessMode={accessMode}/>}
                  {tab === 'stats' && <StatsPanel events={events} leads={leads} page={page} eventPageMeta={statsEventPageMeta} leadPageMeta={statsLeadPageMeta} statsPartial={statsPartial} period={statsPeriod} onPeriodChange={setStatsPeriod} accessMode={accessMode}/>}
                  {tab === 'settings' && <SettingsPanel page={page} updatePage={updatePage} updateMeta={updateMeta} updateIntegrations={updateIntegrations} setPage={setNormalizedPage} onDuplicatePage={duplicatePageWithUrl} canDuplicatePage={canUsePageDuplication(page)} onReset={reset} authUser={authUser} accessMode={accessMode} onAccountUpdate={updateAccountProfile} onLogout={logout}/>}
                </Suspense>
              </>
            )}
          </section>
        </aside>
        <main className="preview-workspace"><div className="preview-sticky"><div className="preview-top"><div className="preview-title"><span>모바일 미리보기</span><strong>/{page.slug}</strong></div><a className="preview-link" href={previewUrl} target="_blank" rel="noreferrer">{previewUrl}</a></div><div className="phone-frame"><Suspense fallback={<div className="muted small">{'\uBBF8\uB9AC\uBCF4\uAE30\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.'}</div>}><PreviewRenderer page={previewPage} leads={leads} addLead={addLead} track={track} selectedBlockId={canUseBuilder ? openId : ''} onSelectBlock={canUseBuilder ? selectPreviewBlock : undefined}/></Suspense></div></div></main>
      </div>
      {pageConflict && (
        <PageConflictModal
          conflict={pageConflict}
          onClose={()=>setPageConflict(null)}
          onUseLatest={useLatestServerPage}
          onKeepDraft={keepLocalPageDraft}
          onForceSave={forceSaveLocalPage}
        />
      )}
      {confirmDialog && (
        <ConfirmModal
          dialog={confirmDialog}
          onClose={()=>setConfirmDialog(null)}
        />
      )}
      {previewCopyIssue && (
        <PreviewCopyModal
          issue={previewCopyIssue}
          onClose={()=>setPreviewCopyIssue(null)}
          onRetry={openPreview}
        />
      )}
      {toast && <ToastNotice toast={toast} onClose={()=>setToast(null)}/>}
      <WayziFooter />
    </>
  );
}




function InlineOptionRow({ label, children }) {
  return <div className="inline-option-line"><span>{label}</span><div>{children}</div></div>;
}

function InlineToggle({ checked, onChange }) {
  return <button type="button" className={`inline-mini-switch ${checked ? 'active' : ''}`} onClick={()=>onChange(!checked)}><i></i></button>;
}

function PresetButtons({ value, onChange, options }) {
  return (
    <div className="preset-mini-buttons">
      {options.map(([key,label])=>(
        <button key={key} type="button" className={String(value) === String(key) ? 'active' : ''} onClick={()=>onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function WidgetDesignControls({ s, set, compact = false }) {
  return (
    <div className={`widget-design-controls widget-design-controls-v3 ${compact ? 'compact' : ''}`}>
      <InlineOptionRow label="배경">
        <InlineToggle checked={!!s.bgEnabled} onChange={(v)=>set({bgEnabled:v})}/>
        {s.bgEnabled && <input className="mini-color-input" type="color" value={s.bgColor || '#FFFFFF'} onChange={(e)=>set({bgColor:e.target.value})}/>}
      </InlineOptionRow>
      <p className="widget-design-note">공통 디자인은 배경만 선택합니다. 간격과 라운드는 기본값으로 자동 정리됩니다.</p>
    </div>
  );
}

function questionTypeLabel(type){ return ({name:'이름',short:'단답형',long:'장문형',phone:'연락처',email:'이메일',address:'주소',select:'선택형',multi:'복수선택'}[type] || '단답형'); }
function formatAnswerValue(value){
  if(Array.isArray(value)) return value.join(', ');
  if(value && typeof value === 'object') return value.full || [value.postcode, value.address, value.detail].filter(Boolean).join(' ');
  return String(value ?? '');
}
function isEmptyAnswer(value){
  if(Array.isArray(value)) return value.length === 0;
  if(value && typeof value === 'object') return !formatAnswerValue(value).trim();
  return !String(value ?? '').trim();
}
function loadDaumPostcode(){
  return new Promise((resolve)=>{
    if(window.daum?.Postcode) return resolve(true);
    const existing = document.querySelector('script[data-daum-postcode="true"]');
    if(existing){
      existing.addEventListener('load',()=>resolve(true),{once:true});
      existing.addEventListener('error',()=>resolve(false),{once:true});
      return;
    }
    const script=document.createElement('script');
    script.src='https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async=true;
    script.dataset.daumPostcode='true';
    script.onload=()=>resolve(true);
    script.onerror=()=>resolve(false);
    document.head.appendChild(script);
  });
}
function getPageBg(theme) {
  if (theme?.bgMode === 'gradient') {
    const ratio = Math.max(0, Math.min(100, Number(theme.gradientRatio ?? 50)));
    const from = theme.gradientFrom || '#F5F7FA';
    const to = theme.gradientTo || '#EAF2FF';
    return `linear-gradient(135deg, ${from} 0%, ${from} ${ratio}%, ${to} 100%)`;
  }

  if (theme?.bgMode === 'image' && theme.bgImage) {
    if (theme.bgOverlay === false) return `url(${theme.bgImage})`;
    const rgb = hexToRgb(theme.bgOverlayColor || '#F5F7FA');
    const alpha = Math.max(0, Math.min(90, Number(theme.bgOverlayOpacity ?? 72))) / 100;
    return `linear-gradient(rgba(${rgb.r},${rgb.g},${rgb.b},${alpha}),rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})),url(${theme.bgImage})`;
  }

  return theme?.bgSolid || theme?.bg || '#F5F7FA';
}

function hexToRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function todayDate(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function weekdayKeyFromDate(value){
  const idx = new Date(`${value}T00:00:00`).getDay();
  return ['sun','mon','tue','wed','thu','fri','sat'][idx] || 'mon';
}
function weekdayLabelText(days=[]){
  const map = {mon:'월',tue:'화',wed:'수',thu:'목',fri:'금',sat:'토',sun:'일'};
  return (days || []).map((d)=>map[d]).filter(Boolean).join(' · ') || '월 · 화 · 수 · 목 · 금';
}
function slots(start='10:00',end='18:00',interval=30){ const [sh,sm]=String(start||'10:00').split(':').map(Number); const [eh,em]=String(end||'18:00').split(':').map(Number); let cur=(sh||10)*60+(sm||0),last=(eh||18)*60+(em||0),arr=[]; if(last<cur) last=cur; while(cur<=last){arr.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`);cur+=Number(interval||30);} return arr; }
function readFile(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file); }); }
function rich(text) {
  const raw = String(text || '');

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
    const root = doc.body.firstElementChild;

    const clean = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tag = node.tagName.toLowerCase();
      const inner = Array.from(node.childNodes).map(clean).join('');

      if (tag === 'br') return '<br>';
      if (tag === 'strong' || tag === 'b') return `<strong>${inner}</strong>`;
      if (tag === 'u') return `<u>${inner}</u>`;

      if (tag === 'span' || tag === 'font') {
        const color = node.style?.color || node.getAttribute?.('color') || '';
        const weight = node.style?.fontWeight || '';
        const style = [
          color ? `color:${color}` : '',
          weight && weight !== 'normal' ? `font-weight:${weight}` : '',
        ].filter(Boolean).join(';');
        return style ? `<span style="${style}">${inner}</span>` : inner;
      }

      if (tag === 'div' || tag === 'p') return inner ? `${inner}<br>` : '';
      return inner;
    };

    const html = Array.from(root.childNodes).map(clean).join('').replace(/(<br>\s*)+$/g, '');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
}

function lines(text){ return String(text||'').split('\n').map((line,i,arr)=><React.Fragment key={i}>{line}{i<arr.length-1&&<br/>}</React.Fragment>); }
function getTimerTarget(settings = {}) {
  const mode = settings.repeatMode || settings.timerMode || 'fixed';
  if (mode === 'daily24') {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { target: next.getTime(), cycle: Math.max(1, next.getTime() - start.getTime()), repeat: true };
  }
  const target = settings.endAt || settings.timerEndAt;
  return { target: target ? new Date(target).getTime() : Date.now()+1000*60*60*24*3, cycle: 1000*60*60*24*3, repeat: false };
}
function useCountdown(input){
  const settings = typeof input === 'object' ? input : { endAt: input };
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const data = getTimerTarget(settings);
  const diff=Math.max(0,data.target-now);
  const progress = data.repeat ? Math.max(0, Math.min(100, 100 - (diff / data.cycle * 100))) : Math.max(0, Math.min(100, 100 - (diff / (data.cycle || 1) * 100)));
  return {done:!data.repeat && diff<=0,d:Math.floor(diff/(1000*60*60*24)),h:String(Math.floor(diff/(1000*60*60)%24)).padStart(2,'0'),m:String(Math.floor(diff/(1000*60)%60)).padStart(2,'0'),s:String(Math.floor(diff/1000%60)).padStart(2,'0'),progress,diffMs:diff};
}

function getTimerUrgency(diffMs = 0, done = false) {
  if (done) return 'ended';
  const min = diffMs / 60000;
  if (min <= 10) return 'critical';
  if (min <= 60) return 'one';
  if (min <= 120) return 'two';
  if (min <= 180) return 'three';
  if (min <= 360) return 'six';
  return 'normal';
}
function detectTrafficChannel() {
  if (typeof location !== 'undefined') {
    const source = new URLSearchParams(location.search).get('utm_source');
    if (source) return source.trim().toLowerCase();
  }
  if (typeof document === 'undefined') return 'direct';
  const ref = String(document.referrer || '').toLowerCase();
  if (!ref) return 'direct';
  if (ref.includes('naver.')) return 'naver';
  if (ref.includes('google.')) return 'google';
  if (ref.includes('kakao.')) return 'kakao';
  if (ref.includes('instagram.')) return 'instagram';
  return 'referral';
}
function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(ua)) return 'mobile';
  return 'desktop';
}
function random(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function seedEvents(){ return Array.from({length:24},(_,i)=>({id:uid(),type:['page_view','page_view','cta_click','link_click'][i%4],label:i%3?'상담':'예약',channel:['direct','naver','google','kakao'][i%4],device:['mobile','desktop','tablet'][i%3],createdAt:new Date(Date.now()-i*1000*60*20).toISOString()})); }

export default App;















