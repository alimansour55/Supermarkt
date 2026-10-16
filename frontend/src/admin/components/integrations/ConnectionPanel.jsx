import { useEffect, useState } from 'react';
import { Download, KeyRound, Pause, Play, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { Link } from '../../../app/router';
import AdminSlidePanel from '../AdminSlidePanel';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Loader from '../../../components/ui/Loader';
import { useConfirm, useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import Section, { Toggle, selectClass } from './Section';
import SecretReveal from './SecretReveal';
import ConnectorSection from './ConnectorSection';
import FileSection from './FileSection';
import WebhookSection from './WebhookSection';
import { HEALTH, LOG_STATUS, SCOPES, doorMeta, errorText, timeAgo } from './integrationMeta';

const AGENT_FILES = ['shop-agent.mjs', 'install-windows.ps1', 'config.example.json', 'README.md'];

function RulesSection({ conn, save, isAr }) {
  const [scopes, setScopes] = useState(conn.scopes);
  const [ips, setIps] = useState(conn.allowedIps.join(', '));
  const usesKey = conn.door !== 'connector';

  return (
    <Section
      title={isAr ? 'ماذا يُسمح لهذا الربط أن يغيّر؟' : 'What may this connection change?'}
      hint={isAr ? 'اجعل نظاماً واحداً فقط هو "المسؤول" عن كل معلومة.' : 'Make one system the "boss" of each piece of information.'}
    >
      <Toggle checked={conn.rules.stock} onChange={(v) => save({ rules: { stock: v } })} label={isAr ? 'المخزون' : 'Stock'} hint={isAr ? 'الكميات تأتي من هذا النظام' : 'Quantities come from this system'} />
      <Toggle checked={conn.rules.prices} onChange={(v) => save({ rules: { prices: v } })} label={isAr ? 'أسعار البيع' : 'Selling prices'} hint={isAr ? 'تغيير السعر في الكاشير يغيّره في الموقع' : 'A price change in the cashier changes the website'} />
      <Toggle checked={conn.rules.costPrices} onChange={(v) => save({ rules: { costPrices: v } })} label={isAr ? 'أسعار التكلفة' : 'Cost prices'} hint={isAr ? 'لتقارير الربح' : 'For profit reports'} />

      {usesKey && (
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">{isAr ? 'صلاحيات المفتاح (متقدم)' : 'Key permissions (advanced)'}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => (
              <Toggle
                key={s.id}
                checked={scopes.includes(s.id)}
                onChange={(on) => setScopes((list) => (on ? [...list, s.id] : list.filter((x) => x !== s.id)))}
                label={isAr ? s.labelAr : s.labelEn}
                hint={s.id}
              />
            ))}
          </div>
          <div className="mt-3">
            <Input
              label={isAr ? 'اسمح فقط لعناوين IP هذه (اختياري)' : 'Only allow these IP addresses (optional)'}
              name="ips"
              dir="ltr"
              value={ips}
              onChange={(e) => setIps(e.target.value)}
              placeholder="41.33.1.2, 156.10.0.4"
            />
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => save({ scopes, allowedIps: ips })}>
            <Save className="h-4 w-4" />
            {isAr ? 'حفظ الصلاحيات' : 'Save permissions'}
          </Button>
        </details>
      )}
    </Section>
  );
}

function BranchSection({ conn, locations, save, isAr }) {
  const [rows, setRows] = useState(conn.locationMap);
  const [fallback, setFallback] = useState(conn.defaultLocation || '');

  return (
    <Section
      title={isAr ? 'الفروع' : 'Branches'}
      hint={isAr ? 'اكتب كود كل فرع كما يظهر في النظام الآخر واختر الفرع المقابل هنا.' : 'Enter each branch code as the other system names it, and pick our matching branch.'}
    >
      <label className="block text-xs">
        <span className="mb-1 block font-semibold text-text-muted">{isAr ? 'لو لم يُذكر فرع، اعتبره:' : 'When no branch is given, use:'}</span>
        <select className={selectClass} value={fallback} onChange={(e) => setFallback(e.target.value)}>
          <option value="">{isAr ? 'الفرع الرئيسي' : 'The main branch'}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            dir="ltr"
            className={`${selectClass} max-w-[10rem]`}
            value={row.externalCode}
            placeholder={isAr ? 'كود الفرع' : 'Their code'}
            onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, externalCode: e.target.value } : x)))}
          />
          <span className="text-text-muted">→</span>
          <select className={selectClass} value={row.location} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)))}>
            <option value="">—</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button type="button" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100" aria-label={isAr ? 'حذف' : 'Remove'}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => setRows((r) => [...r, { externalCode: '', location: locations[0]?.id || '' }])}>
          <Plus className="h-4 w-4" />
          {isAr ? 'إضافة فرع' : 'Add a branch'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => save({ locationMap: rows, defaultLocation: fallback || null })}>
          <Save className="h-4 w-4" />
          {isAr ? 'حفظ' : 'Save'}
        </Button>
      </div>
      {locations.length === 0 && (
        <p className="text-xs text-text-muted">
          {isAr
            ? 'لا توجد فروع بعد، فكل الكميات تُحسب للمتجر كله. لو عندك أكثر من فرع أضفها من الإعدادات ← الفروع والمخازن.'
            : 'No branches yet, so all quantities count for the whole store. Have several shops? Add them in Settings → Branches & warehouses.'}
        </p>
      )}
    </Section>
  );
}

