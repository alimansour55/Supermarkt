import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useToast } from '../index';
import { adminApi } from '../../adminApi';
import { apiError } from '../../../seller/sellerLabels';

const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-slate-50';

const BANK_FIELDS = [
  ['bankName', 'البنك', 'Bank'],
  ['accountName', 'اسم صاحب الحساب', 'Account holder'],
  ['accountNumber', 'رقم الحساب', 'Account number'],
  ['iban', 'IBAN', 'IBAN'],
  ['walletPhone', 'رقم المحفظة', 'Wallet number'],
];

function profileForm(s) {
  return {
    nameAr: s.nameAr || '',
    nameEn: s.nameEn || '',
    descriptionAr: s.descriptionAr || '',
    descriptionEn: s.descriptionEn || '',
    contactName: s.contactName || '',
    email: s.email || '',
    phone: s.phone || '',
    address: { street: s.address?.street || '', city: s.address?.city || '', governorate: s.address?.governorate || '' },
    legalName: s.legalName || '',
    commercialRegisterNo: s.commercialRegisterNo || '',
    taxId: s.taxId || '',
  };
}

function Field({ label, children, wide }) {
  return (
    <label className={`block text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function ImageSlot({ label, url, onPick, onRemove, busy, isAr, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="mb-1 text-xs font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {url
          ? <img src={url} alt="" className={`${wide ? 'h-16 w-40' : 'h-16 w-16'} rounded-xl border border-border object-cover`} />
          : <span className={`${wide ? 'h-16 w-40' : 'h-16 w-16'} rounded-xl border border-dashed border-border bg-slate-50`} />}
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-primary-50 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <ImagePlus className="h-4 w-4" />{isAr ? 'تغيير' : 'Change'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(f); }} />
        </label>
        {url && <button type="button" disabled={busy} onClick={onRemove} className="p-1 text-red-600" aria-label={isAr ? 'حذف' : 'Remove'}><Trash2 className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

/**
 * Staff edit a seller's store profile. Bank details are editable by super admins only (they
 * decide where money goes); everyone else sees them masked. Every change lands in the history.
 */
export default function SellerProfileEditor({ seller, isAr, isSuperAdmin, onSaved, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState(() => profileForm(seller));
  const [bank, setBank] = useState(null); // null = not editing bank
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setAddr = (k, v) => setForm((f) => ({ ...f, address: { ...f.address, [k]: v } }));

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.updateSeller(seller._id, { ...form, ...(bank ? { bank } : {}) });
      toast.success(isAr ? 'تم حفظ بيانات المتجر' : 'Store details saved');
      onSaved();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

  const media = async (payload) => {
    setMediaBusy(true);
    try {
      await adminApi.updateSellerMedia(seller._id, payload);
      toast.success(isAr ? 'تم تحديث الصورة' : 'Image updated');
      onSaved({ keepEditing: true });
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر رفع الصورة' : 'Upload failed'));
    } finally {
      setMediaBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageSlot label={isAr ? 'الشعار' : 'Logo'} url={seller.logoUrl} busy={mediaBusy} isAr={isAr} onPick={(logo) => media({ logo })} onRemove={() => media({ remove: 'logo' })} />
        <ImageSlot label={isAr ? 'الغلاف' : 'Banner'} url={seller.bannerUrl} busy={mediaBusy} isAr={isAr} onPick={(banner) => media({ banner })} onRemove={() => media({ remove: 'banner' })} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={isAr ? 'اسم المتجر (عربي)' : 'Store name (Arabic)'}><input className={inputCls} value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} /></Field>
        <Field label={isAr ? 'اسم المتجر (إنجليزي)' : 'Store name (English)'}><input dir="ltr" className={inputCls} value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} /></Field>
        <Field label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'} wide><textarea rows={2} className={inputCls} value={form.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} /></Field>
        <Field label={isAr ? 'الوصف (إنجليزي)' : 'Description (English)'} wide><textarea dir="ltr" rows={2} className={inputCls} value={form.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} /></Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">{isAr ? 'التواصل والعنوان' : 'Contact & address'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'المسؤول' : 'Contact person'}><input className={inputCls} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
          <Field label={isAr ? 'الهاتف' : 'Phone'}><input dir="ltr" className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label={isAr ? 'بريد المتجر للتواصل' : 'Store contact email'} wide>
            <input dir="ltr" type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} />
            <span className="mt-1 block text-xs text-text-muted">{isAr ? 'لتغيير البريد الذي يدخل به البائع استخدم تبويب «الدخول».' : 'To change the email a seller signs in with, use the Logins tab.'}</span>
          </Field>
          <Field label={isAr ? 'الشارع' : 'Street'} wide><input className={inputCls} value={form.address.street} onChange={(e) => setAddr('street', e.target.value)} /></Field>
          <Field label={isAr ? 'المدينة' : 'City'}><input className={inputCls} value={form.address.city} onChange={(e) => setAddr('city', e.target.value)} /></Field>
          <Field label={isAr ? 'المحافظة' : 'Governorate'}><input className={inputCls} value={form.address.governorate} onChange={(e) => setAddr('governorate', e.target.value)} /></Field>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">{isAr ? 'البيانات القانونية' : 'Legal details'}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? 'الاسم القانوني' : 'Legal name'} wide><input className={inputCls} value={form.legalName} onChange={(e) => set('legalName', e.target.value)} /></Field>
          <Field label={isAr ? 'السجل التجاري' : 'Commercial register'}><input dir="ltr" className={inputCls} value={form.commercialRegisterNo} onChange={(e) => set('commercialRegisterNo', e.target.value)} /></Field>
          <Field label={isAr ? 'الرقم الضريبي' : 'Tax ID'}><input dir="ltr" className={inputCls} value={form.taxId} onChange={(e) => set('taxId', e.target.value)} /></Field>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold">{isAr ? 'بيانات استلام الأموال' : 'Payout details'}</p>
          {isSuperAdmin && !bank && (
            <button type="button" className="text-xs font-semibold text-primary-700 hover:underline" onClick={() => setBank(Object.fromEntries(BANK_FIELDS.map(([k]) => [k, seller.bank?.[k] || ''])))}>
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          )}
        </div>
        {bank ? (
          <>
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              {isAr ? 'تأكد من البيانات مع البائع بالهاتف قبل الحفظ. سيصل البائع تنبيه بالتغيير.' : 'Confirm these with the seller by phone before saving. The seller is notified of the change.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {BANK_FIELDS.map(([k, ar, en]) => (
                <Field key={k} label={isAr ? ar : en}><input dir="ltr" className={inputCls} value={bank[k]} onChange={(e) => setBank((b) => ({ ...b, [k]: e.target.value }))} /></Field>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-text-muted">
            {BANK_FIELDS.map(([k, ar, en]) => (seller.bank?.[k] ? `${isAr ? ar : en}: ${seller.bank[k]}` : null)).filter(Boolean).join(' · ') || '—'}
            {!isSuperAdmin && <span className="mt-1 block text-xs">{isAr ? 'تعديل بيانات البنك للمدير العام فقط.' : 'Only a super admin can change payout details.'}</span>}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border pt-3">
        <Button size="sm" disabled={busy} onClick={save}>{busy ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
      </div>
    </div>
  );
}
