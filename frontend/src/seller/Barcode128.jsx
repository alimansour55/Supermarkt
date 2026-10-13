/**
 * Code 128 (set B) barcode as an inline SVG — enough for shipment numbers on printed labels,
 * scannable by any courier scanner, with no extra dependency.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const STOP = 106;

export function code128Modules(text) {
  const chars = [...String(text)].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126);
  const codes = [START_B, ...chars.map((c) => c.charCodeAt(0) - 32)];
  const checksum = codes.reduce((sum, code, i) => sum + code * (i === 0 ? 1 : i), 0) % 103;
  return [...codes, checksum, STOP].map((c) => PATTERNS[c]).join('');
}

export default function Barcode128({ value, height = 56, moduleWidth = 2, showText = true, className = '' }) {
  const widths = code128Modules(value).split('').map(Number);
  const quiet = 10;
  const total = widths.reduce((a, b) => a + b, 0) + quiet * 2;
  let x = quiet;
  const bars = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0) bars.push(<rect key={i} x={x} y={0} width={w} height={height} />);
    x += w;
  });
  return (
    <svg
      className={className}
      width={total * moduleWidth}
      height={height + (showText ? 18 : 0)}
      viewBox={`0 0 ${total} ${height + (showText ? 18 / moduleWidth : 0)}`}
      role="img"
      aria-label={value}
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#fff" />
      <g fill="#000">{bars}</g>
      {showText && (
        <text x={total / 2} y={height + 12 / moduleWidth + 2} textAnchor="middle" fontFamily="monospace" fontSize={12 / moduleWidth * 1.1}>{value}</text>
      )}
    </svg>
  );
}