function AgentSection({ conn, agentVersion, isAr }) {
  const toast = useToast();
  const download = async (file) => {
    try {
      const res = await integrationsApi.agentFile(file);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };
  const seen = conn.agent?.lastSeenAt;
  const online = seen && Date.now() - new Date(seen).getTime() < 10 * 60 * 1000;

  return (
    <Section
      title={isAr ? 'البرنامج على كمبيوتر المحل' : 'Program on the shop PC'}
      hint={isAr ? 'يقرأ مجلد التصدير أو قاعدة بيانات الكاشير (SQL Server / Access)، ويحفظ الطلبات الأونلاين كملفات للكاشير.' : 'Reads the export folder or the cashier database (SQL Server / Access) and saves online orders as files for the cashier.'}
    >
      <div className={`rounded-xl px-3 py-2 text-sm ${online ? 'bg-green-50 text-green-800' : 'bg-slate-50 text-text-muted'}`}>
        {seen
          ? `${online ? (isAr ? 'متصل' : 'Online') : (isAr ? 'آخر ظهور' : 'Last seen')} ${timeAgo(seen, isAr)} — ${conn.agent.hostname || ''} v${conn.agent.version || '?'}`
          : (isAr ? 'لم يتصل البرنامج بعد' : 'The program has not connected yet')}
        {agentVersion && conn.agent?.version && conn.agent.version !== agentVersion && (
          <span className="ms-2 font-semibold">{isAr ? `(سيتحدث تلقائياً إلى ${agentVersion})` : `(will update itself to ${agentVersion})`}</span>
        )}
      </div>
      <ol className="list-decimal space-y-1 ps-5 text-sm text-text">
        <li>{isAr ? 'ثبّت Node.js (نسخة LTS) من nodejs.org على كمبيوتر المحل.' : 'Install Node.js (LTS) from nodejs.org on the shop PC.'}</li>
        <li>{isAr ? 'نزّل الملفات الأربعة في مجلد واحد، مثلاً C:\\MarketPlusAgent.' : 'Download the four files into one folder, e.g. C:\\MarketPlusAgent.'}</li>
        <li>{isAr ? 'شغّل PowerShell كمسؤول ونفّذ: powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1' : 'Run PowerShell as administrator: powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1'}</li>
        <li>{isAr ? 'سيفتح ملف الإعدادات: الصق المفتاح وحدد المجلد أو قاعدة البيانات، ثم شغّل الأمر مرة ثانية.' : 'It opens the settings file: paste the key, set the folder or database, then run the command again.'}</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        {AGENT_FILES.map((f) => (
          <Button key={f} size="sm" variant="outline" onClick={() => download(f)}>
            <Download className="h-4 w-4" />
            <span dir="ltr">{f}</span>
          </Button>
        ))}
      </div>
    </Section>
  );
}

function UnmatchedSection({ conn, onSaved, isAr }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!conn.unmatchedCodes.length) return null;
  const recheck = async () => {
    setBusy(true);
    try {
      const res = await integrationsApi.recheckUnmatched(conn.id);
      toast.success(isAr ? `متبقي ${res.data.data.remaining}` : `${res.data.data.remaining} still unknown`);
      const fresh = await integrationsApi.get(conn.id);
      onSaved(fresh.data.data);
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      title={isAr ? `أكواد غير موجودة في المتجر (${conn.unmatchedCodes.length})` : `Codes not found in the store (${conn.unmatchedCodes.length})`}
      hint={isAr ? 'أضف الباركود أو الكود لهذه المنتجات في صفحة المنتج، أو أضف المنتج للمتجر، ثم اضغط "افحص مرة أخرى".' : 'Add the barcode/SKU to these products (or add the product), then press "Check again".'}
      action={(
        <Button size="sm" variant="outline" onClick={recheck} loading={busy}>
          <RefreshCw className="h-4 w-4" />
          {isAr ? 'افحص مرة أخرى' : 'Check again'}
        </Button>
      )}
    >
      <div dir="ltr" className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {conn.unmatchedCodes.map((u) => (
          <Link key={u.code} to={`/admin/products?q=${encodeURIComponent(u.code)}`} className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-900 hover:bg-amber-100" title={timeAgo(u.seenAt, isAr)}>
            {u.code}{u.count > 1 ? ` ×${u.count}` : ''}
          </Link>
        ))}
      </div>
    </Section>
  );
}

function ActivitySection({ conn, refreshKey, isAr }) {
  const [logs, setLogs] = useState(null);
  const load = () => integrationsApi.logs(conn.id, { limit: 50 }).then((res) => setLogs(res.data.data || [])).catch(() => setLogs([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [refreshKey]);
  return (
    <Section
      title={isAr ? 'سجل المزامنة' : 'Sync log'}
      hint={isAr ? 'آخر 30 يوماً' : 'Last 30 days'}
      action={(
        <button type="button" onClick={load} className="rounded-lg p-1.5 text-text-muted hover:bg-slate-100" aria-label={isAr ? 'تحديث' : 'Refresh'}>
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
    >
      {!logs ? <Loader /> : logs.length === 0 ? (
        <p className="text-xs text-text-muted">{isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {logs.map((l) => (
            <li key={l._id} className="rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${LOG_STATUS[l.status]}`}>{l.status}</span>
                <span className="font-semibold">{l.kind}</span>
                {l.dryRun && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">{isAr ? 'تجربة' : 'dry run'}</span>}
                <span className="text-text-muted">{timeAgo(l.createdAt, isAr)}</span>
                {l.counts?.received > 0 && (
                  <span className="text-text-muted">
                    {isAr
                      ? `${l.counts.updated} تحديث · ${l.counts.unchanged} بدون تغيير · ${l.counts.unmatched} غير معروف · ${l.counts.failed} خطأ`
                      : `${l.counts.updated} updated · ${l.counts.unchanged} same · ${l.counts.unmatched} unknown · ${l.counts.failed} errors`}
                  </span>
                )}
              </div>
              {l.message && <p className="mt-0.5 text-text-muted">{l.message}</p>}
              {l.problems?.length > 0 && (
                <p className="mt-0.5 text-red-700">{l.problems.slice(0, 3).map((p) => `${p.code ? `${p.code}: ` : ''}${p.message}`).join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Everything about one connection, in the order an owner sets it up. */
export default function ConnectionPanel({ connectionId, open, onClose, onChanged, onDeleted, connectors, locations, agentVersion, isAr }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [conn, setConn] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open || !connectionId) return;
    setConn(null);
    setNewKey('');
    integrationsApi.get(connectionId)
      .then((res) => setConn(res.data.data))
      .catch((err) => toast.error(errorText(err, isAr)));
  }, [open, connectionId]);

  const apply = (fresh) => {
    setConn(fresh);
    onChanged(fresh);
  };

  const save = async (patch) => {
    try {
      const res = await integrationsApi.update(conn.id, patch);
      apply(res.data.data);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  const rotateKey = async () => {
    const ok = await confirm({
      title: isAr ? 'مفتاح جديد؟' : 'Replace the key?',
      message: isAr ? 'المفتاح الحالي سيتوقف فوراً. ستحتاج لوضع المفتاح الجديد في النظام الآخر.' : 'The current key stops working at once. You will need to put the new key in the other system.',
      confirmLabel: isAr ? 'استبدال المفتاح' : 'Replace key',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await integrationsApi.rotateKey(conn.id);
      setNewKey(res.data.data.apiKey);
      apply(res.data.data.connection);
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  const runNow = async () => {
    setBusy('run');
    try {
      const res = await integrationsApi.run(conn.id);
      const log = res.data.data;
      if (log.skipped) toast.success(isAr ? 'الملف لم يتغير' : 'File unchanged — nothing to do');
      else if (log.status === 'error') toast.error(log.message || (isAr ? 'فشلت المزامنة' : 'Sync failed'));
      else toast.success(isAr ? `تم: ${log.counts.updated} تحديث` : `Done: ${log.counts.updated} updated`);
      const fresh = await integrationsApi.get(conn.id);
      apply(fresh.data.data);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: isAr ? `حذف "${conn.name}"؟` : `Delete "${conn.name}"?`,
      message: isAr
        ? 'سيتوقف المفتاح، ويُحذف السجل. المنتجات تحتفظ بآخر كمية وصلت ويمكنك تعديلها يدوياً.'
        : 'The key stops working and its log is removed. Products keep their last stock and become editable by hand again.',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await integrationsApi.remove(conn.id);
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
      onDeleted(conn.id);
    } catch (err) {
      toast.error(errorText(err, isAr));
    }
  };

  const door = conn ? doorMeta(conn.door) : null;
  const health = conn ? HEALTH[conn.health] : null;
  const pulls = conn && (conn.door === 'connector' || (conn.door === 'file' && conn.file.sourceUrl));
  const showWebhook = conn && ['webhook', 'api', 'agent'].includes(conn.door);

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      isAr={isAr}
      width="max-w-3xl"
      title={conn?.name || (isAr ? 'الربط' : 'Connection')}
      subtitle={door ? (isAr ? door.labelAr : door.labelEn) : ''}
    >
      {!conn ? <Loader /> : (
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${health.className}`}>{isAr ? health.labelAr : health.labelEn}</span>
              {conn.testMode && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">{isAr ? 'وضع التجربة' : 'Test mode'}</span>}
              <span className="text-xs text-text-muted">{isAr ? 'آخر مزامنة:' : 'Last sync:'} {timeAgo(conn.lastSyncAt, isAr)}</span>
            </div>
            {conn.lastError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{conn.lastError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => save({ status: conn.status === 'active' ? 'paused' : 'active' })}>
                {conn.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {conn.status === 'active' ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'تشغيل' : 'Resume')}
              </Button>
              {pulls && (
                <Button size="sm" onClick={runNow} loading={busy === 'run'} disabled={conn.status !== 'active'}>
                  <RefreshCw className="h-4 w-4" />
                  {isAr ? 'زامن الآن' : 'Sync now'}
                </Button>
              )}
            </div>
            <Toggle
              checked={conn.testMode}
              onChange={(v) => save({ testMode: v })}
              label={isAr ? 'وضع التجربة' : 'Test mode'}
              hint={isAr ? 'كل شيء يُفحص ويُسجل، لكن لا يتغير أي مخزون أو سعر ولا تُرسل إشعارات.' : 'Everything is checked and logged, but no stock or price changes and no notifications go out.'}
            />
          </section>

          {conn.door !== 'connector' && (
            <Section
              title={isAr ? 'مفتاح الربط' : 'API key'}
              hint={isAr ? 'يوضع في النظام الآخر أو في برنامج المحل.' : 'Goes into the other system or the shop program.'}
              action={(
                <Button size="sm" variant="ghost" onClick={rotateKey}>
                  <KeyRound className="h-4 w-4" />
                  {isAr ? 'مفتاح جديد' : 'New key'}
                </Button>
              )}
            >
              <p className="text-sm">
                <code dir="ltr" className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{conn.apiKey?.hint || '—'}</code>
                <span className="ms-2 text-xs text-text-muted">{isAr ? 'آخر استخدام:' : 'Last used:'} {timeAgo(conn.apiKey?.lastUsedAt, isAr)}</span>
              </p>
              {newKey && <SecretReveal isAr={isAr} apiKey={newKey} onDone={() => setNewKey('')} />}
            </Section>
          )}

          {conn.door === 'connector' && <ConnectorSection conn={conn} connectors={connectors} onSaved={apply} isAr={isAr} />}
          {conn.door === 'agent' && <AgentSection conn={conn} agentVersion={agentVersion} isAr={isAr} />}
          {['file', 'agent'].includes(conn.door) && (
            <FileSection conn={conn} onSaved={apply} onImported={() => setRefreshKey((k) => k + 1)} isAr={isAr} />
          )}
          {conn.door !== 'webhook' && <RulesSection conn={conn} save={save} isAr={isAr} />}
          {conn.door !== 'webhook' && <BranchSection conn={conn} locations={locations} save={save} isAr={isAr} />}
          {showWebhook && <WebhookSection conn={conn} onSaved={apply} isAr={isAr} />}
          <UnmatchedSection conn={conn} onSaved={apply} isAr={isAr} />
          <ActivitySection conn={conn} refreshKey={refreshKey} isAr={isAr} />

          <div className="flex justify-end">
            <Button size="sm" variant="danger" onClick={remove}>
              <Trash2 className="h-4 w-4" />
              {isAr ? 'حذف هذا الربط' : 'Delete this connection'}
            </Button>
          </div>
        </div>
      )}
    </AdminSlidePanel>
  );
}
