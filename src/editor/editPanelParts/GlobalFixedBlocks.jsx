import React from 'react';
import './FixedBlocksSection.css';
import { createFixedBlockDescriptors } from './fixedBlockDescriptors.js';
import { FixedBlockCard } from './FixedBlockCard.jsx';

export function GlobalFixedBlocks({ inlineEditor = true, ...props }) {
  const descriptors = createFixedBlockDescriptors(props);

  return (
    <>
      {descriptors.map(({ key, ...cardProps }) => (
        <FixedBlockCard key={key} {...cardProps} inlineEditor={inlineEditor} />
      ))}
    </>
  );
}
