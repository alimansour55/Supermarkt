import { ExternalLink, RefreshCw } from 'lucide-react';
import { getGoogleMapsSetupSteps } from '../../config/googleMaps';
import Button from '../ui/Button';

export default function GoogleMapsConfigError({
  isAr = false,
  className = 'h-72',
  onRetry,
}) {
  const copy = getGoogleMapsSetupSteps(isAr);

  return (
    <div
      className={`overflow-auto rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 ${className}`}
      dir={isAr ? 'rtl' : 'ltr'}
      role="alert"
    >
      <p className="font-bold text-amber-900">{copy.title}</p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/90">{copy.intro}</p>
      <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-xs leading-relaxed">
        {copy.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry && (
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            {copy.retry}
          </Button>
        )}
        <a
          href="https://console.cloud.google.com/google/maps-apis/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
        >
          {copy.consoleLink}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
