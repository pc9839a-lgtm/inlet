import React from 'react';
import { BLOCK_EDITORS } from './blockEditorRegistry.jsx';
import { createBlockEditorDeps } from './blockEditorDeps.js';
import BlockEditor from './BlockEditor.jsx';

export function createBlockSettingsRenderer({ page, updateBlock, authUser }) {
  const editorDeps = createBlockEditorDeps(authUser);
  return (block) => (
    <BlockEditor
      block={block}
      page={page}
      updateBlock={updateBlock}
      editors={BLOCK_EDITORS}
      editorDeps={editorDeps}
    />
  );
}