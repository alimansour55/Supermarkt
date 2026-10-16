import { useRef, useState } from 'react';
import { Eye, Link2, Save, Upload } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useToast } from '../index';
import { integrationsApi } from '../../integrationsAdminApi';
import Section, { selectClass } from './Section';
import { FILE_FIELDS, errorText } from './integrationMeta';

/**
 * File door: a link we read on a schedule and/or a file uploaded here; the column mapping
 * is chosen once from a preview of the file. The agent door uses the same mapping.
 */
export default function FileSection({ conn, onSaved, onImported, isAr }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [sourceUrl, setSourceUrl] = useState(conn.file.sourceUrl);
  const [interval, setIntervalMinutes] = useState(conn.syncIntervalMinutes);
  const [columns, setColumns] = useState(conn.file.columns || {});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [dryResult, setDryResult] = useState(null);

  const isAgent = conn.door === 'agent';
  const headers = preview?.headers || Object.values(columns).filter(Boolean);

  const save = async (extra = {}) => {
    setBusy('save');
    try {
      const body = isAgent
        ? { file: { columns } }
        : { file: { sourceUrl, columns }, syncIntervalMinutes: interval };
      const res = await integrationsApi.update(conn.id, { ...body, ...extra });
      onSaved(res.data.data);
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      return true;
    } catch (err) {
      toast.error(errorText(err, isAr));
      return false;
    } finally {
      setBusy('');
    }
  };

  const loadPreview = async (picked) => {
    setFile(picked);
    setDryResult(null);
    setBusy('preview');
    try {
      const res = await integrationsApi.previewFile(conn.id, picked);
      const data = res.data.data;
      setPreview(data);
      // Keep what is already mapped when the headers still exist; fill gaps with our guesses.
      setColumns((current) => {
        const next = { ...current };
        for (const f of FILE_FIELDS) {
          if (!next[f.id] || !data.headers.includes(next[f.id])) next[f.id] = data.guessed[f.id] || '';
        }
        return next;
      });
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setBusy('');
    }
  };

  const previewFromLink = async () => {
    if (!(await save())) return;
    setBusy('link');
    try {
      const res = await integrationsApi.test(conn.id, 'file');
      const out = res.data.data;
      if (!out.ok) throw new Error(out.message);
      setPreview(out.file);
      setColumns((current) => {
        const next = { ...current };
        for (const f of FILE_FIELDS) if (!next[f.id]) next[f.id] = out.file.guessed[f.id] || '';
        return next;
      });
      toast.success(out.message);
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setBusy('');
    }
  };

  const runImport = async (dryRun) => {
    if (!file) return;
    if (!columns.code) {
      toast.error(isAr ? 'اختر عمود الباركود' : 'Choose the barcode column');
      return;
    }
    setBusy(dryRun ? 'dry' : 'import');
    try {
      const res = await integrationsApi.importFile(conn.id, file, { dryRun, columns });
      const { log, preview: lines } = res.data.data;
      if (dryRun) setDryResult({ log, lines: lines || [] });
      else {
        setDryResult(null);
        toast.success(isAr ? `تم: ${log.counts.updated} تحديث` : `Done: ${log.counts.updated} updated`);
        await save();
        onImported?.();
      }
    } catch (err) {
      toast.error(errorText(err, isAr));
    } finally {
      setBusy('');
    }
  };

  return (
    <Section
      title={isAgent ? (isAr ? 'أعمدة ملفات التصدير' : 'Export file columns') : (isAr ? 'الملف' : 'The file')}
      hint={isAgent
        ? (isAr ? 'لو البرنامج يرسل ملفات من مجلد: ارفع ملفاً كمثال واختر الأعمدة مرة واحدة.' : 'If the agent sends export files: upload one as a sample and pick the columns once.')
        : (isAr ? 'Excel (.xlsx) أو CSV. ضع رابطاً نقرأه تلقائياً، أو ارفع الملف يدوياً.' : 'Excel (.xlsx) or CSV. Give a link we read automatically, or upload the file.')}
    >
      {!isAgent && (
        <div className="space-y-2">
          <Input
            label={isAr ? 'رابط الملف (اختياري)' : 'File link (optional)'}
            name="sourceUrl"
            dir="ltr"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
          />
          <p className="text-xs text-text-muted">
            {isAr
              ? 'Google Sheets أو Google Drive أو Dropbox — اجعل الملف "أي شخص معه الرابط يمكنه العرض". نقرأه فقط عندما يتغير.'
              : 'Google Sheets, Google Drive or Dropbox — share it as "anyone with the link can view". We only apply it when it changes.'}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Input
                label={isAr ? 'كل (دقيقة)' : 'Every (min)'}
                name="fileInterval"
                type="number"
                min={1}
                max={1440}
                value={interval}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              />
            </div>
            <Button size="sm" variant="outline" onClick={previewFromLink} loading={busy === 'link'} disabled={!sourceUrl}>
              <Link2 className="h-4 w-4" />
              {isAr ? 'اقرأ الرابط الآن' : 'Read the link now'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && loadPreview(e.target.files[0])}
        />
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()} loading={busy === 'preview'}>
          <Upload className="h-4 w-4" />
          {file ? file.name : (isAr ? 'اختر ملفاً' : 'Choose a file')}
        </Button>
        {preview && (
          <span className="text-xs text-text-muted">{isAr ? `${preview.rowCount} سطر` : `${preview.rowCount} row(s)`}</span>
        )}
      </div>

      {(preview || headers.length > 0) && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-text">{isAr ? 'أي عمود فيه ماذا؟' : 'Which column holds what?'}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {FILE_FIELDS.map((f) => (
              <label key={f.id} className="block text-xs">
                <span className="mb-1 block font-semibold text-text-muted">{isAr ? f.labelAr : f.labelEn}{f.required ? ' *' : ''}</span>
                <select
                  className={selectClass}
                  value={columns[f.id] || ''}
                  onChange={(e) => setColumns((c) => ({ ...c, [f.id]: e.target.value }))}
                >
                  <option value="">{isAr ? '— غير موجود —' : '— not in file —'}</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-text-muted">
            {isAr ? 'الأسعار تُطبق فقط لو سمحت لهذا الربط بتغيير الأسعار (بالأعلى).' : 'Prices are only applied if this connection may change prices (above).'}
          </p>
        </div>
      )}

      {preview?.sample?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>{preview.headers.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5 text-start font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {preview.sample.slice(0, 5).map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {preview.headers.map((h, j) => <td key={h} className="whitespace-nowrap px-2 py-1">{row[j]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => save()} loading={busy === 'save'}>
          <Save className="h-4 w-4" />
          {isAr ? 'حفظ' : 'Save'}
        </Button>
        {file && (
          <>
            <Button size="sm" variant="outline" onClick={() => runImport(true)} loading={busy === 'dry'}>
              <Eye className="h-4 w-4" />
              {isAr ? 'جرّب (بدون حفظ)' : 'Try it (no changes)'}
            </Button>
            <Button size="sm" onClick={() => runImport(false)} loading={busy === 'import'}>
              <Upload className="h-4 w-4" />
              {isAr ? 'طبّق الملف الآن' : 'Apply the file now'}
            </Button>
          </>
        )}
      </div>

      {dryResult && (
        <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p className="font-semibold">
            {isAr
              ? `سيتم تحديث ${dryResult.log.counts.updated}، بدون تغيير ${dryResult.log.counts.unchanged}، أكواد غير معروفة ${dryResult.log.counts.unmatched}، أخطاء ${dryResult.log.counts.failed}`
              : `${dryResult.log.counts.updated} would change, ${dryResult.log.counts.unchanged} unchanged, ${dryResult.log.counts.unmatched} unknown codes, ${dryResult.log.counts.failed} errors`}
          </p>
          {dryResult.lines.length > 0 && (
            <ul dir="ltr" className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px]">
              {dryResult.lines.slice(0, 50).map((l, i) => (
                <li key={i}>{l.code}: {l.field === 'prices' ? JSON.stringify(l.before) : (l.before ?? '—')} → {l.field === 'prices' ? JSON.stringify(l.after) : l.after}</li>
              ))}
            </ul>
          )}
          {dryResult.log.problems?.length > 0 && (
            <ul className="text-xs text-red-700">
              {dryResult.log.problems.slice(0, 5).map((p, i) => (
                <li key={i}>{p.code ? `${p.code}: ` : ''}{p.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
