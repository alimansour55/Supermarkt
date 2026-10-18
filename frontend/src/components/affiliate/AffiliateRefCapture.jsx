import { useEffect } from 'react';
import { useLocation } from '../../app/router';
import { affiliateService } from '../../services/apiServices';
import { isRefCode, markRefSeen, normalizeRefCode, saveAffiliateRef } from '../../utils/affiliateRef';

/** Watches every page for ?ref=CODE and remembers it for checkout. Renders nothing. */
export default function AffiliateRefCapture() {
  const { search } = useLocation();

  useEffect(() => {
    const code = normalizeRefCode(new URLSearchParams(search).get('ref'));
    if (!isRefCode(code) || !markRefSeen(code)) return;
    affiliateService.click(code)
      .then(({ data }) => {
        if (data?.valid) saveAffiliateRef(data.code || code, data.attributionDays);
      })
      // Network hiccup: keep the code anyway — checkout re-checks it on the server.
      .catch(() => saveAffiliateRef(code));
  }, [search]);

  return null;
}
