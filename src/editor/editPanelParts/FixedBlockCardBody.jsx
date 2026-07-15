import React from 'react';

export function FixedBlockCardBody({ block, renderEditor }) {
  return <div className="fixed-block-editor selected-block-settings-body block-editor">{renderEditor(block)}</div>;
}