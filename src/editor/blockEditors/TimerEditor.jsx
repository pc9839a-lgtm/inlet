import { EditorTabs } from '../ui/index.js';
import TimerBasicSection from './TimerBasicSection.jsx';
import TimerCtaTargetSection from './TimerCtaTargetSection.jsx';
import TimerFloatingCtaSection from './TimerFloatingCtaSection.jsx';
import { TimerStylePanel } from './WidgetStylePanels.jsx';

export default function TimerEditor({ s, set, page, TargetControl }) {
  return (
    <EditorTabs
      tabs={[
        {
          id: 'content',
          label: '타이머',
          content: <TimerBasicSection s={s} set={set} />,
        },
        {
          id: 'action',
          label: '버튼',
          content: (
            <>
              <TimerFloatingCtaSection s={s} set={set} />
              <TimerCtaTargetSection s={s} set={set} page={page} TargetControl={TargetControl} />
            </>
          ),
        },
        {
          id: 'style',
          label: '스타일',
          content: <TimerStylePanel s={s} set={set} />,
        },
      ]}
    />
  );
}
