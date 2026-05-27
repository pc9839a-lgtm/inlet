import { AddButton, Choice, Color, Danger, EditorStack, Field, LineList, MiniDetail, Step } from '../controls.jsx';

const uid = () => Math.random().toString(36).slice(2, 10);

function normalizeFaqItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || uid(),
    q: item.q || item.question || '질문을 입력하세요',
    a: item.a || item.answer || '답변을 입력하세요',
  }));
}

export function FaqEditor({ s, set }) {
  const items = normalizeFaqItems(s.items);
  const updateItem = (id, patch) => {
    set({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  };
  const removeItem = (id) => {
    set({ items: items.filter((item) => item.id !== id) });
  };

  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="제목" value={s.title || '자주 묻는 질문'} onChange={(v) => set({ title: v })} />
        <Choice
          label="형태"
          value={s.layout || 'accordion'}
          onChange={(v) => set({ layout: v })}
          options={[['accordion', '아코디언'], ['card', '카드'], ['plain', '기본']]}
        />
      </Step>

      <Step title="질문" icon="2" open>
        <LineList>
          {items.map((item, index) => (
            <MiniDetail key={item.id} icon={index + 1} title={item.q || `질문 ${index + 1}`}>
              <Field label="질문" value={item.q} onChange={(v) => updateItem(item.id, { q: v })} />
              <Field label="답변" textarea value={item.a} onChange={(v) => updateItem(item.id, { a: v })} />
              <Danger onClick={() => removeItem(item.id)} />
            </MiniDetail>
          ))}
        </LineList>
        <AddButton onClick={() => set({ items: [...items, { id: uid(), q: `질문 ${items.length + 1}`, a: '답변을 입력하세요' }] })} />
      </Step>
    </EditorStack>
  );
}

export function MapEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="장소명" value={s.placeName || s.title || ''} onChange={(v) => set({ placeName: v, title: v })} />
        <Field label="주소" value={s.address || ''} onChange={(v) => set({ address: v })} />
        <Field label="상세주소" value={s.detailAddress || ''} onChange={(v) => set({ detailAddress: v })} />
        <Field label="전화번호" value={s.phone || ''} onChange={(v) => set({ phone: v })} />
        <Field label="주차 안내" value={s.parkingText || ''} onChange={(v) => set({ parkingText: v })} />
        <Choice
          label="지도 방식"
          value={s.mapMode || 'google_embed'}
          onChange={(v) => set({ mapMode: v })}
          options={[['google_embed', 'Google 지도'], ['osm_fallback', '링크만 표시']]}
        />
        <Choice
          label="지도 높이"
          value={s.height || 'medium'}
          onChange={(v) => set({ height: v })}
          options={[['small', '낮게'], ['medium', '기본'], ['large', '높게']]}
        />
        <p className="map-editor-note">주소나 장소명을 입력하면 랜딩페이지에 지도가 바로 표시됩니다. 지도 검색 결과가 애매하면 상세주소까지 입력하세요.</p>
      </Step>
    </EditorStack>
  );
}

export function ScheduleEditor({ s, set }) {
  return (
    <EditorStack>
      <Step title="기본" icon="1" open>
        <Field label="제목" value={s.title || '일정 안내'} onChange={(v) => set({ title: v })} />
        <Field label="날짜" type="date" value={s.date || ''} onChange={(v) => set({ date: v })} />
        <Field label="상세 내용" textarea value={s.body || ''} placeholder="시간, 장소, 안내 문구 등을 자유롭게 입력" onChange={(v) => set({ body: v })} />
        <Field label="월 표기" value={s.monthLabel || ''} placeholder="비워두면 날짜 기준으로 표시" onChange={(v) => set({ monthLabel: v })} />
        <Choice
          label="정렬"
          value={s.align || 'center'}
          onChange={(v) => set({ align: v })}
          options={[['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']]}
        />
      </Step>
      <Step title="디자인" icon="2">
        <div className="schedule-design-grid">
          <Color label="카드 배경" value={s.cardBgColor || '#ffffff'} onChange={(v) => set({ cardBgColor: v })} />
          <Color label="강조색" value={s.highlightColor || '#8AA2C8'} onChange={(v) => set({ highlightColor: v })} />
          <Color label="텍스트색" value={s.textColor || '#111827'} onChange={(v) => set({ textColor: v })} />
        </div>
      </Step>
    </EditorStack>
  );
}
