import { CopyButton } from '../index';
import { openApiBase } from './integrationMeta';
import api from '../../../services/api';

const ENDPOINTS = [
  ['GET', '/ping', '—', 'Check the key; returns the connection name and permissions'],
  ['GET', '/locations', 'locations:read', 'Store branches and the codes mapped to them'],
  ['PUT', '/stock', 'stock:write', 'Report quantities: { items: [{ barcode | sku | code, quantity, location? }] }'],
  ['POST', '/stock/adjustments', 'stock:write', 'Movements: { reference, items: [{ code, change }] } — applied once per reference'],
  ['PUT', '/prices', 'prices:write', '{ items: [{ code, price?, oldPrice?, costPrice? }] }'],
  ['POST', '/files', 'stock:write', 'Upload a CSV/XLSX export (multipart "file" or raw body)'],
  ['GET', '/products', 'products:read', '?updatedSince=&page=&limit= or ?code='],
  ['GET', '/orders', 'orders:read', '?cursor=&since=&status=&unacknowledged=true&limit='],
  ['GET', '/orders/{id|number}', 'orders:read', 'One order'],
  ['POST', '/orders/{id|number}/acknowledge', 'orders:write', '{ externalReference? } — "we took these items out of our stock"'],
];

function Code({ children }) {
  return (
    <div className="relative">
      <pre dir="ltr" className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{children}</pre>
      <div className="absolute end-2 top-2"><CopyButton value={children} className="bg-white/90" /></div>
    </div>
  );
}

/** Everything a developer at another company needs to connect without our help. */
export default function DeveloperDocsTab({ isAr }) {
  const base = openApiBase(api.defaults.baseURL);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <p className="text-sm text-text-muted">
          {isAr
            ? 'أرسل هذه الصفحة للمبرمج أو للشركة صاحبة نظام الكاشير. كل ما يحتاجه: هذا العنوان ومفتاح ربط من تبويب "الأنظمة المربوطة". فعّل "وضع التجربة" على الربط أثناء التطوير.'
            : 'Send this page to the developer or the company behind your cashier system. All they need is this address and a key from the "Connections" tab. Turn on "Test mode" on the connection while they build.'}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-slate-50 px-3 py-2">
          <code dir="ltr" className="min-w-0 flex-1 break-all font-mono text-sm">{base}</code>
          <CopyButton value={base} isAr={isAr} />
        </div>
      </div>

      <div dir="ltr" className="space-y-4 rounded-2xl border border-border bg-white p-4 text-start shadow-sm">
        <h3 className="font-bold">Authentication</h3>
        <p className="text-sm text-text-muted">Send the connection key on every call. Each key only opens the permissions ticked on its connection. 600 calls/minute, 5,000 items per call.</p>
        <Code>{'Authorization: Bearer mpk_xxxxxxxxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}</Code>

        <h3 className="font-bold">Endpoints</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-start">
              <tr>
                <th className="px-2 py-1.5 text-start">Method</th>
                <th className="px-2 py-1.5 text-start">Path</th>
                <th className="px-2 py-1.5 text-start">Permission</th>
                <th className="px-2 py-1.5 text-start">What it does</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map(([m, p, s, d]) => (
                <tr key={`${m}${p}`} className="border-t border-border align-top">
                  <td className="px-2 py-1.5 font-mono font-semibold">{m}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono">{p}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-text-muted">{s}</td>
                  <td className="px-2 py-1.5">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="font-bold">Report stock</h3>
        <Code>{`curl -X PUT ${base}/stock \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -H "Idempotency-Key: stock-2026-10-16T10:00" \\
  -d '{"items":[{"barcode":"6221234567890","quantity":24},{"sku":"RICE-5KG","quantity":7,"location":"BR2"}]}'`}</Code>
        <p className="text-sm text-text-muted">
          Products are matched by barcode or SKU (product or variant), ignoring spaces and case; leading zeros lost in Excel still match.
          Unknown codes come back in <code>unmatched</code>. Add <code>?dryRun=true</code> to see the changes without saving.
          Website stock = your stock at branches selling online − safety buffer − online orders on hold.
        </p>

        <h3 className="font-bold">Read new online orders and confirm them</h3>
        <Code>{`curl "${base}/orders?unacknowledged=true&limit=50" -H "Authorization: Bearer $KEY"
# → { data: [ { id, number, status, items: [{ barcode, sku, quantity, unitPrice, fulfilledBy }], … } ], nextCursor, hasMore }

curl -X POST ${base}/orders/MP-10023/acknowledge \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"externalReference":"POS-INV-7781"}'`}</Code>

        <h3 className="font-bold">Webhooks</h3>
        <p className="text-sm text-text-muted">
          Events: order.created, order.paid, order.status_changed, order.cancelled, order.return_approved.
          Answer 2xx within 10 s; failures are retried after 1 m, 5 m, 30 m, 2 h, 6 h, 12 h, 24 h.
          Use <code>X-MarketPlus-Event-Id</code> to ignore repeats. Verify every request:
        </p>
        <Code>{`const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(req.headers['x-marketplus-timestamp'] + '.' + rawBody)
  .digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-marketplus-signature']))
  && Math.abs(Date.now() / 1000 - Number(req.headers['x-marketplus-timestamp'])) < 300;`}</Code>

        <h3 className="font-bold">Errors</h3>
        <p className="text-sm text-text-muted">
          400 bad request (message says why) · 401 wrong/replaced key · 403 paused, IP not allowed or missing permission ·
          404 not found · 429 too many requests · 5xx retry later with the same Idempotency-Key.
          Problems with single items never fail the whole call — they are listed in <code>failed</code> and <code>unmatched</code>.
        </p>
      </div>
    </div>
  );
}
