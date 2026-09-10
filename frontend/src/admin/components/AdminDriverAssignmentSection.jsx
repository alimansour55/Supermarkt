import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ChevronDown, ChevronUp, ExternalLink, Phone, Radio, Truck, UserPlus, X,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import AdminOrderTrackingSection from './AdminOrderTrackingSection';
import { formatDate } from '../../utils/formatters';
import { useAdminPanel } from '../context/AdminPanelContext';

function DriverAvatar({ name, size = 'md' }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 ring-2 ring-white ${sizeClass}`}
    >
      {initials}
    </span>
  );
}

function DriverPickCard({
  driver,
  selected,
  disabled,
  isAr,
  isCurrentOrderDriver,
  onSelect,
}) {
  const busy = driver.activeDeliveries > 0 && !isCurrentOrderDriver;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(driver._id)}
      className={[
        'flex w-full items-center gap-3 rounded-xl border p-3 text-start transition disabled:opacity-50',
        selected
          ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
          : 'border-border bg-white hover:border-teal-200 hover:bg-teal-50/40',
      ].join(' ')}
    >
      <DriverAvatar name={driver.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text">{driver.name}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted" dir="ltr">
          {driver.username ? `@${driver.username}` : ''}
          {driver.phone ? `${driver.username ? ' · ' : ''}${driver.phone}` : ''}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {driver.available === false && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {isAr ? 'غير متصل' : 'Offline'}
            </span>
          )}
          {busy && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
              {driver.activeDeliveries} {isAr ? 'طلب نشط' : 'active'}
            </span>
          )}
          {!busy && driver.activeDeliveries === 0 && driver.available !== false && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {isAr ? 'متاح' : 'Available'}
            </span>
          )}
        </div>
      </div>
      {selected && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </button>
  );
}

export default function AdminDriverAssignmentSection({
  order,
  drivers = [],
  isAr,
  updating,
  onAssign,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingDriverId, setPendingDriverId] = useState('');
  const { driverSettings } = useAdminPanel();
  const autoAssignEnabled = driverSettings?.autoAssignEnabled === true;

  const sortedDrivers = useMemo(
    () => [...drivers].sort((a, b) => {
      const availDiff = (a.available === false ? 1 : 0) - (b.available === false ? 1 : 0);
      if (availDiff) return availDiff;
      return (a.activeDeliveries || 0) - (b.activeDeliveries || 0);
    }),
    [drivers],
  );

  const assignedId = order.assignedDriver?._id || order.assignedDriver?.id || '';
  const currentStatus = order.orderStatus || order.status;
  const showTracking = Boolean(assignedId) && currentStatus === 'out_for_delivery';
  const canAssign = !['cancelled', 'delivered', 'delivery_failed', 'returned'].includes(currentStatus);

  const assignedDriverMeta = useMemo(
    () => drivers.find((d) => String(d._id) === String(assignedId)),
    [drivers, assignedId],
  );

  const handleConfirmAssign = () => {
    if (!pendingDriverId) return;
    const willShip = ['pending', 'confirmed', 'preparing'].includes(currentStatus);
    const driver = drivers.find((d) => String(d._id) === pendingDriverId);
    const name = driver?.name || '';
    const msg = willShip
      ? (isAr
        ? `تعيين ${name} لهذا الطلب؟\nسيتغير الحالة إلى «في الطريق» تلقائياً ويظهر الطلب في تطبيق المندوب.`
        : `Assign ${name} to this order?\nStatus will move to "Out for delivery" and the order appears in the driver app.`)
      : (isAr
        ? `تعيين ${name} لهذا الطلب؟`
        : `Assign ${name} to this order?`);
    if (!window.confirm(msg)) return;
    onAssign?.(pendingDriverId);
    setPickerOpen(false);
    setPendingDriverId('');
  };

  const handleUnassign = () => {
    const ok = window.confirm(
      isAr
        ? 'إزالة المندوب من هذا الطلب؟'
        : 'Remove the driver from this order?',
    );
    if (!ok) return;
    onAssign?.(null);
    setPickerOpen(false);
    setPendingDriverId('');
  };

  const openChangePicker = () => {
    setPendingDriverId(assignedId);
    setPickerOpen(true);
  };

  if (!canAssign && !assignedId) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 via-white to-white shadow-sm">
      <div className="border-b border-teal-100 bg-teal-900/5 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-teal-950">
              <Truck className="h-4 w-4 text-teal-700" aria-hidden />
              {isAr ? 'تعيين مندوب توصيل' : 'Assign delivery driver'}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-teal-900/70">
              {isAr
                ? 'اختر مندوباً لمشاركة الموقع المباشر مع العميل ومتابعة التوصيل من لوحة التحكم.'
                : 'Pick a driver for live GPS sharing with the customer and tracking from admin.'}
            </p>
          </div>
          {showTracking && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
              <Radio className="h-3 w-3" aria-hidden />
              {isAr ? 'تتبع مباشر' : 'Live'}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {autoAssignEnabled && !assignedId && (
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-900">
            {isAr
              ? '⚡ التعيين التلقائي مُفعّل — سيُختار مندوب تلقائياً عند تحويل الطلب إلى «في الطريق». يمكنك أيضاً اختيار مندوب يدوياً الآن.'
              : '⚡ Auto-assign is on — a driver is picked automatically when the order ships. You can still pick one manually now.'}
          </p>
        )}
        {assignedId && order.assignedDriver ? (
          <div className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <DriverAvatar name={order.assignedDriver.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  {isAr ? 'المندوب الحالي' : 'Assigned driver'}
                </p>
                <p className="mt-0.5 text-lg font-bold text-text">{order.assignedDriver.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  {assignedDriverMeta?.username && (
                    <span dir="ltr">@{assignedDriverMeta.username}</span>
                  )}
                  {assignedDriverMeta?.activeDeliveries > 0 && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">
                      {assignedDriverMeta.activeDeliveries} {isAr ? 'طلبات نشطة' : 'active orders'}
                    </span>
                  )}
                  {order.assignedDriverAt && (
                    <span>
                      {isAr ? 'عُيّن ' : 'Assigned '}
                      {formatDate(order.assignedDriverAt, isAr ? 'ar-EG' : 'en-GB')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {order.assignedDriver.phone && (
                <a
                  href={`tel:${order.assignedDriver.phone}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-100 sm:flex-none"
                  dir="ltr"
                >
                  <Phone className="h-4 w-4" aria-hidden />
                  {order.assignedDriver.phone}
                </a>
              )}
              {canAssign && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updating}
                    onClick={openChangePicker}
                  >
                    {isAr ? 'تغيير المندوب' : 'Change driver'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={updating}
                    onClick={handleUnassign}
                    className="text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    {isAr ? 'إزالة' : 'Remove'}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : canAssign && (
          <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/30 px-4 py-5 text-center">
            <Truck className="mx-auto mb-2 h-8 w-8 text-teal-400" aria-hidden />
            <p className="font-medium text-teal-950">
              {isAr ? 'لم يُعيَّن مندوب بعد' : 'No driver assigned yet'}
            </p>
            <p className="mt-1 text-xs text-teal-800/70">
              {isAr
                ? 'اختر مندوباً من القائمة أدناه لبدء التوصيل المباشر'
                : 'Select a driver below to start live delivery tracking'}
            </p>
          </div>
        )}

        {canAssign && (pickerOpen || !assignedId) && (
          <div className="space-y-3">
            {assignedId && (
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-text"
              >
                {isAr ? 'اختيار مندوب' : 'Select driver'}
                {pickerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}

            {(!assignedId || pickerOpen) && (
              <>
                {drivers.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                    <p className="font-semibold">
                      {isAr ? 'لا يوجد مناديب في النظام' : 'No drivers in the system'}
                    </p>
                    <p className="mt-1 text-xs text-amber-900/80">
                      {isAr
                        ? 'أنشئ حساب مندوب من فريق الإدارة أولاً.'
                        : 'Create a driver account in Admin team first.'}
                    </p>
                    <Link
                      to="/admin/team"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 underline"
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      {isAr ? 'فريق الإدارة' : 'Admin team'}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {sortedDrivers.map((driver) => (
                      <li key={driver._id}>
                        <DriverPickCard
                          driver={driver}
                          selected={String(pendingDriverId || assignedId) === String(driver._id)}
                          disabled={updating}
                          isAr={isAr}
                          isCurrentOrderDriver={String(assignedId) === String(driver._id)}
                          onSelect={setPendingDriverId}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {drivers.length > 0 && pendingDriverId && pendingDriverId !== assignedId && (
                  <Button
                    type="button"
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    disabled={updating || !pendingDriverId}
                    onClick={handleConfirmAssign}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {isAr ? 'تأكيد التعيين' : 'Confirm assignment'}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {['pending', 'confirmed', 'preparing'].includes(currentStatus) && canAssign && !assignedId && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
            {isAr
              ? '💡 عند التعيين سيتحول الطلب تلقائياً إلى «في الطريق» ويظهر عند المندوب.'
              : '💡 Assigning will automatically set the order to "Out for delivery" and show it in the driver app.'}
          </p>
        )}

        {showTracking && (
          <AdminOrderTrackingSection
            orderId={order._id}
            orderNumber={order.orderNumber}
            isAr={isAr}
            compact
          />
        )}

        {assignedId && currentStatus !== 'out_for_delivery' && canAssign && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {isAr
              ? 'لتفعيل التتبع المباشر، غيّر حالة الطلب إلى «في الطريق».'
              : 'Set order status to "Out for delivery" to enable live tracking.'}
          </p>
        )}
      </div>
    </section>
  );
}
