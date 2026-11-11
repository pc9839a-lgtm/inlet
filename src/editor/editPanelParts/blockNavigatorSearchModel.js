import { createScreenOrderIdentities } from './screenOrderIdentityModel.js';

// Read-only composition search. A whitespace-separated query can match the
// block type, numbered occurrence, custom label and content snippet together.
// Neither the source block list nor its published order is ever changed.
export function findBlockNavigationMatches({
  blocks = [],
  fixedDescriptors = [],
  query = '',
  getBlockLabel = (block) => block.type,
}) {
  const words = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const typedIndex = /^(.+?)\s+([1-9]\d*)$/.exec(String(query).trim().toLocaleLowerCase());
  const identities = createScreenOrderIdentities(blocks);
  const normalized = (values) => values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value).toLocaleLowerCase())
    .join(' ');
  const fixed = (placement) => fixedDescriptors
    .filter((entry) => entry.block?.id && (placement === 'top' ? entry.key === 'topnav' : entry.key !== 'topnav'))
    .map((entry) => ({
      id: entry.block.id,
      text: normalized([entry.title, entry.badge, placement === 'top' ? '상단 고정' : '하단 고정']),
    }));
  const normal = blocks.flatMap((block, index) => {
    if (!block?.id) return [];
    const identity = identities[index];
    const label = getBlockLabel(block) || block.type;
    // An explicit "이미지 2" / "코드 3" search must select the numbered
    // block, not block 1 whose description might happen to mention "2".
    const type = String(label).toLocaleLowerCase();
    const typedIndexMatches = typedIndex
      && (type === typedIndex[1] || type.startsWith(typedIndex[1] + ' '))
      ? identity?.occurrence === Number(typedIndex[2])
      : null;
    return [{
      id: block.id,
      text: normalized([label, identity?.repeated ? identity.occurrence : '', identity?.customLabel, identity?.detail, identity?.contentTitle, identity?.contentSummary]),
      typedIndexMatches,
    }];
  });
  return [...fixed('top'), ...normal, ...fixed('bottom')]
    .filter((entry) => entry.typedIndexMatches === null || entry.typedIndexMatches === undefined
      ? words.every((word) => entry.text.includes(word))
      : entry.typedIndexMatches)
    .map(({ id }) => ({ id }));
}
