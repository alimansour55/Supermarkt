import { Link } from '../../app/router';
import { ChevronLeft, MapPinPlus, Radar, Save, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import GoogleMapPicker from '../../components/maps/GoogleMapPicker';
import { PageHeader } from '../components';
import { useStoreSettingsForm } from '../hooks/useStoreSettingsForm';
import { makeCoverageAreaId } from '../utils/storeSettingsDefaults';

export default function CoverageAreaPage() {
  const {
    settings, loading, saving, save, updateNested, isAr,
  } = useStoreSettingsForm();

  if (loading || !settings) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white">
        <Loader size="lg" />
      </div>
    );
  }

  const gate = settings.locationGate || {};
  const areas = gate.coverageAreas || [];

  const updateAreas = (nextAreas) => updateNested('locationGate', 'coverageAreas', nextAreas);
  const addArea = () => updateAreas([
    ...areas,
    { id: makeCoverageAreaId(), label: '', lat: null, lng: null, radiusKm: 15 },
  ]);
  const updateArea = (id, patch) => updateAreas(areas.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const removeArea = (id) => updateAreas(areas.filter((a) => a.id !== id));

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        action={(
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" aria-hidden />
            {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
          </Button>
        )}
      />

      <div className="rounded-2xl border border-primary-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Radar className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-bold">{isAr ? 'منطقة التغطية' : 'Coverage area'}</h2>
            <p className="text-sm text-text-muted">
              {isAr
                ? 'المظلة العامة التي تحدد أين يمكنك التوصيل مطلقاً — منفصلة عن مناطق التوصيل نفسها.'
                : 'The general umbrella that defines where you can ever deliver — separate from the delivery zones themselves.'}
            </p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-slate-50/80 p-4">
          <p className="text-sm leading-relaxed text-text">
            {isAr
              ? 'هذه هي الخطوة الأولى: أضف دائرة أو أكثر تمثّل كل مكان يمكن أن تصل إليه توصيلاتك على الإطلاق — يمكن أن تكون دوائر متفرقة غير متجاورة (مثلاً: القاهرة والإسكندرية كمنطقتين منفصلتين تماماً). أي طلب خارج كل الدوائر يُرفض دائماً، مهما كانت مناطق التوصيل المعرّفة. بعد ضبطها، أضف مناطق توصيل محددة (بأسعارها ومواعيدها) داخلها من صفحة «مناطق التوصيل» — تلك المناطق لا يمكنها تجاوز هذه الدوائر.'
              : 'This is step one: add one or more circles for everywhere your deliveries can ever reach — they can be scattered and non-adjacent (e.g. separate circles for Cairo and Alexandria). Any order outside every circle is always rejected, no matter what delivery zones exist. Once set, add specific delivery zones (with their own fees and schedules) inside them from the Delivery Zones page — those zones cannot extend service beyond these circles.'}
          </p>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={gate.enforceCoverage !== false}
              onChange={(e) => updateNested('locationGate', 'enforceCoverage', e.target.checked)}
            />
            <span>
              <span className="font-semibold text-text">
                {isAr ? 'تفعيل التغطية' : 'Enforce coverage'}
              </span>
              <span className="mt-1 block text-xs text-text-muted">
                {isAr
                  ? 'عند التفعيل: أي موقع خارج كل الدوائر أدناه يُرفض دائماً برسالة «عذراً! لا نغطي هذه المنطقة». عند الإيقاف: لا يُرفض أي موقع بناءً على هذه الدوائر (تبقى حماية تقريبية أخرى قائمة على أقرب منطقة توصيل).'
                  : 'When on: any location outside every circle below is always rejected with "Sorry! We do not deliver to this area." When off: no location is rejected based on these circles (a rough nearest-zone safety net still applies).'}
              </span>
            </span>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text">
            {isAr
              ? `الدوائر المضافة (${areas.length})`
              : `Circles added (${areas.length})`}
          </p>
          <button
            type="button"
            onClick={addArea}
            className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
          >
            <MapPinPlus className="h-3.5 w-3.5" aria-hidden />
            {isAr ? 'إضافة منطقة تغطية' : 'Add coverage area'}
          </button>
        </div>

        {areas.length === 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {isAr
              ? 'لا توجد دوائر تغطية بعد — لن يُرفض أي موقع حتى تضيف واحدة على الأقل.'
              : 'No coverage circles yet — no location will be rejected until you add at least one.'}
          </p>
        )}

        <div className="mt-3 space-y-4">
          {areas.map((area, index) => (
            <div key={area.id} className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={area.label}
                  onChange={(e) => updateArea(area.id, { label: e.target.value })}
                  placeholder={isAr ? `مثال: القاهرة (منطقة ${index + 1})` : `e.g. Cairo (area ${index + 1})`}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <button
                  type="button"
                  onClick={() => removeArea(area.id)}
                  className="flex shrink-0 items-center gap-1 rounded-lg p-2 text-red-600 hover:bg-red-50"
                  aria-label={isAr ? 'حذف هذه المنطقة' : 'Delete this area'}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <GoogleMapPicker
                lat={area.lat}
                lng={area.lng}
                onChange={({ lat, lng }) => updateArea(area.id, { lat, lng })}
                isAr={isAr}
                radiusMeters={Number(area.radiusKm) > 0 ? Number(area.radiusKm) * 1000 : 15000}
                onRadiusChange={(meters) => updateArea(area.id, { radiusKm: Math.round((meters / 1000) * 10) / 10 })}
                radiusMinMeters={1000}
                radiusMaxMeters={300000}
                showCurrentLocation={false}
              />

              {area.lat != null && area.lng != null ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                  <label className="flex items-center gap-2 font-semibold text-text">
                    {isAr ? 'نصف القطر (كم):' : 'Radius (km):'}
                    <input
                      type="number"
                      min="1"
                      max="300"
                      step="0.5"
                      value={area.radiusKm ?? 15}
                      onChange={(e) => updateArea(area.id, { radiusKm: e.target.value })}
                      className="w-20 rounded-lg border border-border bg-white px-2 py-1 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </label>
                  <span>
                    {Number(area.lat).toFixed(5)}, {Number(area.lng).toFixed(5)}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateArea(area.id, { lat: null, lng: null })}
                    className="font-medium text-red-600 hover:underline"
                  >
                    {isAr ? 'إزالة الدبوس' : 'Clear pin'}
                  </button>
                </div>
              ) : (
                <p className="text-xs font-medium text-amber-700">
                  {isAr
                    ? 'لم يُحدَّد مركز بعد لهذه الدائرة — لن تُحتسب ضمن التغطية حتى تحدّده.'
                    : 'No center set for this circle yet — it won\'t count toward coverage until you set one.'}
                </p>
              )}
            </div>
          ))}
        </div>

        <Link
          to="/admin/delivery"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {isAr ? 'التالي: أضف مناطق التوصيل داخل هذه الدوائر' : 'Next: add delivery zones inside these circles'}
        </Link>
      </div>
    </form>
  );
}
