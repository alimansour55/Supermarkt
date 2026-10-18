import { useEffect, useState } from 'react';
import { affiliateService } from '../services/apiServices';

// One request per page load, shared by every menu that asks.
let cached = null;
let pending = null;

/** Is "Share & earn" switched on? False until known, so menus never flash a dead link. */
export function useAffiliateProgramEnabled() {
  const [enabled, setEnabled] = useState(cached === true);

  useEffect(() => {
    if (cached !== null) return undefined;
    let alive = true;
    pending ||= affiliateService.program()
      .then(({ data }) => { cached = data?.data?.enabled === true; return cached; })
      .catch(() => { pending = null; return false; });
    pending.then((value) => { if (alive) setEnabled(value); });
    return () => { alive = false; };
  }, []);

  return enabled;
}
