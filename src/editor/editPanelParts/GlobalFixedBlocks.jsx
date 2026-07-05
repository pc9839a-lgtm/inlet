import React from 'react';
import { createFixedBlockDescriptors } from './fixedBlockDescriptors.js';
import { FixedBlockCard } from './FixedBlockCard.jsx';

export function GlobalFixedBlocks(props) {
  const descriptors = createFixedBlockDescriptors(props);

  return (
    <>
      {descriptors.map(({ key, ...cardProps }) => (
        <FixedBlockCard key={key} {...cardProps} />
      ))}
    </>
  );
}
