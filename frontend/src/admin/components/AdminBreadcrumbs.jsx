import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function AdminBreadcrumbs({ items, className = '' }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={['flex flex-wrap items-center gap-1 text-sm', className].join(' ')}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted rtl:rotate-180" aria-hidden />
            )}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="font-medium text-text-muted transition-colors hover:text-primary-600"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? 'font-medium text-text' : 'text-text-muted'}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
