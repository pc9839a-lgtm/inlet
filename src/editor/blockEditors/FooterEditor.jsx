import { ChevronDown } from 'lucide-react';
import FooterBusinessSection from './FooterBusinessSection.jsx';
import FooterContactSection from './FooterContactSection.jsx';
import FooterLegalSection from './FooterLegalSection.jsx';
import { FooterStylePanel } from './WidgetStylePanels.jsx';

export default function FooterEditor({ s, set }) {
  return (
    <div className="footer-editor-flow">
      <section className="footer-editor-primary" aria-label="사업자 기본 정보">
        <FooterBusinessSection s={s} set={set} />
      </section>
      <details className="footer-editor-contact">
        <summary>
          <strong>추가 정보</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="footer-editor-extra-controls">
          <FooterContactSection s={s} set={set} />
        </div>
      </details>
      <details className="footer-editor-legal">
        <summary>
          <strong>법적 문서</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="footer-editor-extra-controls">
          <FooterLegalSection s={s} set={set} />
        </div>
      </details>
      <details className="footer-editor-design">
        <summary>
          <strong>디자인</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <div className="footer-editor-extra-controls">
          <FooterStylePanel s={s} set={set} />
        </div>
      </details>
    </div>
  );
}
