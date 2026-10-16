import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plug, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useLocation } from '../../app/router';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import { EmptyState, PageHeader, useToast } from '../components';
import { integrationsApi } from '../integrationsAdminApi';
import AddConnectionPanel from '../components/integrations/AddConnectionPanel';
import ConnectionPanel from '../components/integrations/ConnectionPanel';
import SyncRulesTab from '../components/integrations/SyncRulesTab';
import DeveloperDocsTab from '../components/integrations/DeveloperDocsTab';
import { DOORS, HEALTH, doorMeta, errorText, timeAgo } from '../components/integrations/integrationMeta';

const TABS = [
  { id: 'connections', labelAr: 'الأنظمة المربوطة', labelEn: 'Connections' },
  { id: 'rules', labelAr: 'قواعد المزامنة', labelEn: 'Sync rules' },
  { id: 'developers', labelAr: 'للمبرمجين', labelEn: 'For developers' },
];

export default function IntegrationsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const location = useLocation();

  const [data, setData] = useState(null);
  const [tab, setTab] = useState('connections');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(() => new URLSearchParams(location.search).get('connection'));

  const load = () => integrationsApi.overview()
    .then((res) => setData(res.data.data))
    .catch((err) => toast.error(errorText(err, isAr)));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const upsert = (conn) => setData((d) => ({
    ...d,
    connections: d.connections.some((c) => c.id === conn.id)
      ? d.connections.map((c) => (c.id === conn.id ? conn : c))
      : [conn, ...d.connections],
  }));

  if (!data) return <Loader />;

  const { connections, stats } = data;
  const failing = connections.filter((c) => c.health === 'failing');
  const Chevron = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? 'الأنظمة المربوطة' : 'Connected systems'}
        description={isAr
          ? 'اربط الكاشير أو المخزن أو برنامج الحسابات، فيتحدث المخزون والأسعار والطلبات وحدها بدون رفع ملفات يدوياً.'
          : 'Link your cashier, warehouse or accounting system so stock, prices and orders stay in step on their own — no manual uploads.'}
        action={(
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {isAr ? 'ربط نظام' : 'Connect a system'}
          </Button>
        )}
      />

      <nav className="-mb-px flex gap-6 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 pb-3 pt-1 text-sm transition-colors ${tab === t.id ? 'border-primary-600 font-semibold text-text' : 'border-transparent text-text-muted hover:text-text'}`}
          >
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </nav>

      {tab === 'connections' && (
        <div className="space-y-4">
          {failing.length > 0 && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {isAr
                ? `${failing.length} ربط متوقف بسبب خطأ: ${failing.map((c) => c.name).join('، ')}`
                : `${failing.length} connection(s) failing: ${failing.map((c) => c.name).join(', ')}`}
            </div>
          )}

          {connections.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [isAr ? 'منتجات مخزونها مربوط' : 'Products synced', stats.syncedProducts],
                [isAr ? 'إشعارات في الانتظار' : 'Notifications waiting', stats.pendingWebhooks],
                [isAr ? 'إشعارات فشلت (7 أيام)' : 'Failed notifications (7 days)', stats.failedWebhooks],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
                  <p className="text-xs text-text-muted">{label}</p>
                  <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          )}

          {connections.length === 0 ? (
            <EmptyState
              icon={Plug}
              title={isAr ? 'لا يوجد نظام مربوط بعد' : 'No system connected yet'}
              description={isAr
                ? 'أي نظام تقريباً يمكن ربطه بإحدى هذه الطرق — اختر ما يناسبك:'
                : 'Almost any system connects through one of these ways — pick what fits:'}
              action={(
                <div className="space-y-3">
                  <div className="grid max-w-3xl gap-2 text-start sm:grid-cols-2">
                    {DOORS.map(({ id, Icon, labelAr, labelEn, descAr, descEn }) => (
                      <div key={id} className="flex gap-2 rounded-xl border border-border bg-white p-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                        <div>
                          <p className="text-sm font-semibold">{isAr ? labelAr : labelEn}</p>
                          <p className="text-xs text-text-muted">{isAr ? descAr : descEn}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => setAdding(true)}>
                    <Plus className="h-4 w-4" />
                    {isAr ? 'ربط نظام' : 'Connect a system'}
                  </Button>
                </div>
              )}
            />
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => {
                const door = doorMeta(c.door);
                const health = HEALTH[c.health] || HEALTH.waiting;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-4 text-start shadow-sm transition hover:border-primary-300"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                        <door.Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text">{c.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${health.className}`}>{isAr ? health.labelAr : health.labelEn}</span>
                          {c.testMode && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">{isAr ? 'تجربة' : 'Test mode'}</span>}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {c.connector?.name || (isAr ? door.labelAr : door.labelEn)}
                          {' · '}
                          {isAr ? 'آخر مزامنة' : 'Last sync'} {timeAgo(c.lastSyncAt || c.apiKey?.lastUsedAt, isAr)}
                        </span>
                        {c.lastError && <span className="mt-1 block truncate text-xs text-red-700">{c.lastError}</span>}
                      </span>
                      <Chevron className="h-4 w-4 shrink-0 text-text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'rules' && (
        <SyncRulesTab
          settings={data.settings}
          locations={data.locations}
          stats={stats}
          onSaved={(settings) => setData((d) => ({ ...d, settings }))}
          isAr={isAr}
        />
      )}

      {tab === 'developers' && <DeveloperDocsTab isAr={isAr} />}

      <AddConnectionPanel
        open={adding}
        onClose={() => setAdding(false)}
        connectors={data.connectors}
        isAr={isAr}
        onCreated={(conn, { open }) => {
          upsert(conn);
          if (open) setOpenId(conn.id);
        }}
      />

      <ConnectionPanel
        open={Boolean(openId)}
        connectionId={openId}
        onClose={() => { setOpenId(null); load(); }}
        onChanged={upsert}
        onDeleted={(id) => {
          setOpenId(null);
          setData((d) => ({ ...d, connections: d.connections.filter((c) => c.id !== id) }));
        }}
        connectors={data.connectors}
        locations={data.locations}
        agentVersion={data.agentVersion}
        isAr={isAr}
      />
    </div>
  );
}
