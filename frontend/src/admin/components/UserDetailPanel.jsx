import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban, Calendar, Clock, Gift, History, Mail, MapPin, MessageSquareOff, Phone, Receipt, Save, ShieldCheck,
  ShoppingBag, StickyNote, Trash2, User, Wallet,
} from 'lucide-react';
import { Link } from '../../app/router';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from './AdminSlidePanel';
import ToggleSwitch from './ToggleSwitch';
import UserStatusBadge, { resolveUserStatus } from './UserStatusBadge';
import { adminApi } from '../adminApi';
import {
  CUSTOMER_PAGE_ROLES, hasPermission, roleLabel, STAFF_ROLES,
} from '../adminPermissions';
import { formatDate, formatMoneyLatin, formatRelativeTime } from '../../utils/formatters';
import { getOrderStatusLabel } from '../../utils/orderStatus';
import { formatOrderNumber } from '../../utils/orderNumber';
import { formatLocalPhoneDisplay } from '../../utils/phoneHelpers';

const ROLE_COLORS = {
  user: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-100 text-blue-800',
  admin: 'bg-purple-100 text-purple-800',
  super_admin: 'bg-amber-100 text-amber-900',
  driver: 'bg-teal-100 text-teal-800',
  seller_owner: 'bg-orange-100 text-orange-800',
  seller_staff: 'bg-orange-50 text-orange-700',
};

const NOTE_MAX = 1000;

const ACTIVITY_LABELS = {
  create: { en: 'Account created', ar: 'إنشاء الحساب' },
  update: { en: 'Updated', ar: 'تعديل' },
  delete: { en: 'Deleted', ar: 'حذف' },
  status_change: { en: 'Status changed', ar: 'تغيير الحالة' },
  adjust: { en: 'Balance adjusted', ar: 'تعديل الرصيد' },
};

const CHANGE_FIELD_LABELS = {
  name: { en: 'name', ar: 'الاسم' },
  phone: { en: 'phone', ar: 'الهاتف' },
  role: { en: 'role', ar: 'الدور' },
  isActive: { en: 'account status', ar: 'حالة الحساب' },
  isPhoneVerified: { en: 'phone verification', ar: 'توثيق الهاتف' },
  reviewBlocked: { en: 'review block', ar: 'حظر التقييمات' },
  adminNote: { en: 'note', ar: 'الملاحظة' },
};

/** "Updated: name, phone" — which fields an audit entry touched, in plain words. */
function describeActivity(entry, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const label = ACTIVITY_LABELS[entry.action]?.[lang] || entry.action;
  const fields = entry.changes && typeof entry.changes === 'object'
    ? Object.keys(entry.changes).filter((k) => CHANGE_FIELD_LABELS[k]).map((k) => CHANGE_FIELD_LABELS[k][lang])
    : [];
  return fields.length ? `${label}: ${fields.join(isAr ? '، ' : ', ')}` : label;
}

const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;

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

