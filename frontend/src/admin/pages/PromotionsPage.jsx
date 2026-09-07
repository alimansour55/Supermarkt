import { useEffect, useState } from 'react';
import { Flame, Layers, Package, Plus, Tag } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { useConfirm, useToast } from '../components';
import AdminSlidePanel from '../components/AdminSlidePanel';
import PromotionEditorPanel from '../components/PromotionEditorPanel';
import SingleProductOfferPanel from '../components/SingleProductOfferPanel';
import ProductOffersCatalog from '../components/ProductOffersCatalog';
import PromotionCampaignsList from '../components/promotions/PromotionCampaignsList';
import {
  defaultPromotionForm,
  defaultSingleProductOfferForm,
  formToPromotionPayload,
  promotionToForm,
} from '../utils/promotionUtils';

export default function PromotionsPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState('catalog');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [stats, setStats] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [singlePanelOpen, setSinglePanelOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [panelSeed, setPanelSeed] = useState(defaultPromotionForm());
  const [panelSubtitle, setPanelSubtitle] = useState('');
  const [singlePanelSeed, setSinglePanelSeed] = useState(defaultSingleProductOfferForm());
  const [saving, setSaving] = useState(false);
  const [singleSaving, setSingleSaving] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getPromotions(params),
    initialFilters: { status: '', type: '', schedule: '' },
  });

  const reloadStats = () => {
    adminApi.getPromotionStats().then(({ data }) => setStats(data.data)).catch(() => {});
  };

  useEffect(() => {
    adminApi.getCategories({ flat: 'true' }).then(({ data }) => setCategories(data.data || data || [])).catch(() => {});
    adminApi.getBrands({ limit: 200 }).then(({ data }) => setBrands(data.data || data || [])).catch(() => {});
    reloadStats();
  }, []);

  useEffect(() => {
    if (tab === 'campaigns') reloadStats();
  }, [list.data, tab]);

  const runBulk = async (action, title) => {
    const ok = await confirm({
      title,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      variant: action === 'delete' ? 'danger' : 'primary',
    });
    if (!ok) return;
    await adminApi.bulkPromotions(list.selectedIds, action);
    list.clearSelection();
    list.reload();
    reloadStats();
    toast.success(isAr ? 'تم' : 'Done');
  };

  const openCreate = () => {
    setEditId(null);
    setPanelSeed(defaultPromotionForm());
    setPanelSubtitle('');
    setSinglePanelOpen(false);
    setPanelOpen(true);
    setTab('campaigns');
  };

  const openSingleProductOffer = () => {
    setSinglePanelSeed(defaultSingleProductOfferForm());
    setPanelOpen(false);
    setSinglePanelOpen(true);
    setTab('campaigns');
  };

  const closeSinglePanel = () => {
    setSinglePanelOpen(false);
    setSinglePanelSeed(defaultSingleProductOfferForm());
  };

  const handleSingleSubmit = async (e, formData) => {
    e.preventDefault();
    if (!formData.productIds?.length) {
      toast.error(isAr ? 'اختر منتجاً' : 'Select a product');
      return;
    }
    setSingleSaving(true);
    try {
      const payload = formToPromotionPayload({
        ...formData,
        nameEn: formData.nameEn || formData.nameAr,
        targetMode: 'products',
        productIds: [String(formData.productIds[0])],
      });
      await adminApi.createPromotion(payload);
      closeSinglePanel();
      list.reload();
      reloadStats();
      toast.success(isAr ? 'تم تطبيق العرض على المنتج' : 'Offer applied to product');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSingleSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditId(row._id);
    setPanelSeed(promotionToForm(row));
    setPanelSubtitle(isAr ? row.nameAr : row.nameEn);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditId(null);
    setPanelSeed(defaultPromotionForm());
    setPanelSubtitle('');
  };

  const handleSubmit = async (e, formData) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = formToPromotionPayload(formData);
      if (editId) await adminApi.updatePromotion(editId, payload);
      else await adminApi.createPromotion(payload);
      closePanel();
      list.reload();
      reloadStats();
      toast.success(isAr ? 'تم حفظ الحملة' : 'Campaign saved');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleRow = async (row, e) => {
    e?.stopPropagation?.();
    const next = row.status !== 'active';
    try {
      await adminApi.togglePromotion(row._id, { isActive: next });
      list.reload();
      reloadStats();
      toast.success(next ? (isAr ? 'تم التفعيل' : 'Activated') : (isAr ? 'تم الإيقاف' : 'Paused'));
    } catch {
      toast.error(isAr ? 'فشل التحديث' : 'Update failed');
    }
  };

  const deleteRow = async (row, e) => {
    e?.stopPropagation?.();
    const ok = await confirm({
      title: isAr ? 'حذف الحملة؟' : 'Delete campaign?',
      message: isAr ? 'سيتم استرجاع أسعار المنتجات.' : 'Product prices will be restored.',
      variant: 'danger',
    });
    if (!ok) return;
    await adminApi.deletePromotion(row._id);
    if (editId === row._id) closePanel();
    list.reload();
    reloadStats();
    toast.success(isAr ? 'تم الحذف' : 'Deleted');
  };

  const tabs = [
    { id: 'catalog', labelAr: 'منتجات بخصم', labelEn: 'Product offers', icon: Package, count: stats?.catalogOffers },
    { id: 'campaigns', labelAr: 'حملات العروض', labelEn: 'Campaigns', icon: Layers, count: stats?.total },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
            <Flame className="h-7 w-7 text-orange-600" />
            {isAr ? 'العروض والتخفيضات' : 'Offers & promotions'}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            {isAr
              ? 'تعديل فوري بدون إعادة تحميل — انقر على أي منتج أو حملة لفتح لوحة التعديل.'
              : 'Instant edits without page reload — click any product or campaign to open the editor panel.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openSingleProductOffer}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 shadow-sm hover:bg-orange-50"
          >
            <Tag className="h-4 w-4" />
            {isAr ? 'عرض لمنتج واحد' : 'Single product offer'}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'حملة جديدة' : 'New campaign'}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { label: isAr ? 'منتجات بخصم' : 'Catalog offers', value: stats.catalogOffers, className: 'border-orange-200 bg-orange-50' },
            { label: isAr ? 'من المنتجات' : 'From products', value: stats.legacyOffers, className: 'border-amber-200 bg-amber-50' },
            { label: isAr ? 'حملات نشطة' : 'Active campaigns', value: stats.active, className: 'border-emerald-200 bg-emerald-50' },
            { label: isAr ? 'مجدولة' : 'Scheduled', value: stats.scheduled, className: 'border-blue-200 bg-blue-50' },
            { label: isAr ? 'متوقفة' : 'Paused', value: stats.paused, className: 'border-slate-200 bg-slate-50' },
            { label: isAr ? 'ظاهرة في المتجر' : 'Live on store', value: stats.offerProducts, className: 'border-violet-200 bg-violet-50' },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border p-4 shadow-sm ${card.className}`}>
              <p className="text-2xl font-black tabular-nums">{card.value ?? 0}</p>
              <p className="text-xs font-semibold text-text-muted">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {tabs.map(({ id, labelAr, labelEn, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === id
                ? 'border border-b-0 border-border bg-white text-orange-700 shadow-sm'
                : 'text-text-muted hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {isAr ? labelAr : labelEn}
            {count != null && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">{count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <ProductOffersCatalog
          categories={categories}
          onStatsChange={reloadStats}
          onImportComplete={() => { list.reload(); setTab('campaigns'); }}
        />
      )}

      {tab === 'campaigns' && (
        <PromotionCampaignsList
          isAr={isAr}
          list={list}
          onRowClick={openEdit}
          onToggleRow={toggleRow}
          onDeleteRow={deleteRow}
          onBulk={runBulk}
        />
      )}

      <AdminSlidePanel
        open={singlePanelOpen}
        onClose={closeSinglePanel}
        title={isAr ? 'عرض لمنتج واحد' : 'Single product offer'}
        subtitle={isAr ? '1+1، خصم، أو سعر خاص — منتج واحد فقط' : 'BOGO, discount, or special price — one product'}
        isAr={isAr}
        width="max-w-lg"
      >
        <SingleProductOfferPanel
          key="single-product-offer"
          isAr={isAr}
          initialForm={singlePanelSeed}
          categories={categories}
          brands={brands}
          onSubmit={handleSingleSubmit}
          onCancel={closeSinglePanel}
          saving={singleSaving}
        />
      </AdminSlidePanel>

      <AdminSlidePanel
        open={panelOpen}
        onClose={closePanel}
        title={editId ? (isAr ? 'تعديل الحملة' : 'Edit campaign') : (isAr ? 'حملة جديدة' : 'New campaign')}
        subtitle={editId ? panelSubtitle : (isAr ? '٤ خطوات: النوع → القيمة → التفاصيل → المنتجات' : '4 steps: type → value → details → products')}
        isAr={isAr}
        width="max-w-2xl"
      >
        <PromotionEditorPanel
          key={editId ?? 'new-campaign'}
          isAr={isAr}
          initialForm={panelSeed}
          categories={categories}
          brands={brands}
          onSubmit={handleSubmit}
          onCancel={closePanel}
          saving={saving}
          editId={editId}
        />
      </AdminSlidePanel>
    </div>
  );
}
