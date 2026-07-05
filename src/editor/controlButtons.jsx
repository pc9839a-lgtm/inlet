export function AddButton({ onClick }) {
  return (
    <button type="button" className="add-line add-line-clean" onClick={onClick}>
      + 추가
    </button>
  );
}

export function Danger({ onClick }) {
  return (
    <button type="button" className="danger-btn danger-btn-clean" onClick={onClick}>
      삭제
    </button>
  );
}