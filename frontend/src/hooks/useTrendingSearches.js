import { useEffect, useState } from 'react';
import { fetchTrendingSearches, getCachedTrendingSearches, markTrendingSeen } from '../services/searchApi';

/**
 * Store-wide trending chips (pins → automatic trends → best-sellers, decided by the server).
 * Pass `visible` while the chips are actually on screen so the impression is counted.
 */
export default function useTrendingSearches({ visible = false } = {}) {
  const [chips, setChips] = useState(getCachedTrendingSearches);

  useEffect(() => {
    let active = true;
    fetchTrendingSearches().then((next) => { if (active) setChips(next); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (visible && chips.length) markTrendingSeen();
  }, [visible, chips.length]);

  return chips;
}
