import { useState, useEffect } from 'react';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Returns time left until `endDate` (updates every second). */
export function useCountdown(endDate) {
  const [left, setLeft] = useState(() => calcLeft(endDate));

  useEffect(() => {
    const tick = () => setLeft(calcLeft(endDate));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return left;
}

function calcLeft(endDate) {
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  const diff = Math.max(0, end.getTime() - Date.now());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return {
    total: diff,
    hours,
    minutes,
    seconds,
    label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    expired: diff <= 0,
  };
}

/** End of current local day (for “today’s deals”). */
export function getEndOfToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end;
}
