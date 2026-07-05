import React from 'react';

export function SelectedBlockSettingsBody({ block, renderBlockEditor }) {
  return (
    <div key={block.id} className="selected-block-settings-body block-editor">
      {renderBlockEditor(block)}
    </div>
  );
}