function StatTile({
  icon: Icon, label, value, to, linkLabel,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-base font-bold tabular-nums text-text">{value}</p>
      {to && (
        <Link to={to} className="mt-1 inline-block text-xs font-medium text-primary-700 hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

export default function UserDetailPanel({
  userId,
  open,
  onClose,
  isAr,
  canManage,
  isSuperAdmin,
  currentUserId,
  onUpdated,
  onDelete,
  onError,
  onSuccess,
}) {
  const { user: currentUser } = useAuth();
  const canSeeBalances = hasPermission(currentUser, 'settings:write');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', role: 'user' });
  const [access, setAccess] = useState({ isActive: true, isPhoneVerified: false, reviewBlocked: false });
  const [note, setNote] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const shownUserIdRef = useRef(null);

  useEffect(() => {
    if (!open || !userId) {
      shownUserIdRef.current = null;
      setUser(null);
      return undefined;
    }

    let cancelled = false;
    // Only opening a different user shows the spinner; refreshes after a save swap data in place.
    if (shownUserIdRef.current !== userId) setLoading(true);
    adminApi.getUser(userId)
      .then(({ data }) => {
        if (cancelled) return;
        const u = data.data;
        shownUserIdRef.current = userId;
        setUser(u);
        setForm({ name: u.name || '', phone: u.phone || '', role: u.role || 'user' });
        setAccess({
          isActive: u.isActive !== false,
          isPhoneVerified: Boolean(u.isPhoneVerified),
          reviewBlocked: Boolean(u.reviewBlocked),
        });
        setNote(u.adminNote || '');
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, userId, reloadKey]);

  /** Re-fetch so stats and the change history reflect what was just saved. */
  const afterSave = useCallback((message) => {
    onSuccess?.(message);
    onUpdated?.();
    setReloadKey((k) => k + 1);
  }, [onSuccess, onUpdated]);

  const isSelf = userId === currentUserId;
  const isStaff = user && STAFF_ROLES.includes(user.role);
  const canEdit = (canManage ?? isSuperAdmin) && !isSelf;
  const canDelete = isSuperAdmin && user && CUSTOMER_PAGE_ROLES.includes(user.role) && !isSelf;
  const accessDirty = user && (
    access.isActive !== (user.isActive !== false)
    || access.isPhoneVerified !== Boolean(user.isPhoneVerified)
    || access.reviewBlocked !== Boolean(user.reviewBlocked)
  );
  const noteDirty = user && note.trim() !== (user.adminNote || '');

  const save = async (payload, setBusy, message) => {
    if (!userId || !canEdit) return;
    setBusy(true);
    try {
      await adminApi.updateUser(userId, payload);
      afterSave(message);
    } catch (err) {
      onError?.(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAccess = () => save(access, setSavingAccess, isAr ? 'تم تحديث حالة الحساب' : 'Account status updated');
  const handleSave = () => save(form, setSaving, isAr ? 'تم حفظ التغييرات' : 'Changes saved');
  const handleSaveNote = () => save({ adminNote: note.trim() }, setSavingNote, isAr ? 'تم حفظ الملاحظة' : 'Note saved');

  const title = user?.name || (isAr ? 'تفاصيل المستخدم' : 'User details');

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      title={title}
      subtitle={(user?.phone && formatLocalPhoneDisplay(user.phone)) || user?.email || undefined}
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
          {resolveUserStatus(user) === 'suspended' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{isAr
                ? 'هذا الحساب موقوف — لا يستطيع صاحبه تسجيل الدخول حتى إعادة التفعيل.'
                : 'This account is suspended — the owner cannot sign in until it is reactivated.'}</p>
            </div>
          )}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4">
            <UserAvatar name={user.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role] || ROLE_COLORS.user}`}>
                  {roleLabel(user.role, isAr)}
                </span>
                <UserStatusBadge user={user} isAr={isAr} />
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

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-3">
            <StatTile icon={ShoppingBag} label={isAr ? 'الطلبات' : 'Orders'} value={user.orderCount ?? 0} />
            <StatTile icon={Receipt} label={isAr ? 'إجمالي الإنفاق' : 'Total spent'} value={money(user.totalSpent, isAr)} />
            <StatTile icon={Receipt} label={isAr ? 'متوسط الطلب' : 'Average order'} value={money(user.avgOrderValue, isAr)} />
            <StatTile
              icon={Clock}
              label={isAr ? 'آخر طلب' : 'Last order'}
              value={user.lastOrderAt ? formatRelativeTime(user.lastOrderAt, isAr) : '—'}
            />
            <StatTile
              icon={Gift}
              label={isAr ? 'نقاط الولاء' : 'Loyalty points'}
              value={formatMoneyLatin(user.pointsBalance || 0, { maximumFractionDigits: 0 })}
              to={canSeeBalances ? `/admin/loyalty?user=${user._id}` : undefined}
              linkLabel={isAr ? 'تعديل النقاط' : 'Adjust points'}
            />
            <StatTile
              icon={Wallet}
              label={isAr ? 'المحفظة' : 'Wallet'}
              value={money(user.walletBalance, isAr)}
              to={canSeeBalances ? `/admin/wallet?user=${user._id}` : undefined}
              linkLabel={isAr ? 'تعديل الرصيد' : 'Adjust balance'}
            />
          </div>

          {user.recentOrders?.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <ShoppingBag className="h-4 w-4" />
                {isAr ? 'أحدث الطلبات' : 'Recent orders'}
              </p>
              <ul className="divide-y divide-border">
                {user.recentOrders.map((order) => (
                  <li key={order._id}>
                    <Link
                      to={`/admin/orders?order=${order._id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary-700"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium" dir="ltr">{formatOrderNumber(order.orderNumber) || order.orderNumber}</span>
                        <span className="block text-xs text-text-muted">
                          {formatRelativeTime(order.createdAt, isAr)}
                          {' · '}
                          {getOrderStatusLabel(order.orderStatus, isAr)}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{money(order.total, isAr)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                {!CUSTOMER_PAGE_ROLES.includes(user.role) ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-text-muted">
                    {roleLabel(user.role, isAr)}
                    {' — '}
                    {isStaff
                      ? (isAr ? 'أدوار الفريق تُدار من صفحة فريق الإدارة' : 'team roles are managed in Admin team')
                      : (isAr ? 'حسابات البائعين تُدار من صفحة البائعين' : 'seller logins are managed in Sellers')}
                  </p>
                ) : (
                  <select
                    value={form.role}
                    onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-text focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
                  >
                    {CUSTOMER_PAGE_ROLES.map((role) => (
                      <option key={role} value={role}>{roleLabel(role, isAr)}</option>
                    ))}
                  </select>
                )}
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

          {canEdit && (
            <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'الحالة والوصول' : 'Status & access'}
              </p>

              <label className="flex items-center justify-between gap-3">
                <span className="flex items-start gap-2.5">
                  <ShieldCheck className={`mt-0.5 h-4 w-4 ${access.isActive ? 'text-emerald-600' : 'text-text-muted'}`} />
                  <span>
                    <span className="block text-sm font-medium text-text">
                      {isAr ? 'الحساب نشط' : 'Account active'}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {isAr ? 'إيقافه يمنع الدخول ويسجّل الخروج من كل الأجهزة' : 'Turning this off blocks sign-in and signs out every device'}
                    </span>
                  </span>
                </span>
                <ToggleSwitch
                  checked={access.isActive}
                  onChange={(v) => setAccess((p) => ({ ...p, isActive: v }))}
                  ariaLabel={isAr ? 'الحساب نشط' : 'Account active'}
                />
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="flex items-start gap-2.5">
                  <Phone className={`mt-0.5 h-4 w-4 ${access.isPhoneVerified ? 'text-emerald-600' : 'text-text-muted'}`} />
                  <span className="block text-sm font-medium text-text">
                    {isAr ? 'الهاتف موثّق' : 'Phone verified'}
                  </span>
                </span>
                <ToggleSwitch
                  checked={access.isPhoneVerified}
                  onChange={(v) => setAccess((p) => ({ ...p, isPhoneVerified: v }))}
                  ariaLabel={isAr ? 'الهاتف موثّق' : 'Phone verified'}
                />
              </label>

              <label className="flex items-center justify-between gap-3">
                <span className="flex items-start gap-2.5">
                  <MessageSquareOff className={`mt-0.5 h-4 w-4 ${access.reviewBlocked ? 'text-red-600' : 'text-text-muted'}`} />
                  <span className="block text-sm font-medium text-text">
                    {isAr ? 'حظر كتابة التقييمات' : 'Block writing reviews'}
                  </span>
                </span>
                <ToggleSwitch
                  checked={access.reviewBlocked}
                  onChange={(v) => setAccess((p) => ({ ...p, reviewBlocked: v }))}
                  ariaLabel={isAr ? 'حظر كتابة التقييمات' : 'Block writing reviews'}
                />
              </label>

              {accessDirty && (
                <Button onClick={handleSaveAccess} disabled={savingAccess} className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  {savingAccess ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الحالة' : 'Save status')}
                </Button>
              )}
            </div>
          )}

          {(canEdit || user.adminNote) && (
            <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <StickyNote className="h-4 w-4" />
                {isAr ? 'ملاحظة داخلية' : 'Internal note'}
              </p>
              {canEdit ? (
                <>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                    rows={3}
                    aria-label={isAr ? 'ملاحظة داخلية' : 'Internal note'}
                    placeholder={isAr ? 'مثال: يفضّل التوصيل مساءً — لا يراها العميل' : 'e.g. Prefers evening delivery — the customer never sees this'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] tabular-nums text-text-muted">{note.length}/{NOTE_MAX}</span>
                    {noteDirty && (
                      <Button size="sm" onClick={handleSaveNote} disabled={savingNote} className="gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        {savingNote ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الملاحظة' : 'Save note')}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="whitespace-pre-line text-sm text-text">{user.adminNote}</p>
              )}
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

          {user.activity?.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-text-muted">
                <History className="h-4 w-4" />
                {isAr ? 'سجل التغييرات' : 'Change history'}
              </p>
              <ol className="space-y-2.5 border-s border-border ps-4">
                {user.activity.map((entry) => (
                  <li key={entry._id} className="relative text-sm">
                    <span className="absolute -start-[1.3rem] top-1.5 h-2 w-2 rounded-full bg-slate-300" aria-hidden />
                    <p className="text-text">{describeActivity(entry, isAr)}</p>
                    <p className="text-xs text-text-muted">
                      {entry.actorName || (isAr ? 'النظام' : 'System')}
                      {' · '}
                      {formatRelativeTime(entry.createdAt, isAr)}
                    </p>
                  </li>
                ))}
              </ol>
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
