/**
 * Customer-friendly order numbers: YYMMDD + 4 digits (e.g. 2506018251).
 * Legacy MP-YYYYMMDD-XXXX orders remain valid in the database.
 */
export const generateOrderNumber = () => {
  const d = new Date();
  const ymd = [
    String(d.getFullYear()).slice(-2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${ymd}${suffix}`;
};
