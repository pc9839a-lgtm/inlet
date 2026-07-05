import { EditorStack } from '../controls.jsx';
import DownloadItemsSection from './DownloadItemsSection.jsx';
import { useDownloadItems } from './useDownloadItems.js';

export default function DownloadEditor({ s, set, page, authUser }) {
  const downloadItems = useDownloadItems(s, set);

  return (
    <EditorStack>
      <DownloadItemsSection page={page} authUser={authUser} {...downloadItems} />
    </EditorStack>
  );
}