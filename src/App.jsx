import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  RotateCcw,
  Upload,
} from 'lucide-react';
import PanelHeader from './builder/PanelHeader.jsx';
import { ConfirmModal, PageConflictModal, PreviewCopyModal, ToastNotice } from './builder/BuilderFeedback.jsx';
import { createBlockWriteGuard } from './runtime/createBlockWriteGuard.js';
import { createDuplicatePageAction } from './runtime/createDuplicatePageAction.js';
import { isLeadConflictError } from './builder/conflictUtils.js';
import { NAV } from './builder/navigation.js';
import { useBuilderFeedback } from './builder/useBuilderFeedback.js';
import { usePageConflict } from './builder/usePageConflict.js';
import { usePageSaveAction } from './runtime/usePageSaveAction.js';
import { commitLocalPageDraft as commitLocalPageDraftValue, markLocalPageMutation as markLocalPageMutationValue } from './runtime/pageDraftMutations.js';
import { createPageEditMutations } from './runtime/pageEditMutations.js';
import { normalizeFreeEmailIntegrations as normalizeFreeEmailIntegrationsForAccount } from './runtime/pageIntegrationMutations.js';
import { usePageSaveHelpers } from './runtime/usePageSaveHelpers.js';
import { usePersistStyleSaveAction } from './runtime/usePersistStyleSaveAction.js';
import { createLocalJsonSaver, createSaveStatusMarker } from './runtime/saveStatusActions.js';
import { usePendingStyleBeforeUnload } from './runtime/usePendingStyleBeforeUnload.js';
import { createWorkspacePanelProps } from './runtime/createWorkspacePanelProps.js';
import { useCreatePageActions } from './runtime/useCreatePageActions.js';
import { useCreatePageUrlCheck } from './runtime/useCreatePageUrlCheck.js';
import { useEditorBlockActions } from './runtime/useEditorBlockActions.js';
import { useInboxLeadActions } from './runtime/useInboxLeadActions.js';
import { useInboxLeadSync } from './runtime/useInboxLeadSync.js';
import { useLeadDeliveryRetryActions } from './runtime/useLeadDeliveryRetryActions.js';
import { useLocalWorkspacePersistence } from './runtime/useLocalWorkspacePersistence.js';
import { useLeadMutationActions } from './runtime/useLeadMutationActions.js';
import { useLandingTemplates } from './runtime/useLandingTemplates.js';
import { createLeadCaptureAction, createLeadDeliveryActions, createVisibleLeadUpdater } from './runtime/leadCaptureActions.js';
import { createPreviewPage, previewUrlForPage } from './runtime/previewTarget.js';
import { createLeadPatchSync, createPageEventTracker } from './runtime/publicPageRuntimeActions.js';
import { createAuthAccountActions } from './runtime/useAuthAccountActions.js';
import { useAuthSessionEffects } from './runtime/useAuthSessionEffects.js';
import { useAccountWorkspacePage } from './runtime/useAccountWorkspacePage.js';
import { usePreviewWindow } from './runtime/usePreviewWindow.js';
import { useProtectedWorkspaceRedirect } from './runtime/useProtectedWorkspaceRedirect.js';
import { isProtectedWorkspacePath, routeUsesWorkspaceTabs as shouldUseWorkspaceTabs } from './runtime/workspaceRouteGuards.js';
import { hasTabDeepLink, replaceLocationTab, tabFromLocation } from './runtime/workspaceTabLocation.js';
import { useStatsSummarySync } from './runtime/useStatsSummarySync.js';
import { useWorkspaceShellActions } from './runtime/useWorkspaceShellActions.js';
import { useWorkspaceAutoOpen } from './runtime/useWorkspaceAutoOpen.js';
import { useWorkspaceTabFallback } from './runtime/useWorkspaceTabFallback.js';
import { useWorkspaceEditorEffects } from './runtime/useWorkspaceEditorEffects.js';
import { useMobileWorkspaceMode } from './runtime/useMobileWorkspaceMode.js';
import WorkspaceEditorScreen from './screens/WorkspaceEditorScreen.jsx';
import PreviewRenderer from './preview/LandingRenderer.jsx';
import { BRAND_KO, BRAND_NAME } from './config/brand.js';
import { META } from './config/blockMeta.jsx';
import { AUTH_KEY, DASHBOARD_KEY, EVENTS_KEY, LEADS_KEY, START_MODE_KEY, STORAGE_KEY } from './config/storageKeys.js';
import BlockEditor from './editor/BlockEditor.jsx';
import { BLOCK_EDITORS } from './editor/blockEditorRegistry.jsx';
import { Color, Range } from './editor/compactControls.jsx';
import { alignOptions, formQuestionOptions, questionOptions, sizeOptions } from './editor/editorOptions.js';
import EditPanel from './editor/EditPanel.jsx';
import { createFixedBlockRenderers } from './editor/fixedBlockRenderers.jsx';
import TargetControl from './editor/TargetControl.jsx';
import RichField from './editor/RichField.jsx';
import { normalizeButtons } from './lib/blockButtons.js';
import { currentTrafficAttribution } from './lib/trafficAttribution.js';
import { canUseAdminSurface, canUseBuilderSurface, canWriteTab, isClientAdminMode, tabsForAccessMode, accessModeFor } from './lib/authContext.js';
import { normalizeAuthUser } from './lib/authIdentity.js';
import { generateStandaloneFormHtml } from './lib/formEmbed.js';
import { persistEvent } from './lib/eventRepository.js';
import { sendLeadIntegrations } from './lib/leadIntegrations.js';
import { deliverServerLead, persistLead, updateServerLead } from './lib/leadRepository.js';
import { isOwnerAdminModeEnabled, isServerLeadMode, isServerPageMode } from './config/runtimeConfig.js';
import { currentMonthValue } from './lib/monthRange.js';
import { fetchPublicServerPage } from './lib/pageRepository.js';
import { canUsePageDuplication, createDuplicatedPage } from './lib/pageDuplication.js';
import { projectContext } from './lib/projectContext.js';
import { fetchLinkPreview, linkThumbnailFromUrl, normalizeExternalUrl } from './lib/linkPreview.js';
import { isReservationLead, normalizeLeadItem } from './lib/leadModel.js';
import { defaultPage, normalize, normalizeIntegrations, normalizePageForSave, uid } from './lib/pageModel.js';
import { load, save as saveJson, storageErrorMessage } from './lib/storage.js';


