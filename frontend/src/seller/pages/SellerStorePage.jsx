import { useState } from 'react';
import { useOutletContext } from '../../app/router';
import { FileUp, Send, Trash2 } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { sellerApi } from '../../services/sellerApi';
import { DOCUMENT_STATUS, DOCUMENT_TYPES, FULFILLMENT, apiError, label } from '../sellerLabels';
import StatusBadge from '../StatusBadge';

const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500';

function Field({ label: text, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-800">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function ProfileSection({ seller, isAr, reload }) {
  const toast = useToast();
  const locked = seller.status === 'active';
  const [form, setForm] = useState({
    nameAr: seller.nameAr, nameEn: seller.nameEn,
    descriptionAr: seller.descriptionAr, descriptionEn: seller.descriptionEn,
    contactName: seller.contactName, phone: seller.phone,
    legalName: seller.legalName, commercialRegisterNo: seller.commercialRegisterNo, taxId: seller.taxId,
    street: seller.address?.street || '', city: seller.address?.city || '', governorate: seller.address?.governorate || '',
    handlingDays: String(seller.handlingDays ?? 2), defaultFulfillment: seller.defaultFulfillment,
  });
  const [logo, setLogo] = useState(null);
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const { street, city, governorate, ...rest } = form;
      const fd = new FormData();
      Object.entries(rest).forEach(([k, v]) => fd.append(k, v ?? ''));
      fd.append('address', JSON.stringify({ street, city, governorate }));
      if (logo) fd.append('logo', logo);
      if (banner) fd.append('banner', banner);
      await sellerApi.updateProfile(fd);
      toast.success(isAr ? 'تم حفظ بيانات المتجر' : 'Store profile saved');
      setLogo(null);
      setBanner(null);
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 font-bold">{isAr ? 'واجهة المتجر' : 'Storefront'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? 'اسم المتجر (عربي)' : 'Store name (Arabic)'} hint={locked ? (isAr ? 'تواصل مع الدعم لتغيير الاسم' : 'Contact support to rename') : null}>
          <input className={inputCls} value={form.nameAr} onChange={set('nameAr')} disabled={locked} />
        </Field>
        <Field label={isAr ? 'اسم المتجر (إنجليزي)' : 'Store name (English)'}>
          <input className={inputCls} value={form.nameEn} onChange={set('nameEn')} disabled={locked} dir="ltr" />
        </Field>
        <Field label={isAr ? 'نبذة (عربي)' : 'About (Arabic)'}><textarea rows={3} className={inputCls} value={form.descriptionAr} onChange={set('descriptionAr')} /></Field>
        <Field label={isAr ? 'نبذة (إنجليزي)' : 'About (English)'}><textarea rows={3} className={inputCls} value={form.descriptionEn} onChange={set('descriptionEn')} dir="ltr" /></Field>
        <Field label={isAr ? 'الشعار' : 'Logo'}>
          <div className="flex items-center gap-3">
            {seller.logoUrl && <img src={seller.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200" />}
            <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} className="text-sm" />
          </div>
        </Field>
        <Field label={isAr ? 'صورة الغلاف' : 'Banner'}>
          <div className="flex items-center gap-3">
            {seller.bannerUrl && <img src={seller.bannerUrl} alt="" className="h-12 w-24 rounded-xl object-cover ring-1 ring-slate-200" />}
            <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] || null)} className="text-sm" />
          </div>
        </Field>
      </div>

      <h3 className="mb-3 mt-6 font-bold">{isAr ? 'التواصل والشحن' : 'Contact & shipping'}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={isAr ? 'اسم المسؤول' : 'Contact name'}><input className={inputCls} value={form.contactName} onChange={set('contactName')} /></Field>
        <Field label={isAr ? 'هاتف المتجر' : 'Store phone'}><input className={inputCls} value={form.phone} onChange={set('phone')} dir="ltr" /></Field>
        <Field label={isAr ? 'مدة التجهيز (أيام)' : 'Handling time (days)'}><input type="number" min="0" max="30" className={inputCls} value={form.handlingDays} onChange={set('handlingDays')} /></Field>
        <Field label={isAr ? 'العنوان' : 'Street address'}><input className={inputCls} value={form.street} onChange={set('street')} /></Field>
        <Field label={isAr ? 'المدينة' : 'City'}><input className={inputCls} value={form.city} onChange={set('city')} /></Field>
        <Field label={isAr ? 'المحافظة' : 'Governorate'}><input className={inputCls} value={form.governorate} onChange={set('governorate')} /></Field>
        {(seller.allowedFulfillment || []).length > 1 && (
          <Field label={isAr ? 'طريقة الشحن الافتراضية' : 'Default shipping'}>
            <select className={inputCls} value={form.defaultFulfillment} onChange={set('defaultFulfillment')}>
              {seller.allowedFulfillment.map((m) => <option key={m} value={m}>{label(FULFILLMENT, m, isAr)}</option>)}
            </select>
          </Field>
        )}
      </div>

      <h3 className="mb-3 mt-6 font-bold">{isAr ? 'البيانات القانونية' : 'Legal details'}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={isAr ? 'الاسم القانوني' : 'Legal name'}><input className={inputCls} value={form.legalName} onChange={set('legalName')} disabled={locked} /></Field>
        <Field label={isAr ? 'رقم السجل التجاري' : 'Commercial register no.'}><input className={inputCls} value={form.commercialRegisterNo} onChange={set('commercialRegisterNo')} disabled={locked} dir="ltr" /></Field>
        <Field label={isAr ? 'الرقم الضريبي' : 'Tax ID'}><input className={inputCls} value={form.taxId} onChange={set('taxId')} disabled={locked} dir="ltr" /></Field>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
        </button>
      </div>
    </section>
  );
}

