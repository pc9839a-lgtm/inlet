import { Choice } from '../controls.jsx';

const menuCountOptions = [
  ['1', '1개'],
  ['2', '2개'],
  ['3', '3개'],
  ['4', '4개'],
  ['5', '5개'],
  ['6', '6개'],
  ['7', '7개'],
  ['8', '8개'],
];

export default function TopNavMenuCountControl({ count, onChange }) {
  return (
    <Choice
      label="메뉴 개수"
      value={String(count || 1)}
      onChange={onChange}
      options={menuCountOptions}
    />
  );
}
