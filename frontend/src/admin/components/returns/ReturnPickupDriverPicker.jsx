import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { adminApi } from '../../adminApi';
import { useToast } from '../index';

let driversRequest = null;
/** One request per page load — every return card shares the driver list. */
function loadDrivers() {
  if (!driversRequest) {
    driversRequest = adminApi.getDeliveryStaff()
      .then(({ data }) => data.data || [])
      .catch((err) => { driversRequest = null; throw err; });
  }
  return driversRequest;
}

/** Assign the driver who collects a home-pickup return (approved, not yet completed). */
export default function ReturnPickupDriverPicker({ row, isAr, onAssigned }) {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [value, setValue] = useState(row.pickupDriver ? String(row.pickupDriver) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadDrivers().then((list) => { if (alive) setDrivers(list); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const save = async (driverId) => {
    setSaving(true);
    try {
      await adminApi.assignReturnPickupDriver(row.orderId, row._id, driverId || null);
      setValue(driverId);
      toast.success(driverId
        ? (isAr ? 'تم تعيين مندوب الاستلام' : 'Pickup driver assigned')
        : (isAr ? 'تمت إزالة المندوب' : 'Pickup driver removed'));
      onAssigned?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-border">
      <Truck className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
      <span className="text-xs font-semibold">{isAr ? 'مندوب الاستلام' : 'Pickup driver'}</span>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => save(e.target.value)}
        className="min-w-[10rem] flex-1 rounded-md border border-border bg-white px-2 py-1 text-xs"
      >
        <option value="">{isAr ? '— بدون —' : '— none —'}</option>
        {drivers.map((d) => (
          <option key={d._id} value={String(d._id)}>{d.name}</option>
        ))}
      </select>
      {row.pickupOutcome === 'not_collected' && (
        <span className="w-full text-[11px] text-red-700">
          {isAr ? `لم يُستلم: ${row.pickupNote}` : `Not collected: ${row.pickupNote}`}
        </span>
      )}
      {row.pickupOutcome === 'collected' && row.pickupCondition && (
        <span className="w-full text-[11px] text-emerald-800">
          {isAr ? `استلمه المندوب — الحالة: ${row.pickupCondition}` : `Collected — condition: ${row.pickupCondition}`}
        </span>
      )}
    </div>
  );
}
