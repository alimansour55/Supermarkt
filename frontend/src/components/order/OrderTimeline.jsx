import OrderFlowSteps from './OrderFlowSteps';

/** Customer-facing order progress — same steps as admin */
export default function OrderTimeline({ order, isAr }) {
  return <OrderFlowSteps order={order} isAr={isAr} interactive={false} />;
}
