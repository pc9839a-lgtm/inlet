import React from 'react';
import { FixedBlockCardBody } from './FixedBlockCardBody.jsx';
import { FixedBlockCardHeader } from './FixedBlockCardHeader.jsx';

export function FixedBlockCard({ block, className, title, badge, renderEditor, open, onToggleOpen, onToggleVisible }) {
  if (!block) return null;

  return (
    <section className={`fixed-block-card ${className} ${open ? 'open selected' : ''}`}>
      <FixedBlockCardHeader
        title={title}
        badge={badge}
        visible={block.visible}
        open={open}
        onToggleOpen={onToggleOpen}
        onToggleVisible={onToggleVisible}
      />
      {open && <FixedBlockCardBody block={block} renderEditor={renderEditor} />}
    </section>
  );
}