function DocumentsSection({ seller, isAr, reload }) {
  const toast = useToast();
  const [type, setType] = useState('commercial_register');
  const [busy, setBusy] = useState(false);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await sellerApi.uploadDocument(type, file);
      toast.success(isAr ? 'تم رفع المستند' : 'Document uploaded');
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الرفع' : 'Upload failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (docId) => {
    setBusy(true);
    try {
      await sellerApi.deleteDocument(docId);
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحذف' : 'Delete failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-bold">{isAr ? 'المستندات' : 'Documents'}</h2>
      <p className="mb-4 text-sm text-slate-500">{isAr ? 'صور واضحة للسجل التجاري والبطاقة الضريبية وبطاقة الرقم القومي.' : 'Clear photos of your commercial register, tax card and national ID.'}</p>
      {(seller.documents || []).length > 0 && (
        <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {seller.documents.map((d) => (
            <li key={d._id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-indigo-700">
                <img src={d.url} alt="" className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                <span>
                  <span className="block font-semibold">{label(DOCUMENT_TYPES, d.type, isAr)}</span>
                  {d.note && <span className="block text-xs text-slate-500">{d.note}</span>}
                </span>
              </a>
              <div className="flex items-center gap-2">
                <StatusBadge map={DOCUMENT_STATUS} value={d.status} isAr={isAr} />
                {d.status !== 'accepted' && (
                  <button type="button" disabled={busy} onClick={() => remove(d._id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" aria-label={isAr ? 'حذف' : 'Delete'}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-auto`} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.keys(DOCUMENT_TYPES).map((t) => <option key={t} value={t}>{label(DOCUMENT_TYPES, t, isAr)}</option>)}
        </select>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
          <FileUp className="h-4 w-4" />
          {isAr ? 'رفع صورة' : 'Upload image'}
          <input type="file" accept="image/*" hidden onChange={upload} />
        </label>
      </div>
    </section>
  );
}

function BankSection({ seller, isAr, reload }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...{ bankName: '', accountName: '', accountNumber: '', iban: '', walletPhone: '' }, ...(seller.bank || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await sellerApi.updateBank(form);
      toast.success(isAr ? 'تم حفظ بيانات الدفع' : 'Payout details saved');
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 font-bold">{isAr ? 'بيانات استلام الأرباح' : 'Payout details'}</h2>
      <p className="mb-4 text-sm text-slate-500">{isAr ? 'نحوّل أرباحك إلى هذا الحساب.' : 'We transfer your earnings to this account.'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? 'اسم البنك' : 'Bank name'}><input className={inputCls} value={form.bankName} onChange={set('bankName')} /></Field>
        <Field label={isAr ? 'اسم صاحب الحساب' : 'Account holder'}><input className={inputCls} value={form.accountName} onChange={set('accountName')} /></Field>
        <Field label={isAr ? 'رقم الحساب' : 'Account number'}><input className={inputCls} value={form.accountNumber} onChange={set('accountNumber')} dir="ltr" /></Field>
        <Field label="IBAN"><input className={inputCls} value={form.iban} onChange={set('iban')} dir="ltr" /></Field>
        <Field label={isAr ? 'رقم المحفظة (بديل)' : 'Mobile wallet (alternative)'}><input className={inputCls} value={form.walletPhone} onChange={set('walletPhone')} dir="ltr" /></Field>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {isAr ? 'حفظ' : 'Save'}
        </button>
      </div>
    </section>
  );
}

export default function SellerStorePage() {
  const { seller, me, isAr, reload } = useOutletContext();
  const toast = useToast();
  const isOwner = me.user.role === 'seller_owner';
  const [busy, setBusy] = useState(false);

  const resubmit = async () => {
    setBusy(true);
    try {
      await sellerApi.resubmit();
      toast.success(isAr ? 'تم إرسال طلبك للمراجعة' : 'Sent for review');
      reload();
    } catch (err) {
      toast.error(apiError(err, isAr ? 'تعذّر الإرسال' : 'Could not resubmit'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{isAr ? 'بيانات المتجر' : 'Store profile'}</h1>
        {isOwner && ['applied', 'rejected'].includes(seller.status) && (
          <button type="button" disabled={busy} onClick={resubmit} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Send className="h-4 w-4" />
            {seller.status === 'rejected' ? (isAr ? 'إعادة إرسال الطلب' : 'Resubmit application') : (isAr ? 'أرسل الطلب للمراجعة' : 'Send for review')}
          </button>
        )}
      </div>
      <ProfileSection key={seller.updatedAt} seller={seller} isAr={isAr} reload={reload} />
      <DocumentsSection seller={seller} isAr={isAr} reload={reload} />
      {isOwner && <BankSection key={`bank-${seller.updatedAt}`} seller={seller} isAr={isAr} reload={reload} />}
    </div>
  );
}
