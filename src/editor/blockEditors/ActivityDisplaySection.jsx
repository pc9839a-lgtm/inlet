import { Choice, Field, Step } from '../controls.jsx';

export default function ActivityDisplaySection({ s, set, dataSource, mode }) {
  return (
    <Step title="표시" icon="2">
      <Choice
        label="표시"
        value={mode}
        onChange={(v) => set({ mode: v })}
        options={[
          ['feed', '접수 목록'],
          ['count', '숫자'],
        ]}
      />
      {mode === 'count' && dataSource === 'sample' && (
        <Field
          label="예시 숫자"
          type="number"
          value={s.baseCount ?? 12}
          onChange={(v) => set({ baseCount: Number(v) })}
        />
      )}
    </Step>
  );
}