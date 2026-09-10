import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, Clock, Copy, Crown, KeyRound, Mail, Pencil, Phone, Shield, Truck, Trash2, User,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Loader from '../../../components/ui/Loader';
import AdminSlidePanel from '../AdminSlidePanel';
import { CopyButton } from '../StaffCredentialsCard';
import { adminApi } from '../../adminApi';
import {
  PERMISSION_GROUPS,
  ROLE_BADGE_STYLES,
  ROLE_GUIDE,
  roleLabel,
  resolveUserPermissions,
} from '../../adminPermissions';
import { formatDate } from '../../../utils/formatters';

function RoleBadge({ role, isAr }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700'}`}>
      {role === 'super_admin' && <Crown className="h-3 w-3" />}
      {role === 'driver' && <Truck className="h-3 w-3" />}
      {roleLabel(role, isAr)}
    </span>
  );
}

function InfoBlock({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-white p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        <div className="mt-0.5 text-sm text-text">{children}</div>
      </div>
    </div>
  );
}

export default function TeamMemberDetailPanel({
  accountId,
  open,
  onClose,
  isAr,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
  onResetPassword,
}) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !accountId) {
      setAccount(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    adminApi.getStaffAccount(accountId)
      .then(({ data }) => { if (!cancelled) setAccount(data.data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, accountId]);

  const permissions = useMemo(
    () => (account ? resolveUserPermissions(account) : []),
    [account],
  );

  const groupedPermissions = useMemo(() => (
    PERMISSION_GROUPS.map((group) => ({
      ...group,
      items: group.permissions.filter((p) => permissions.includes(p.key)),
    })).filter((g) => g.items.length > 0)
  ), [permissions]);

  if (!open) return null;

  const isDriver = account?.role === 'driver' || account?.isDriver;
  const loginPath = account?.loginPath || (isDriver ? '/driver/login' : '/admin/login');
  const loginUrl = account ? `${window.location.origin}${loginPath}` : '';
  const driverPrefill = account ? `${window.location.origin}/driver/login?u=${encodeURIComponent(account.username)}` : '';

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      isAr={isAr}
      width="max-w-xl"
      title={account?.name || (isAr ? 'تفاصيل العضو' : 'Member details')}
      subtitle={account ? `@${account.username}` : ''}
    >
      {loading ? (
        <div className="flex justify-center py-16"><Loader size="md" /></div>
      ) : account ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-lg font-bold text-orange-800">
                  {(account.name || '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-text">{account.name}</h3>
                    {account.isSelf && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                        {isAr ? 'أنت' : 'You'}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-sm text-text-muted" dir="ltr">@{account.username}</p>
                </div>
              </div>
              <RoleBadge role={account.role} isAr={isAr} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              {ROLE_GUIDE[account.role]?.[isAr ? 'ar' : 'en']?.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                account.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600',
              ].join(' ')}>
                <span className={`h-1.5 w-1.5 rounded-full ${account.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {account.isActive ? (isAr ? 'نشط — يمكنه الدخول' : 'Active — can sign in') : (isAr ? 'معطّل — لا يمكنه الدخول' : 'Inactive — cannot sign in')}
              </span>
              {(account.permissions?.length || 0) > 0 && account.role !== 'super_admin' && account.role !== 'driver' && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                  {isAr ? 'صلاحيات مخصصة' : 'Custom permissions'}
                </span>
              )}
            </div>
          </div>

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
              <KeyRound className="h-4 w-4 text-orange-600" />
              {isAr ? 'الدخول' : 'Sign-in'}
            </h4>
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-text-muted">
                    {isDriver ? (isAr ? 'تطبيق المندوب' : 'Driver app') : (isAr ? 'لوحة التحكم' : 'Admin panel')}
                  </p>
                  <p className="truncate text-sm text-text" dir="ltr">{loginUrl}</p>
                </div>
                <CopyButton value={loginUrl} isAr={isAr} />
              </div>
              {isDriver && (
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">{isAr ? 'رابط دخول باسم المستخدم مُعبّأ' : 'Login link with username pre-filled'}</p>
                    <p className="truncate text-sm text-text" dir="ltr">{driverPrefill}</p>
                  </div>
                  <CopyButton value={driverPrefill} isAr={isAr} />
                </div>
              )}
              <p className="mt-2 text-xs text-text-muted">
                {isDriver
                  ? (isAr ? 'عيّن هذا المندوب لطلب من صفحة الطلبات لبدء التوصيل.' : 'Assign this driver to an order from the Orders page to start a delivery.')
                  : (isAr ? 'يدخل باسم المستخدم وكلمة المرور.' : 'Signs in with username and password.')}
              </p>
            </div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            <InfoBlock icon={Calendar} label={isAr ? 'تاريخ الإنشاء' : 'Created'}>
              {account.createdAt ? formatDate(account.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
            </InfoBlock>
            <InfoBlock icon={Clock} label={isAr ? 'آخر دخول' : 'Last sign-in'}>
              {account.lastLoginAt ? formatDate(account.lastLoginAt, isAr ? 'ar-EG' : 'en-GB') : (isAr ? 'لم يسجّل بعد' : 'Never')}
            </InfoBlock>
            {account.email && (
              <InfoBlock icon={Mail} label={isAr ? 'البريد' : 'Email'}>
                <span dir="ltr">{account.email}</span>
              </InfoBlock>
            )}
            {account.phone && (
              <InfoBlock icon={Phone} label={isAr ? 'الهاتف' : 'Phone'}>
                <span dir="ltr">{account.phone}</span>
              </InfoBlock>
            )}
            {account.createdBy?.name && (
              <InfoBlock icon={User} label={isAr ? 'أنشأه' : 'Created by'}>
                {account.createdBy.name}
                {account.createdBy.username && (
                  <span className="text-text-muted" dir="ltr"> @{account.createdBy.username}</span>
                )}
              </InfoBlock>
            )}
          </div>

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Shield className="h-4 w-4 text-orange-600" />
              {isAr ? 'الصلاحيات الفعّالة' : 'Effective access'}
              {!isDriver && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-text-muted">
                  {permissions.length}
                </span>
              )}
            </h4>
            {account.role === 'super_admin' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {isAr
                  ? 'مالك النظام — وصول كامل لكل أقسام لوحة التحكم وإدارة الفريق.'
                  : 'Owner — full access to every admin area and team management.'}
              </div>
            ) : isDriver ? (
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                <p>
                  {isAr
                    ? 'مندوب توصيل — يرى الطلبات المعيّنة له فقط عبر تطبيق المندوب. لا وصول للوحة التحكم.'
                    : 'Delivery driver — sees only orders assigned to them via the driver app. No admin panel access.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedPermissions.map((group) => (
                  <div key={group.id} className="rounded-xl border border-border bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      {isAr ? group.labelAr : group.labelEn}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((perm) => (
                        <span
                          key={perm.key}
                          className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-900"
                          title={perm.key}
                        >
                          {isAr ? perm.labelAr : perm.labelEn}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Button type="button" className="w-full" onClick={() => onEdit?.(account)}>
              <Pencil className="h-4 w-4" />
              {isAr ? 'تعديل العضو' : 'Edit member'}
            </Button>
            {account.canResetPassword && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onResetPassword?.(account)}
              >
                <KeyRound className="h-4 w-4" />
                {isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password'}
              </Button>
            )}
            {!account.isSelf && account.role !== 'driver' && (
              <Button type="button" variant="outline" className="w-full" onClick={() => onDuplicate?.(account)}>
                <Copy className="h-4 w-4" />
                {isAr ? 'نسخ الصلاحيات لعضو جديد' : 'Duplicate as new member'}
              </Button>
            )}
            {account.canDeactivate && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => onToggleActive?.(account)}
              >
                {account.isActive
                  ? (isAr ? 'تعطيل العضو' : 'Deactivate member')
                  : (isAr ? 'تفعيل العضو' : 'Activate member')}
              </Button>
            )}
            {account.canDelete && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-red-200 text-red-700 hover:bg-red-50"
                onClick={() => onDelete?.(account)}
              >
                <Trash2 className="h-4 w-4" />
                {account.isSuperAdmin
                  ? (isAr ? 'حذف مالك النظام' : 'Delete owner')
                  : (isAr ? 'حذف العضو' : 'Delete member')}
              </Button>
            )}
            {account.isSelf && (
              <p className="rounded-xl bg-sky-50 px-3 py-2 text-center text-xs text-sky-900">
                {isAr
                  ? 'لا يمكنك حذف أو تعطيل حسابك أو إعادة تعيين كلمة مروره من هنا. يمكن لمالك نظام آخر إدارته.'
                  : 'You cannot delete, deactivate or reset your own account here. Another owner can manage it.'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </AdminSlidePanel>
  );
}
