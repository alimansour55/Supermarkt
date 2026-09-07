import { useMemo } from 'react';
import { fetchTodaysDeals } from '../../services/productApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { TODAYS_DEALS_PATH } from '../../utils/dealSectionShared';
import ProductSection from './ProductSection';

export default function TodaysDealsSection() {
  const { data, loading } = useAsyncData(() => fetchTodaysDeals(8), []);
  const products = data?.products || [];
  const countdownEnd = useMemo(
    () => (data?.countdownEnd instanceof Date && !Number.isNaN(data.countdownEnd.getTime())
      ? data.countdownEnd
      : null),
    [data?.countdownEnd],
  );

  if (!loading && !products.length) return null;

  return (
    <ProductSection
      titleAr="عروض اليوم"
      titleEn="Today's Deals"
      icon="🔥"
      products={products}
      link={TODAYS_DEALS_PATH}
      loading={loading}
      countdownEnd={countdownEnd}
      skeletonCount={4}
    />
  );
}
