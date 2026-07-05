import { Choice, Step, Toggle } from '../controls.jsx';

export default function SearchDisplaySection({ s, set }) {
  return (
    <Step title="표시" icon="2">
      <Choice
        label="형태"
        value={s.layout || 'card'}
        onChange={(v) => set({ layout: v })}
        options={[
          ['card', '카드'],
          ['bar', '바'],
          ['minimal', '심플'],
        ]}
      />
      <Toggle label="실시간 검색" checked={s.live !== false} onChange={(v) => set({ live: v })} />
    </Step>
  );
}