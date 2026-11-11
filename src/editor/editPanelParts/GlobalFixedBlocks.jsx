import React from 'react';
import './FixedBlocksSection.css';
import { createFixedBlockDescriptors } from './fixedBlockDescriptors.js';
import { FixedBlockCard } from './FixedBlockCard.jsx';

export function GlobalFixedBlocks(props) {
  const descriptors = createFixedBlockDescriptors(props);
  return (
    <>
      {descriptors.filter((item) => !props.only || props.only.includes(item.key)).map(({ key, ...cardProps }) => (
        <React.Fragment key={key}>
          <FixedBlockCard {...cardProps} compositionRow={props.compositionRow}
            selected={props.selectedId === cardProps.block?.id} />
          {props.selectedId === cardProps.block?.id && props.renderInlineEditor?.(cardProps.block)}
        </React.Fragment>
      ))}
    </>
  );
}