const TAB_KEYS = new Set(NAV.map(([key]) => key));

function publicLandingSlugFromLocation(path = '') {
  if (typeof location === 'undefined' && !path) return '';
  const pathname = String(path || location.pathname || '/').replace(/\/+$/, '') || '/';
  if (pathname === '/') return '';
  if (WAYZI_STATIC_PAGES[pathname]) return '';
  if (/^\/(?:dashboard|app|account)(?:\/|$)/.test(pathname)) return '';
  if (/^\/invite\/[^/?#]+/.test(pathname)) return '';
  if (/^\/(?:admin|[^/?#]+\/admin)$/.test(pathname)) return '';
  if (/^\/(?:login|signup|api|assets|embed)(?:\/|$)/.test(pathname)) return '';
  const slug = pathname.replace(/^\//, '').split('/')[0] || '';
  return /^[a-zA-Z0-9-_]+$/.test(slug) ? slug : '';
}

const InboxPanel = lazy(() => import('./panels/InboxPanel.jsx'));
const StatsPanel = lazy(() => import('./panels/StatsPanel.jsx'));
const StylePanel = lazy(() => import('./panels/StylePanel.jsx'));
const SettingsPanel = lazy(() => import('./panels/SettingsPanel.jsx'));
const AdminPanel = lazy(() => import('./panels/MasterAdminPanel.jsx'));
const TemplatesPanel = lazy(() => import('./panels/TemplatesPanel'));
const InviteAcceptScreen = lazy(() => import('./screens/InviteAcceptScreen.jsx'));
const AuthScreen = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.AuthScreen })));
const Dashboard = lazy(() => import('./screens/HomeScreens.jsx').then((module) => ({ default: module.Dashboard })));
const PublicHome = lazy(() => import('./screens/PublicHomeRoute.jsx'));
const INBOX_PAGE_SIZE = 10;
const CHUNK_RELOAD_KEY = 'pagero-chunk-reload-v5';
const CHUNK_RELOAD_LIMIT = 5;
const PLATFORM_MASTER_EMAILS = ['admin@pagero.kr'];

function isPlatformMasterUser(user = null) {
  const email = String(user?.email || '').trim().toLowerCase();
  const role = String(user?.platformRole || user?.role || user?.accessMode || '').trim().toLowerCase().replace(/[-_\s]/g, '');
  return PLATFORM_MASTER_EMAILS.includes(email) || ['platformmaster', 'superadmin', 'serviceadmin'].includes(role);
}

function isLazyChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|ChunkLoadError/i.test(message);
}

async function clearBrowserRuntimeCaches() {
  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {}
  }
}

function replaceWithFreshRuntime() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('__fresh', String(Date.now()));
  window.location.replace(url.toString());
}

function resetChunkReloadAttempts() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.sessionStorage || {})
      .filter((key) => key.startsWith(`${CHUNK_RELOAD_KEY}:`))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}

function forceFreshRuntime() {
  resetChunkReloadAttempts();
  clearBrowserRuntimeCaches().finally(() => {
    replaceWithFreshRuntime();
  });
}

function chunkReloadScope() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.delete('__fresh');
  return `${url.pathname}${url.search}`;
}

function recoverLazyChunkLoad(error) {
  if (!isLazyChunkLoadError(error)) return false;
  if (typeof window === 'undefined') return false;
  const reloadKey = `${CHUNK_RELOAD_KEY}:${chunkReloadScope()}`;
  const attempts = Number(window.sessionStorage?.getItem(reloadKey) || 0);
  if (attempts >= CHUNK_RELOAD_LIMIT) return false;
  try {
    window.sessionStorage?.setItem(reloadKey, String(attempts + 1));
  } catch {}
  clearBrowserRuntimeCaches().finally(() => {
    replaceWithFreshRuntime();
  });
  return true;
}

function LazyPanelFallback() {
  return <section className="card"><div className="section-title"><h2>패널을 불러오는 중입니다.</h2></div></section>;
}

class LazyChunkBoundary extends Component {
  state = { error: null, recovering: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (recoverLazyChunkLoad(error)) {
      this.setState({ recovering: true });
      return;
    }
    console.warn('Lazy chunk load failed:', error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, recovering: false });
    }
  }

  render() {
    if (this.state.recovering) {
      return <LazyPanelFallback />;
    }
    if (this.state.error) {
      return (
        <section className="card">
          <div className="section-title">
            <h2>최신 화면으로 이동합니다.</h2>
            <p>배포 후 남은 캐시를 정리했습니다.</p>
          </div>
          <button type="button" className="save-connection-btn" onClick={forceFreshRuntime}>최신 화면 열기</button>
        </section>
      );
    }
    return this.props.children;
  }
}

