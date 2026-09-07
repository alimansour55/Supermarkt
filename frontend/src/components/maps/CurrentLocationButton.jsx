import { LocateFixed } from 'lucide-react';
import Button from '../ui/Button';

export default function CurrentLocationButton({
  isAr = false,
  loading = false,
  statusText = '',
  onClick,
  className = '',
}) {
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        className={`w-full justify-center border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 ${className}`}
        loading={loading}
        onClick={onClick}
      >
        <LocateFixed className="h-4 w-4 shrink-0" aria-hidden />
        {isAr ? 'استخدم موقعي الحالي' : 'Use my current location'}
      </Button>
      {loading && statusText && (
        <p className="text-center text-xs text-primary-700">{statusText}</p>
      )}
    </div>
  );
}
