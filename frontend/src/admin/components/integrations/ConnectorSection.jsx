import { useState } from 'react';
import { ExternalLink, PlugZap, Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import Section, { selectClass } from './Section';
import { errorText } from './integrationMeta';

/** Ready-made connector: choose the system, enter its login, test with a dry run. */
export default function ConnectorSection({ conn, connectors, onSaved, isAr }) {
  const toast = useToast();
  const [key, setKey] = useState(conn.connector.key);
  const [config, setConfig] = useState(conn.connector.config || {});
  const [interval, setIntervalMinutes] = useState(conn.syncIntervalMinutes);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const connector = connectors.find((c) => c.key === key);

  const save = async () => {
    setSaving(true);
    try {
      const res = await integrationsApi.update(conn.id, { connector: { key, config }, syncIntervalMinutes: interval });
      onSaved(res.data.data);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      return true;
    } catch (err) {
      toast.error(errorText(err, isAr));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!(await save())) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await integrationsApi.test(conn.id, 'connector');
      setResult(res.data.data);
    } catch (err) {
      setResult({ ok: false, message: errorText(err, isAr) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Section
      title={isAr ? 'بيانات الدخول للنظام' : 'System login'}
      hint={isAr ? 'تُحفظ مشفرة. نسحب المخزون والأسعار كل فترة تلقائياً.' : 'Stored encrypted. We pull stock and prices on a schedule.'}
    >
      <select className={selectClass} value={key} onChange={(e) => { setKey(e.target.value); setConfig({}); }}>
        <option value="">{isAr ? '— اختر النظام —' : '— choose the system —'}</option>
        {connectors.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>

      {connector && (
        <>
          {connector.docsUrl && (
            <a href={connector.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
              {isAr ? 'أين أجد هذه البيانات؟' : 'Where do I find these?'}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {connector.fields.map((f) => (
              <div key={f.key}>
                <Input
                  label={`${f.label}${f.required ? ' *' : ''}`}
                  name={`cfg-${f.key}`}
                  type={f.type === 'password' ? 'password' : 'text'}
                  dir="ltr"
                  autoComplete="off"
                  value={config[f.key] ?? ''}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.type === 'password' && config[f.key] ? '••••••••' : ''}
                />
                {f.help && <p className="mt-1 text-xs text-text-muted">{f.help}</p>}
              </div>
            ))}
          </div>
          <div className="max-w-xs">
            <Input
              label={isAr ? 'كل كم دقيقة نسحب البيانات؟' : 'Pull every (minutes)'}
              name="interval"
              type="number"
              min={1}
              max={1440}
              value={interval}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={save} loading={saving}>
              <Save className="h-4 w-4" />
              {isAr ? 'حفظ' : 'Save'}
            </Button>
            <Button size="sm" onClick={test} loading={testing}>
              <PlugZap className="h-4 w-4" />
              {isAr ? 'اختبار (بدون تغيير أي شيء)' : 'Test (changes nothing)'}
            </Button>
          </div>
        </>
      )}

      {result && (
        <div className={`rounded-xl border p-3 text-sm ${result.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <p className="font-semibold">{result.message}</p>
          {result.preview && (
            <ul className="mt-2 space-y-0.5 text-xs">
              <li>{isAr ? `وصل ${result.preview.received} سطر` : `${result.preview.received} line(s) received`}</li>
              <li>{isAr ? `سيتم تحديث ${result.preview.wouldUpdate}` : `${result.preview.wouldUpdate} would be updated`}</li>
              <li>{isAr ? `${result.preview.unmatchedCount} كود غير موجود في المتجر` : `${result.preview.unmatchedCount} code(s) not found in the store`}</li>
              {result.preview.unmatched.length > 0 && (
                <li dir="ltr" className="truncate font-mono text-[11px] text-text-muted">{result.preview.unmatched.slice(0, 15).join(', ')}</li>
              )}
            </ul>
          )}
          {result.locations?.length > 0 && (
            <p className="mt-2 text-xs">
              {isAr ? 'الفروع في النظام (اربطها بالأسفل): ' : 'Branches in that system (map them below): '}
              <span dir="ltr" className="font-mono">{result.locations.map((l) => `${l.name} = ${l.code}`).join(' · ')}</span>
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