const WAYZI_STATIC_PAGES = {
  '/about': {
    eyebrow: '사이트 소개',
    title: '페이지로 소개',
    updatedAt: '2026.06.12',
    links: [
      ['홈으로', '/'],
      ['개인정보처리방침', '/privacy'],
      ['이용약관', '/terms'],
      ['문의하기', '/contact'],
    ],
    intro: [
      '페이지로는 랜딩페이지 제작, 문의 접수, 전환 통계, 관리자 운영을 한 곳에서 처리할 수 있도록 만든 웹 기반 제작·운영 서비스입니다.',
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
          'Google Sheets 등 외부 도구와의 접수 데이터 연동',
        ],
      },
      {
        title: '서비스 운영 방향',
        body: ['페이지로는 단순히 화면을 만드는 도구가 아니라, 광고 유입 이후 문의 접수와 운영 관리까지 이어지는 흐름을 빠르게 만들 수 있도록 설계되었습니다. 사용자는 페이지 문구, 이미지, 폼 항목, 연결 설정을 직접 수정할 수 있고 운영자는 접수 데이터와 통계를 확인할 수 있습니다.'],
      },
      {
        title: '안내',
        body: ['서비스 내 일부 기능은 Google 계정 로그인, Google Sheets, 외부 이메일, 웹훅, 광고 추적 도구, 결제 또는 인증 서비스와 연결될 수 있습니다. 실제 제공 범위와 설정 가능 항목은 이용 중인 요금제, 운영 환경, 외부 서비스 정책에 따라 달라질 수 있습니다.'],
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
    updatedAt: '2026.06.12',
    links: [
      ['홈으로', '/'],
      ['사이트 소개', '/about'],
      ['개인정보처리방침', '/privacy'],
      ['이용약관', '/terms'],
    ],
    intro: [
      '페이지로 서비스 이용, 랜딩페이지 제작, 접수함·통계·권한 관리 설정과 관련해 궁금한 점이 있다면 아래 안내를 참고해 문의해주세요.',
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
      '페이지로는 서비스 제공, 문의 접수, 계정 관리, 운영 지원 및 사용자가 선택한 외부 연동 제공을 위해 필요한 범위의 개인정보를 수집·이용합니다. 본 페이지는 이용자에게 개인정보 수집, 이용, 보관, 파기 기준을 안내하기 위해 작성되었습니다.',
    ],
    sections: [
      {
        title: '1. 수집하는 개인정보 항목',
        items: ['이름 또는 담당자명', '이메일 주소', '휴대폰 번호 또는 연락처', '문의 내용 및 접수 폼 답변', '계정, 권한, 페이지 설정 정보', '접속 환경 정보(기기, 브라우저, 유입 경로, 페이지 URL 등)', 'Google 로그인을 이용하는 경우 Google 계정 이메일 및 기본 프로필 정보', 'Google Sheets 연동을 승인한 경우 승인한 Google Sheets 접근 권한, 스프레드시트 ID, 연결 계정 이메일, Google Sheets에 저장되는 접수 데이터'],
      },
      {
        title: '2. 개인정보 수집 목적',
        items: ['회원가입, 로그인, 본인 확인 및 계정 관리', '문의 접수 확인 및 상담 응대', '랜딩페이지 운영, 리드 관리, 통계 제공', '사용자가 페이지로에서 수집한 접수 데이터를 본인의 Google Sheets에 자동 저장', '결제, 계약, 서비스 이용 상태 확인', '중복 가입, 비정상 이용, 보안 사고 방지'],
      },
      {
        title: '3. Google 사용자 데이터 이용',
        body: ['페이지로는 사용자가 Google Sheets 연동을 승인한 경우, 사용자가 지정한 Google 스프레드시트에 접수 데이터를 저장하기 위해 Google Sheets API를 사용합니다. 페이지로가 접근하는 Google 사용자 데이터는 사용자가 승인한 Google Sheets 접근 권한, 사용자가 입력하거나 선택한 스프레드시트 ID, Google OAuth 연결 계정 이메일, Google Sheets에 저장되는 접수 데이터입니다. 이 데이터는 사용자가 페이지로에서 수집한 접수 데이터를 본인의 Google Sheets에 자동 저장하기 위한 목적으로만 사용됩니다.'],
      },
      {
        title: '4. Google 데이터 보관 및 연결 해제',
        body: ['Google OAuth refresh token은 서버에 암호화하여 저장합니다. 사용자가 Google Sheets 연결을 해제하면 관련 토큰은 비활성화하거나 삭제합니다. 페이지로는 Google 사용자 데이터를 광고, 판매, 리타게팅, 신용평가 목적으로 사용하지 않으며, 사용자가 승인한 기능 제공 목적 외 제3자에게 판매하거나 공유하지 않습니다.'],
      },
      {
        title: '5. 보유 및 이용 기간',
        body: ['수집된 개인정보는 서비스 제공 및 문의 응대 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다. 다만, 계약 이행, 분쟁 대응, 부정 이용 방지 또는 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관할 수 있습니다.'],
      },
      {
        title: '6. 제3자 제공',
        body: ['페이지로는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 이용자의 별도 동의가 있거나 법령에 따라 제공이 필요한 경우는 예외로 합니다.'],
      },
      {
        title: '7. 개인정보 처리 위탁',
        body: ['원활한 서비스 제공을 위해 일부 업무를 외부 서비스에 위탁할 수 있습니다. 예: 호스팅, 데이터 저장, 이메일 발송, 결제 처리, 분석 도구, 고객 응대 도구, 사용자가 선택한 Google Sheets 연동 처리.'],
      },
      {
        title: '8. 이용자의 권리',
        body: ['이용자는 언제든지 본인의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 요청은 아래 문의처를 통해 접수할 수 있습니다.'],
      },
      {
        title: '9. 문의처',
        body: ['개인정보 열람, 정정, 삭제, 처리정지 요청은 서비스 내 문의 채널 또는 관리자에게 접수할 수 있습니다. 문의 이메일: support@pagero.kr'],
      },
    ],
  },
  '/terms': {
    eyebrow: '정책 안내',
    title: '이용약관',
    updatedAt: '2026.06.12',
    links: [
      ['홈으로', '/'],
      ['사이트 소개', '/about'],
      ['개인정보처리방침', '/privacy'],
      ['문의하기', '/contact'],
    ],
    intro: [
      '본 약관은 페이지로 서비스 이용과 관련하여 서비스 제공자와 이용자 간의 기본적인 권리와 의무를 정리한 문서입니다.',
    ],
    sections: [
      {
        title: '1. 서비스 목적',
        body: ['페이지로는 랜딩페이지 제작, 폼 접수, 리드 관리, 통계 확인, 권한 관리, 외부 연동 설정 등 온라인 마케팅 운영에 필요한 기능 제공을 목적으로 운영됩니다.'],
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
        body: ['서비스 내 UI, 코드, 템플릿, 디자인 구성 등 자체 제작 콘텐츠의 저작권은 페이지로 또는 정당한 권리자에게 있습니다. 이용자가 업로드한 문구, 이미지, 고객 데이터의 권리와 책임은 해당 이용자에게 있습니다.'],
      },
      {
        title: '5. 외부 링크 및 제휴 안내',
        body: ['서비스에는 Google 로그인, Google Sheets, 이메일, 웹훅, 광고 추적 도구, 결제, 인증, 외부 링크 등 제3자 서비스 연결 기능이 포함될 수 있습니다. 외부 서비스 이용 시 해당 서비스의 약관과 정책이 별도로 적용됩니다.'],
      },
      {
        title: '6. 면책 조항',
        body: ['페이지로는 안정적인 서비스 제공을 위해 노력하지만, 외부 서비스 장애, 네트워크 문제, 이용자 설정 오류, 브라우저 또는 기기 환경에 따라 일부 기능 이용이 제한될 수 있습니다. 이용자는 공개 전 페이지 내용, 폼 항목, 개인정보 고지, 광고 추적 설정을 직접 확인해야 합니다.'],
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
  const [inboxFilters, setInboxFilters] = useState({ kind: 'all', status: 'all', deliveryStatus: 'all', q: '', month: currentMonthValue() });
  const [statsMonth, setStatsMonth] = useState(currentMonthValue());
  const [statsPeriod, setStatsPeriod] = useState('30d');
  const [statsChannel, setStatsChannel] = useState('all');
  const [serverStatsSummary, setServerStatsSummary] = useState(null);
  const [leadConflict, setLeadConflict] = useState(null);
  const [events, setEvents] = useState(() => load(EVENTS_KEY, []));
  const [tab, setTab] = useState(() => tabFromLocation(TAB_KEYS, 'edit'));
  const [openId, setOpenId] = useState('');
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
  const accountPageLoadRef = useRef('');
  const latestPageRef = useRef(page);
  const localPageMutationRef = useRef(0);
  const editInitialCollapseRef = useRef('');
  const { toast, confirmDialog, setToast, setConfirmDialog, showToast, requestConfirm } = useBuilderFeedback();
  const [connectionsEditing, setConnectionsEditing] = useState(true);
  const [startMode, setStartMode] = useState(() => load(START_MODE_KEY, ''));
  const [authUser, setAuthUser] = useState(() => normalizeAuthUser(load(AUTH_KEY, null)));
  const [workspaceOpen, setWorkspaceOpen] = useState(() => load(DASHBOARD_KEY, { open: false })?.open || false);
  const [createOpen, setCreateOpen] = useState(false);
  const [authView, setAuthView] = useState('');
  const [stylePreviewTheme, setStylePreviewTheme] = useState(null);
  const [stylePreviewBlocks, setStylePreviewBlocks] = useState(null);
  const [publicServerPage, setPublicServerPage] = useState(null);
  const [publicPageLoading, setPublicPageLoading] = useState(false);
  const [publicPageLoaded, setPublicPageLoaded] = useState(false);
  const [publicPageError, setPublicPageError] = useState('');
  const [routePath, setRoutePath] = useState(() => (typeof location === 'undefined' ? '/' : location.pathname));
  const mobileWorkspace = useMobileWorkspaceMode();
  const tabDeepLink = useMemo(() => hasTabDeepLink(TAB_KEYS), []);  const { handlePageSaveError, useLatestServerPage, keepLocalPageDraft, forceSaveLocalPage } = usePageConflict({
    authUser,
    pageConflict,
    setPageConflict,
    setPage,
    setStylePreviewTheme,
  });
  const hasPendingStyle = useMemo(
    () => (
      (!!stylePreviewTheme && JSON.stringify(stylePreviewTheme) !== JSON.stringify(page.theme || {}))
      || (!!stylePreviewBlocks && JSON.stringify(stylePreviewBlocks) !== JSON.stringify(page.blocks || []))
    ),
    [stylePreviewTheme, stylePreviewBlocks, page.theme, page.blocks],
  );
  const clearPendingStyle = () => {
    if (hasPendingStyle) setStylePreviewTheme(null);
    if (hasPendingStyle) setStylePreviewBlocks(null);
  };
  const ownerAdminModeEnabled = isOwnerAdminModeEnabled();
  const accessMode = useMemo(() => accessModeFor({ authUser, page, clientAdminEnabled: ownerAdminModeEnabled }), [authUser, ownerAdminModeEnabled, page]);
  const canUseBuilder = canUseBuilderSurface(accessMode, page, authUser);
  const canManageAdmin = canUseAdminSurface(accessMode);
  const canManageMasterAdmin = isPlatformMasterUser(authUser);
  const clientAdminMode = isClientAdminMode(accessMode);
  const accountAllowedTabs = useMemo(() => tabsForAccessMode(accessMode, page, authUser), [accessMode, page, authUser]);
  const allowedTabs = useMemo(
    () => mobileWorkspace ? accountAllowedTabs.filter((key) => key === 'inbox' || key === 'stats') : accountAllowedTabs,
    [accountAllowedTabs, mobileWorkspace],
  );
  const activeWorkspaceTab = mobileWorkspace && !allowedTabs.includes(tab) ? (allowedTabs[0] || '') : tab;
  const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key);
  const canWriteCurrentTab = canWriteTabKey(tab);
  const mapSiteId = useMemo(() => projectContext(page, authUser).projectId, [page.slug, page.projectId, authUser]);
  const previewPage = useMemo(() => createPreviewPage({
    page,
    stylePreviewTheme,
    stylePreviewBlocks,
    mapSiteId,
  }), [page, stylePreviewTheme, stylePreviewBlocks, mapSiteId]);
  const inviteToken = useMemo(() => {
    const match = routePath.match(/^\/invite\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, [routePath]);
  const adminRoute = useMemo(() => {
    return /^\/(?:admin|[^/?#]+\/admin)\/?$/.test(routePath);
  }, [routePath]);
  const authRouteMode = useMemo(() => {
    const pathname = routePath.replace(/\/+$/, '') || '/';
    if (pathname === '/login') return 'login';
    if (pathname === '/signup') return 'signup';
    return '';
  }, [routePath]);
  const staticPage = useMemo(() => {
    const pathname = routePath.replace(/\/+$/, '') || '/';
    return WAYZI_STATIC_PAGES[pathname] || null;
  }, [routePath]);
  const publicLandingSlug = useMemo(() => publicLandingSlugFromLocation(routePath), [routePath]);
  const protectedWorkspacePath = useMemo(() => isProtectedWorkspacePath(routePath), [routePath]);
  const routeUsesWorkspaceTabs = shouldUseWorkspaceTabs({ publicLandingSlug, staticPage, inviteToken, adminRoute, authRouteMode });

  const markSaveStatus = createSaveStatusMarker(setSaveStatus);
  const saveLocalJson = createLocalJsonSaver({
    saveJson,
    storageErrorMessage,
    saveErrorNoticeRef,
    markSaveStatus,
    showToast,
  });
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const syncRoute = () => setRoutePath(window.location.pathname || '/');
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    window.history.pushState = function pushStateAndSync(...args) {
      const result = pushState.apply(this, args);
      syncRoute();
      return result;
    };
    window.history.replaceState = function replaceStateAndSync(...args) {
      const result = replaceState.apply(this, args);
      syncRoute();
      return result;
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);
  useProtectedWorkspaceRedirect({ authUser, protectedWorkspacePath });
  useLocalWorkspacePersistence({
    authUser,
    events,
    latestPageRef,
    leads,
    page,
    publicLandingSlug,
    saveLocalJson,
    setAuthUser,
  });

  useAuthSessionEffects({
    authUser,
    pageProjectId: page.projectId,
    publicLandingSlug,
    sessionRefreshRef,
    saveLocalJson,
    setAuthUser,
    setWorkspaceOpen,
    setAuthView,
    showToast,
  });
  useAccountWorkspacePage({
    publicLandingSlug,
    authUser,
    page,
    setPage,
    accountPageLoadRef,
    latestPageRef,
    localPageMutationRef,
  });
  useEffect(() => {
    if (!publicLandingSlug) return undefined;
    let alive = true;
    setPublicPageLoading(true);
    setPublicPageLoaded(false);
    setPublicPageError('');
    if (!isServerPageMode()) {
      const localPage = normalize(load(STORAGE_KEY, defaultPage));
      const sameSlug = String(localPage.slug || '') === String(publicLandingSlug || '');
      setPublicServerPage(sameSlug ? localPage : null);
      setPublicPageError(sameSlug ? '' : '로컬 저장 페이지와 URL이 일치하지 않습니다.');
      setPublicPageLoading(false);
      setPublicPageLoaded(true);
      return () => { alive = false; };
    }
    fetchPublicServerPage(publicLandingSlug)
      .then((serverPage) => {
        if (!alive) return;
        const nextPage = serverPage ? normalize(serverPage) : null;
        if (!alive) return;
        setPublicServerPage(nextPage);
        setPublicPageError(nextPage ? '' : '페이지를 찾을 수 없습니다.');
      })
      .catch((error) => {
        if (!alive) return;
        console.warn('Public page load failed:', error);
        setPublicServerPage(null);
        setPublicPageError('페이지를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (alive) {
          setPublicPageLoading(false);
          setPublicPageLoaded(true);
        }
      });
    return () => { alive = false; };
  }, [publicLandingSlug]);
  useInboxLeadSync({
    tab,
    page,
    authUser,
    inboxFilters,
    pageSize: INBOX_PAGE_SIZE,
    setLeads,
    setLeadPageMeta,
    setLeadsSyncing,
  });

  useStatsSummarySync({
    tab,
    page,
    authUser,
    events,
    leads,
    statsMonth,
    statsPeriod,
    statsChannel,
    setEvents,
    setLeads,
    setStatsEventPageMeta,
    setStatsLeadPageMeta,
    setStatsPartial,
    setServerStatsSummary,
  });

  useWorkspaceEditorEffects({
    tab,
    page,
    workspaceOpen,
    editInitialCollapseRef,
    setStylePreviewTheme,
    setOpenId,
    setAddOpen,
  });
  useEffect(() => {
    if (!workspaceOpen || !createOpen) return;
    setCreateOpen(false);
  }, [createOpen, workspaceOpen]);
  useWorkspaceAutoOpen({
    authUser,
    canUseBuilder: canUseBuilder && !mobileWorkspace,
    workspaceOpen,
    persistOpenState: (open) => saveLocalJson(DASHBOARD_KEY, { open }, '작업공간 상태', { quietSuccess: true }),
    setWorkspaceOpen,
  });
  useWorkspaceTabFallback({
    authUser,
    routeUsesWorkspaceTabs,
    allowedTabs,
    tab,
    tabKeys: TAB_KEYS,
    clearPendingStyle,
    setTab,
  });
  usePendingStyleBeforeUnload(hasPendingStyle);

  const blockWrite = createBlockWriteGuard({
    canWriteTabKey,
    showToast,
    markSaveStatus,
    messages: {
      toast: '\uD604\uC7AC \uACC4\uC815\uC5D0\uB294 \uC774 \uD654\uBA74\uC744 \uC218\uC815\uD560 \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
      statusLabel: '\uAD8C\uD55C \uC5C6\uC74C',
      statusDetail: '\uB9C8\uC2A4\uD130\uAC00 \uBD80\uC5EC\uD55C \uC4F0\uAE30 \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
    },
  });
  const markLocalPageMutation = () => markLocalPageMutationValue(localPageMutationRef);
  const commitLocalPageDraft = (nextPage) => commitLocalPageDraftValue({
    nextPage,
    normalizePageForSave,
    latestPageRef,
    markLocalPageMutation,
  });
  const normalizeFreeEmailIntegrations = (sourcePage) => normalizeFreeEmailIntegrationsForAccount({
    sourcePage,
    authUser,
    normalizeIntegrations,
  });
  const {
    setNormalizedPage,
    updatePage,
    updateTheme,
    updateStyleBlocks,
    updateMeta,
    updateAi,
    updateIntegrations,
  } = createPageEditMutations({
    tab,
    blockWrite,
    setPage,
    commitLocalPageDraft,
    normalizeIntegrations,
    normalizeFreeEmailIntegrations,
  });
  const {
    updateBlock,
    toggleVisible,
    addBlock,
    removeBlock,
    duplicateBlock,
    reorderToIndex,
  } = useEditorBlockActions({
    page,
    openId,
    blockWrite,
    setPage,
    commitLocalPageDraft,
    setOpenId,
    setAddOpen,
  });
  const duplicatePageWithUrl = createDuplicatePageAction({
    page,
    blockWrite,
    canUsePageDuplication,
    createDuplicatedPage,
    latestPageRef,
    markLocalPageMutation,
    setPage,
    setLeads,
    setEvents,
    setOpenId,
    setTab,
    replaceLocationTab,
    tabKeys: TAB_KEYS,
    saveLocalJson,
    startModeKey: START_MODE_KEY,
    showToast,
  });
  const { authForTargetPage, trackForPage, track } = createPageEventTracker({
    page,
    authUser,
    publicLandingSlug,
    currentTrafficAttribution,
    detectDeviceType,
    uid,
    setEvents,
    persistEvent,
  });
  const syncLeadPatch = createLeadPatchSync({
    leads,
    page,
    authUser,
    updateServerLead,
    isLeadConflictError,
  });
  const { runLeadDelivery, runLeadDeliveryForPage } = createLeadDeliveryActions({
    page,
    authUser,
    isServerLeadMode,
    deliverServerLead,
    sendLeadIntegrations,
  });
  const upsertVisibleLead = createVisibleLeadUpdater({ normalizeLeadItem, setLeads });
  const addLeadForPage = createLeadCaptureAction({
    currentTrafficAttribution,
    uid,
    normalizeLeadItem,
    setLeads,
    setLeadPageMeta,
    trackForPage,
    isReservationLead,
    authForTargetPage,
    persistLead,
    runLeadDeliveryForPage,
    isServerLeadMode,
    syncLeadPatch,
    upsertVisibleLead,
    showToast,
  });
  const addLead = (lead) => addLeadForPage(page, lead);
  const { retryFailedDeliveries, retryLeadDelivery } = useLeadDeliveryRetryActions({
    authUser,
    leads,
    page,
    runLeadDelivery,
    setLeads,
    syncLeadPatch,
  });

  const { exportLeadsCsv, loadMoreLeads, refreshServerLeads } = useInboxLeadActions({
    authUser,
    inboxFilters,
    leadPageMeta,
    leads,
    leadsSyncing,
    page,
    pageSize: INBOX_PAGE_SIZE,
    setLeadPageMeta,
    setLeads,
    setLeadsSyncing,
    showToast,
  });
  const { deleteLead, reloadLeadConflict, retryLeadConflict, updateLead } = useLeadMutationActions({
    authUser,
    blockWrite,
    leadConflict,
    leads,
    page,
    refreshServerLeads,
    requestConfirm,
    setLeadConflict,
    setLeadPageMeta,
    setLeads,
    showToast,
  });
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

  const {
    pageForAccountSave,
    savedPageFromResult,
  } = usePageSaveHelpers({
    page,
    authUser,
    latestPageRef,
    normalizeFreeEmailIntegrations,
  });

  const { persistStyleNow } = usePersistStyleSaveAction({
    page,
    authUser,
    latestPageRef,
    stylePreviewTheme,
    stylePreviewBlocks,
    blockWrite,
    pageForAccountSave,
    savedPageFromResult,
    handlePageSaveError,
    markSaveStatus,
    saveLocalJson,
    showToast,
    setPage,
    setStylePreviewTheme,
    setStylePreviewBlocks,
    setConnectionsEditing,
    setSaved,
  });

  const { saveNow } = usePageSaveAction({
    allowedTabs,
    tab,
    canWriteCurrentTab,
    hasPendingStyle,
    page,
    authUser,
    latestPageRef,
    requestConfirm,
    persistStyleNow,
    pageForAccountSave,
    savedPageFromResult,
    handlePageSaveError,
    markSaveStatus,
    saveLocalJson,
    showToast,
    setConnectionsEditing,
    setPage,
    setSaved,
  });
  const changeTab = (nextTab) => {
    if (!allowedTabs.includes(nextTab)) return;
    if (nextTab === tab) return;
    const run = () => {
      clearPendingStyle();
      replaceLocationTab(TAB_KEYS, nextTab);
      setTab(nextTab);
      if (nextTab === 'edit') {
        setOpenId('');
        setAddOpen(false);
      }
    };
    if (!confirmLeaveStyleChanges(run)) return;
    run();
  };
  const previewUrl = previewUrlForPage(page);
  const { templateChoices, loadTemplateModule } = useLandingTemplates({
    enabled: canUseBuilder,
    createOpen,
    startMode,
    tab,
    workspaceOpen,
    showToast,
  });
  const { openPreview } = usePreviewWindow({
    previewUrl,
    setPreviewCopyIssue,
    showToast,
  });
  const { checkCreatePageUrl } = useCreatePageUrlCheck({
    page,
    authUser,
  });
  const {
    chooseStartMode,
    reopenStartChoice,
    selectPreviewBlock,
    openWorkspace,
    closeWorkspace,
  } = useWorkspaceShellActions({
    page,
    allowedTabs,
    canUseBuilder,
    canManageAdmin,
    startMode,
    confirmLeaveStyleChanges,
    clearPendingStyle,
    saveLocalJson,
    setStartMode,
    setTab,
    setOpenId,
    setAddOpen,
    setWorkspaceOpen,
  });

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
  const { acceptAuth, acceptInviteAuth, logout, updateAccountProfile } = createAuthAccountActions({
    authUser,
    page,
    saveLocalJson,
    setAuthUser,
    setAuthView,
    setPage,
    setWorkspaceOpen,
    showToast,
  });

  const {
    createWithAi,
    createManual,
    createFromTemplate,
  } = useCreatePageActions({
    page,
    authUser,
    canManageAdmin,
    canUseBuilder,
    loadTemplateModule,
    savedPageFromResult,
    saveLocalJson,
    showToast,
    setPage,
    setCreateOpen,
    setStartMode,
    setTab,
    setOpenId,
    openWorkspace,
  });

  if (staticPage) return withWayziFooter(<WayziStaticPage page={staticPage} />);

  if (publicLandingSlug) {
    const publicPage = publicServerPage
      ? normalize({ ...publicServerPage, slug: publicLandingSlug || publicServerPage.slug })
      : null;
    return (
      <main className="public-landing-shell">
        <div className="public-landing-viewport">
          <LazyChunkBoundary resetKey={`public-${publicLandingSlug}`}>
            <Suspense fallback={<LazyPanelFallback />}>
              {publicPageLoading || !publicPageLoaded ? (
                <LazyPanelFallback />
              ) : !publicPage ? (
                <section className="public-landing-empty">
                  <h1>페이지를 찾을 수 없습니다.</h1>
                  <p>{publicPageError || '주소를 확인하거나 페이지를 다시 저장해주세요.'}</p>
                </section>
              ) : (
                <PreviewRenderer
                  page={publicPage}
                  publicView
                  leads={leads}
                  addLead={(lead) => addLeadForPage(publicPage, lead)}
                  track={(event) => trackForPage(publicPage, event)}
                />
              )}
            </Suspense>
          </LazyChunkBoundary>
        </div>
      </main>
    );
  }

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
    const requestedAuthView = authRouteMode || authView;
    if (requestedAuthView) {
      return withWayziFooter(
        <Suspense fallback={<LazyPanelFallback />}>
          <AuthScreen
            key={requestedAuthView}
            initialMode={requestedAuthView}
            onBack={()=>{ history.replaceState(null, '', '/'); setAuthView(''); }}
            onAuth={acceptAuth}
          />
        </Suspense>
      );
    }

    return withWayziFooter(<Suspense fallback={<LazyPanelFallback />}><PublicHome onLogin={()=>setAuthView('login')} onSignup={()=>setAuthView('signup')}/></Suspense>);
  }

  if (adminRoute) {
    if (!canManageMasterAdmin) {
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
      <LazyChunkBoundary resetKey="admin">
        <Suspense fallback={<LazyPanelFallback />}>
          <AdminPanel
            page={page}
            leads={leads}
            events={events}
            updatePage={updatePage}
            updateAi={updateAi}
            setPage={setNormalizedPage}
            setStartMode={setStartMode}
            authUser={authUser}
            onExit={()=>{ history.replaceState(null, '', '/'); location.reload(); }}
          />
        </Suspense>
      </LazyChunkBoundary>
    );
  }

  if (!workspaceOpen && canUseBuilder && !mobileWorkspace) {
    return withWayziFooter(
      <>
        <LazyChunkBoundary resetKey="dashboard">
          <Suspense fallback={<LazyPanelFallback />}>
            <Dashboard
              user={authUser}
              page={page}
              leads={leads}
              onCreate={()=>setCreateOpen(true)}
              onAi={createWithAi}
              onManual={createManual}
              onTemplate={createFromTemplate}
              onCheckUrl={checkCreatePageUrl}
              templates={templateChoices}
              onEdit={openWorkspace}
              onPreview={openPreview}
              onLogout={logout}
              onAccountUpdate={updateAccountProfile}
              TemplatesPanelComponent={TemplatesPanel}
            />
          </Suspense>
        </LazyChunkBoundary>
      </>
    );
  }

  const fixedBlockRenderers = createFixedBlockRenderers({ page, updateBlock });

  const editPanelProps = {
    page,
    openId,
    setOpenId,
    addOpen,
    setAddOpen,
    dragId,
    setDragId,
    updateTheme,
    toggleVisible,
    addBlock,
    removeBlock,
    duplicateBlock,
    reorderToIndex,
    ...fixedBlockRenderers,
    renderBlockEditor: (block) => <BlockEditor block={block} page={page} updateBlock={updateBlock} editors={BLOCK_EDITORS} editorDeps={{ Color, Range, RichField, TargetControl, WidgetDesignControls, generateStandaloneFormHtml, authUser }} />,
  };

  const {
    stylePanelProps,
    inboxPanelProps,
    statsPanelProps,
    settingsPanelProps,
  } = createWorkspacePanelProps({
    page,
    authUser,
    updateTheme,
    updateStyleBlocks,
    setStylePreviewTheme,
    leads,
    updatePage,
    leadsSyncing,
    leadPageMeta,
    loadMoreLeads,
    refreshServerLeads,
    setInboxFilters,
    updateIntegrations,
    saveNow,
    connectionsEditing,
    setConnectionsEditing,
    updateLead,
    deleteLead,
    retryLeadDelivery,
    retryFailedDeliveries,
    exportLeadsCsv,
    leadConflict,
    reloadLeadConflict,
    retryLeadConflict,
    setLeadConflict,
    accessMode,
    events,
    statsEventPageMeta,
    statsLeadPageMeta,
    statsPartial,
    statsMonth,
    setStatsMonth,
    statsPeriod,
    setStatsPeriod,
    serverStatsSummary,
    statsChannel,
    setStatsChannel,
    updateMeta,
    setNormalizedPage,
    duplicatePageWithUrl,
    checkCreatePageUrl,
    reset,
    updateAccountProfile,
    logout,
  });


  return (
    <>
      <WorkspaceEditorScreen
        canUseBuilder={canUseBuilder}
        mobileOperationsOnly={mobileWorkspace}
        canManageAdmin={canManageAdmin}
        clientAdminMode={clientAdminMode}
        startMode={startMode}
        createOpen={createOpen}
        onCloseCreate={() => setCreateOpen(false)}
        page={page}
        tab={activeWorkspaceTab}
        saved={saved}
        saveStatus={saveStatus}
        onSave={saveNow}
        onPreview={openPreview}
        onDashboard={closeWorkspace}
        onStartChoice={reopenStartChoice}
        previewUrl={previewUrl}
        createWithAi={createWithAi}
        createManual={createManual}
        createFromTemplate={createFromTemplate}
        onCheckUrl={checkCreatePageUrl}
        defaultSlug={page.slug}
        templates={templateChoices}
        allowedTabs={allowedTabs}
        changeTab={changeTab}
        editPanelProps={editPanelProps}
        stylePanelProps={stylePanelProps}
        inboxPanelProps={inboxPanelProps}
        statsPanelProps={statsPanelProps}
        settingsPanelProps={settingsPanelProps}
        previewPage={previewPage}
        leads={leads}
        addLead={addLead}
        track={track}
        selectedBlockId={canUseBuilder ? openId : ''}
        onSelectPreviewBlock={canUseBuilder ? selectPreviewBlock : undefined}
      />
      {pageConflict && (
        <PageConflictModal
          conflict={pageConflict}
          onClose={() => setPageConflict(null)}
          onUseLatest={useLatestServerPage}
          onKeepDraft={keepLocalPageDraft}
          onForceSave={forceSaveLocalPage}
        />
      )}
      {confirmDialog && (
        <ConfirmModal
          dialog={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}
      {previewCopyIssue && (
        <PreviewCopyModal
          issue={previewCopyIssue}
          onClose={() => setPreviewCopyIssue(null)}
          onRetry={openPreview}
        />
      )}
      {toast && <ToastNotice toast={toast} onClose={() => setToast(null)} />}
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
  return null;
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
  return currentTrafficAttribution().channel;
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















