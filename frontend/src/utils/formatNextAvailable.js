/** Render an ISO timestamp as a short "back at ..." string in the visitor's own locale/timezone. */
export function formatNextAvailable(nextAvailableAt, isAr) {
  if (!nextAvailableAt) return '';
  const date = new Date(nextAvailableAt);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);

  if (sameDay) return isAr ? `اليوم الساعة ${time}` : `today at ${time}`;
  if (isTomorrow) return isAr ? `غداً الساعة ${time}` : `tomorrow at ${time}`;

  const day = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-GB', { weekday: 'long' }).format(date);
  return isAr ? `${day} الساعة ${time}` : `${day} at ${time}`;
}
