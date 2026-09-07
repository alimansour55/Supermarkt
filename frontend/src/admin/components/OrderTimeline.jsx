import OrderFlowSteps from '../../components/order/OrderFlowSteps';

export default function OrderTimeline({ order, isAr }) {
  return <OrderFlowSteps order={order} isAr={isAr} interactive={false} />;
}
