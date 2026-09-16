import React from 'react';
import './ScreenOrder.css';
import { ScreenOrderListHeader } from './ScreenOrderListHeader.jsx';
import { ScreenOrderListItems } from './ScreenOrderListItems.jsx';

export function ScreenOrderList(props) {
  return (
    <section className="screen-order-v2-card">
      <ScreenOrderListHeader />
      <ScreenOrderListItems {...props} />
    </section>
  );
}
