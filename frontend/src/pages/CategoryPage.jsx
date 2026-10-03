import { useEffect } from 'react';
import { useNavigate, useParams } from '../app/router';
import { fetchCategorySlugPath } from '../services/productApi';
import { buildCategoryPath } from '../utils/categoryHelpers';
import { CategoryGridSkeleton } from '../components/ui/Skeleton';

/** Legacy /categories/:slug → /category/... redirect with full path */
export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategorySlugPath(slug)
      .then(({ slugPath }) => {
        if (!slugPath) {
          navigate('/categories', { replace: true });
          return;
        }
        navigate(buildCategoryPath(slugPath), { replace: true });
      })
      .catch(() => navigate('/categories', { replace: true }));
  }, [slug, navigate]);

  return (
    <div className="container-app py-8">
      <CategoryGridSkeleton count={6} />
    </div>
  );
}
