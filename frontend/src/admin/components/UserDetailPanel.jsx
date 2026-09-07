import { useEffect, useState } from 'react';
import {
  Calendar, Gift, Mail, MapPin, Phone, Save, ShieldCheck, ShoppingBag, Trash2, User,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from './AdminSlidePanel';
import { adminApi } from '../adminApi';
import { ASSIGNABLE_ROLES, roleLabel, STAFF_ROLES } from '../adminPermissions';
import { formatDate } from '../../utils/formatters';

const ROLE_COLORS = {
  user: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-100 text-blue-800',
  admin: 'bg-purple-100 text-purple-800',
  super_admin: 'bg-amber-100 text-amber-900',
  driver: 'bg-teal-100 text-teal-800',
};

function UserAvatar({ name, size = 'lg' }) {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-14 w-14 text-lg';

  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-800 ${sizeClass}`}>
      {initials}
    </span>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <div className="mt-0.5 text-sm text-text">{children}</div>
      </div>
    </div>
  );
}

export default function UserDetailPanel({
  userId,
  open,
  onClose,
  isAr,
  isSuperAdmin,
  currentUserId,
  onUpdated,
  onDelete,
  onError,
  onSuccess,
}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: 'user' });

  useEffect(() => {
    if (!open || !userId) {
      setUser(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    adminApi.getUser(userId)
      .then(({ data }) => {
        if (cancelled) return;
        const u = data.data;
        setUser(u);
        setForm({ name: u.name || '', phone: u.phone || '', role: u.role || 'user' });
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, userId]);

  const isSelf = userId === currentUserId;
  const isStaff = user && STAFF_ROLES.includes(user.role);
  const canEdit = isSuperAdmin && !isSelf;
  const canDelete = isSuperAdmin && user && !isStaff && !isSelf;

  const handleSave = async () => {
    if (!userId || !canEdit) return;
    setSaving(true);
    try {
      const { data } = await adminApi.updateUser(userId, form);
      const updated = { ...user, ...data.data };
      setUser(updated);
      onUpdated?.(updated);
      onSuccess?.(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
    } catch (err) {
      onError?.(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const title = user?.name || (isAr ? 'تفاصيل المستخدم' : 'User details');

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      title={title}
      subtitle={user?.phone || user?.email || undefined}
      width="max-w-xl"
      isAr={isAr}
    >
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader />
        </div>
      ) : !user ? (
        <p className="py-8 text-center text-sm text-text-muted">
          {isAr ? 'تعذر تحميل المستخدم' : 'Could not load user'}
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
            <UserAvatar name={user.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
                  {roleLabel(user.role, isAr)}
                </span>
                {user.isPhoneVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isAr ? 'هاتف موثّق' : 'Phone verified'}
                  </span>
                )}
                {user.reviewBlocked && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {isAr ? 'التقييمات محظورة' : 'Reviews blocked'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {isAr ? 'عضو منذ' : 'Member since'}{' '}
                {user.createdAt ? formatDate(user.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <ShoppingBag className="mx-auto h-5 w-5 text-text-muted" />
              <p className="mt-2 text-lg font-bold text-text">{user.orderCount ?? 0}</p>
              <p className="text-xs text-text-muted">{isAr ? 'الطلبات' : 'Orders'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <Gift className="mx-auto h-5 w-5 text-text-muted" />
              <p className="mt-2 text-lg font-bold text-text">{user.pointsBalance ?? 0}</p>
              <p className="text-xs text-text-muted">{isAr ? 'نقاط الولاء' : 'Loyalty points'}</p>
            </div>
          </div>

          {canEdit ? (
            <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'تعديل الحساب' : 'Edit account'}
              </p>
              <Input
                label={isAr ? 'الاسم' : 'Name'}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label={isAr ? 'الهاتف' : 'Phone'}
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                dir="ltr"
                className="text-start"
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text">
                  {isAr ? 'الدور' : 'Role'}
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-text focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>{roleLabel(role, isAr)}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ التغييرات' : 'Save changes')}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
              <InfoRow icon={User} label={isAr ? 'الاسم' : 'Name'}>
                {user.name || '—'}
              </InfoRow>
              <InfoRow icon={Phone} label={isAr ? 'الهاتف' : 'Phone'}>
                <span dir="ltr" className="inline-block">{user.phone || '—'}</span>
                {user.phone && (
                  <span className={`ms-2 text-xs ${user.isPhoneVerified ? 'text-emerald-600' : 'text-text-muted'}`}>
                    {user.isPhoneVerified ? (isAr ? 'موثّق' : 'Verified') : (isAr ? 'غير موثّق' : 'Unverified')}
                  </span>
                )}
              </InfoRow>
              <InfoRow icon={Mail} label={isAr ? 'البريد' : 'Email'}>
                {user.email ? (
                  <span dir="ltr" className="inline-block">{user.email}</span>
                ) : (
                  <span className="text-text-muted">{isAr ? 'غير مضاف' : 'Not provided'}</span>
                )}
              </InfoRow>
              <InfoRow icon={Calendar} label={isAr ? 'تاريخ التسجيل' : 'Joined'}>
                {user.createdAt ? formatDate(user.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
              </InfoRow>
            </div>
          )}

          {(user.addresses?.length > 0) && (
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <MapPin className="h-4 w-4" />
                {isAr ? `العناوين (${user.addresses.length})` : `Addresses (${user.addresses.length})`}
              </p>
              <ul className="space-y-2">
                {user.addresses.map((addr) => (
                  <li key={addr._id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium">{addr.label || (isAr ? 'عنوان' : 'Address')}</p>
                    <p className="mt-0.5 text-text-muted">
                      {[addr.street, addr.building, addr.city, addr.governorate].filter(Boolean).join(isAr ? '، ' : ', ')}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canDelete && (
            <Button
              variant="danger"
              className="w-full gap-2"
              onClick={() => onDelete?.(user)}
            >
              <Trash2 className="h-4 w-4" />
              {isAr ? 'حذف المستخدم' : 'Delete user'}
            </Button>
          )}
        </div>
      )}
    </AdminSlidePanel>
  );
}

export { UserAvatar, ROLE_COLORS };
