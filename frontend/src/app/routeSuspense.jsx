import { Suspense } from 'react';
import Loader from '../components/ui/Loader';
import { HomePageSkeleton } from '../components/ui/Skeleton';

export function PageLoader() {
  return (
    <div className="container-app flex justify-center py-16">
      <Loader />
    </div>
  );
}

export function HomePageLoader() {
  return <HomePageSkeleton />;
}

export function withSuspense(element, fallback = <PageLoader />) {
  return <Suspense fallback={fallback}>{element}</Suspense>;
}
