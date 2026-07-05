export default function ManagerEmptyState({ addManager, locked }) {
  return (
    <div className="manager-empty-state compact">
      <strong>매니저가 없습니다.</strong>
      <p>매니저를 추가한 뒤 메뉴권한 또는 초대만 열어 설정하세요.</p>
      <button type="button" disabled={locked} onClick={addManager}>첫 매니저 추가</button>
    </div>
  );
}