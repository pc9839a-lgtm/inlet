import React from 'react';
import { ScreenOrderListHeader } from './ScreenOrderListHeader.jsx';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';

export function ScreenOrderList(props) {
  return (
    <section className="card block-card screen-order-card">
      <ScreenOrderListHeader />
      <ScreenOrderListItems {...props} />
    </section>
  );
}