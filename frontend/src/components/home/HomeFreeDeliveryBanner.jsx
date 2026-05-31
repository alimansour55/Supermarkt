import FreeDeliveryProgress from '../cart/FreeDeliveryProgress';

/** Homepage strip — free delivery progress (cart-aware). */
export default function HomeFreeDeliveryBanner() {
  return (
    <section className="container-app -mt-2 pb-2 pt-4">
      <FreeDeliveryProgress showWhenEmpty linkToCart />
    </section>
  );
}
