import { useMemo } from 'react';
import { fetchTodaysDeals } from '../../services/productApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { getEndOfToday } from '../../hooks/useCountdown';
import ProductSection from './ProductSection';

export default function TodaysDealsSection() {
  const { data: products, loading } = useAsyncData(() => fetchTodaysDeals(8), []);
  const countdownEnd = useMemo(() => getEndOfToday(), []);

  return (
    <ProductSection
      titleAr="عروض اليوم"
      titleEn="Today's Deals"
      icon="🔥"
      products={products || []}
      link="/offers"
      loading={loading}
      countdownEnd={countdownEnd}
      skeletonCount={4}
    />
  );
}
