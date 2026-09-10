import { useEffect, useMemo, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Eye, EyeOff, KeyRound, Shield, UserPlus,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';
import AdminSlidePanel from './AdminSlidePanel';
import StaffCredentialsCard from './StaffCredentialsCard';
import { adminApi } from '../adminApi';
import {
  PERMISSION_GROUPS,
  ROLE_DESCRIPTIONS,
  ROLE_GUIDE,
  ROLE_PRESET_PERMISSIONS,
  roleLabel,
} from '../adminPermissions';

const EMPTY_FORM = {
  name: '',
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  phone: '',
  role: 'manager',
  useCustomPermissions: false,
  permissions: [],
  isActive: true,
};

function PermissionMatrix({ isAr, selected, onChange, disabled }) {
  const [expanded, setExpanded] = useState(() => (
    Object.fromEntries(PERMISSION_GROUPS.map((g) => [g.id, true]))
  ));

  const toggleGroup = (groupId) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const togglePermission = (key) => {
    if (disabled) return;
    if (selected.includes(key)) {
      onChange(selected.filter((p) => p !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const setGroupPermissions = (group, checked) => {
    if (disabled) return;
    const keys = group.permissions.map((p) => p.key);
    if (checked) {
      onChange([...new Set([...selected, ...keys])]);
    } else {
      onChange(selected.filter((p) => !keys.includes(p)));
    }
  };

  return (
    <div className="space-y-3">
      {PERMISSION_GROUPS.map((group) => {
        const groupKeys = group.permissions.map((p) => p.key);
        const selectedCount = groupKeys.filter((k) => selected.includes(k)).length;
        const allSelected = selectedCount === groupKeys.length;
        const someSelected = selectedCount > 0 && !allSelected;

        return (
          <div key={group.id} className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="flex items-center gap-2 border-b border-border bg-slate-50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => setGroupPermissions(group, e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-start"
              >
                <span className="text-sm font-semibold text-text">
                  {isAr ? group.labelAr : group.labelEn}
                </span>
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  {selectedCount}/{groupKeys.length}
                  {expanded[group.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
            </div>
            {expanded[group.id] && (
              <div className="divide-y divide-border">
                {group.permissions.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-orange-50/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                      disabled={disabled}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-text">{isAr ? perm.labelAr : perm.labelEn}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-text-muted">{perm.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoleOptionCard({
  selected,
  disabled,
  title,
  summary,
  bestFor,
  permCount,
  permLabel,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full rounded-xl border p-3 text-start transition-all disabled:opacity-50',
        selected
          ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
          : 'border-border bg-white hover:border-orange-200 hover:bg-orange-50/30',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-text">{title}</p>
        {permCount != null && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-text-muted">
            {permCount} {permLabel}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{summary}</p>
      <p className="mt-1.5 text-[11px] text-text-muted/80">
        <span className="font-medium text-text-muted">→</span> {bestFor}
      </p>
    </button>
  );
}

export default function StaffAccountEditorPanel({
  accountId,
  open,
  onClose,
  isAr,
  cloneTemplate,
  onSaved,
  onError,
  onSuccess,
}) {
  const isEdit = Boolean(accountId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [accountMeta, setAccountMeta] = useState({ isSelf: false, canEditRole: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setAccountMeta({ isSelf: false, canEditRole: true });
      setCreatedCredentials(null);
      setShowPassword(false);
      setFormError('');
      return undefined;
    }

    if (!accountId) {
      if (cloneTemplate) {
        setForm({
          ...EMPTY_FORM,
          role: cloneTemplate.role || 'manager',
          useCustomPermissions: Boolean(cloneTemplate.useCustomPermissions),
          permissions: cloneTemplate.permissions || [],
        });
      }
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    adminApi.getStaffAccount(accountId)
      .then(({ data }) => {
        if (cancelled) return;
        const account = data.data;
        const hasCustom = (account.permissions?.length || 0) > 0;
        setAccountMeta({
          isSelf: Boolean(account.isSelf),
          canEditRole: account.canEditRole !== false,
        });
        setForm({
          name: account.name || '',
          username: account.username || '',
          password: '',
          confirmPassword: '',
          email: account.email || '',
          phone: account.phone || '',
          role: account.role || 'manager',
          useCustomPermissions: hasCustom,
          permissions: hasCustom ? account.permissions : ROLE_PRESET_PERMISSIONS[account.role] || [],
          isActive: account.isActive !== false,
        });
      })
      .catch((err) => onError?.(err.response?.data?.message || (isAr ? 'تعذر تحميل الحساب' : 'Failed to load account')))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, accountId, cloneTemplate, isAr, onError]);

  const isSuperAdminRole = form.role === 'super_admin';
  const isDriverRole = form.role === 'driver';
  const effectivePermissions = useMemo(() => {
    if (isDriverRole) return [];
    if (isSuperAdminRole) return ROLE_PRESET_PERMISSIONS.super_admin;
    if (form.useCustomPermissions) return form.permissions;
    return ROLE_PRESET_PERMISSIONS[form.role] || [];
  }, [isDriverRole, isSuperAdminRole, form.useCustomPermissions, form.permissions, form.role]);

  const applyRolePreset = (role) => {
    setForm((prev) => ({
      ...prev,
      role,
      useCustomPermissions: false,
      permissions: ROLE_PRESET_PERMISSIONS[role] || [],
    }));
  };

  const patch = (updates) => setForm((prev) => ({ ...prev, ...updates }));

  const reportError = (message) => {
    setFormError(message);
    onError?.(message);
    document.querySelector('[data-staff-form-top]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) {
      reportError(isAr ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    if (!isEdit && !form.username.trim()) {
      reportError(isAr ? 'اسم المستخدم مطلوب' : 'Username is required');
      return;
    }
    if (!isEdit && form.username.trim().length < 3) {
      reportError(isAr ? 'اسم المستخدم 3 أحرف على الأقل' : 'Username must be at least 3 characters');
      return;
    }
    if (!isEdit && form.password.length < 8) {
      reportError(isAr ? 'كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (!isEdit && form.password !== form.confirmPassword) {
      reportError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (isEdit && form.password && form.password.length < 8) {
      reportError(isAr ? 'كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (!form.phone.trim() && isDriverRole) {
      reportError(isAr ? 'رقم الهاتف مطلوب لمندوب التوصيل' : 'Phone is required for delivery drivers');
      return;
    }
    if (form.useCustomPermissions && form.permissions.length === 0 && !isSuperAdminRole && !isDriverRole) {
      reportError(isAr ? 'اختر صلاحية واحدة على الأقل' : 'Select at least one permission');
      return;
    }

    let permissions = form.useCustomPermissions && !isSuperAdminRole && !isDriverRole ? [...form.permissions] : [];
    if (permissions.length && !permissions.includes('dashboard:read')) {
      permissions = ['dashboard:read', ...permissions];
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        role: form.role,
        useCustomPermissions: isSuperAdminRole || isDriverRole ? false : form.useCustomPermissions,
        permissions,
        isActive: form.isActive,
      };

      if (!isEdit) {
        payload.username = form.username.trim().toLowerCase();
        payload.password = form.password;
        const { data } = await adminApi.createStaffAccount(payload);
        setCreatedCredentials({
          username: data.credentials?.username || payload.username,
          password: form.password,
          portal: data.credentials?.portal || (form.role === 'driver' ? 'driver' : 'admin'),
        });
        onSuccess?.(isAr ? 'تم إنشاء حساب الفريق' : 'Team account created');
      } else {
        if (form.password) payload.password = form.password;
        await adminApi.updateStaffAccount(accountId, payload);
        onSuccess?.(isAr ? 'تم حفظ التغييرات' : 'Changes saved');
        onSaved?.();
        onClose();
      }
    } catch (err) {
      const message = err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Something went wrong');
      reportError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDoneAfterCreate = () => {
    onSaved?.();
    onClose();
  };

  return (
    <AdminSlidePanel
      open={open}
      onClose={onClose}
      isAr={isAr}
      width="max-w-2xl"
      title={isEdit
        ? (isAr ? 'تعديل حساب الفريق' : 'Edit team account')
        : (isAr ? 'إنشاء حساب فريق' : 'Create team account')}
      subtitle={isAr
        ? 'أنشئ حساباً باسم مستخدم وكلمة مرور وحدد صلاحيات الوصول'
        : 'Create a username/password account and choose access permissions'}
    >
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader size="md" />
        </div>
      ) : createdCredentials ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <Check className="h-5 w-5" />
            <h3 className="font-semibold">{isAr ? 'تم إنشاء الحساب' : 'Account created'}</h3>
          </div>
          <StaffCredentialsCard
            username={createdCredentials.username}
            password={createdCredentials.password}
            portal={createdCredentials.portal}
            isAr={isAr}
          />
          <Button type="button" className="w-full" onClick={handleDoneAfterCreate}>
            {isAr ? 'تم' : 'Done'}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div data-staff-form-top />
          {formError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
              {formError}
            </p>
          )}
          {accountMeta.isSelf && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              {isAr
                ? 'أنت تعدّل حسابك. يمكنك تغيير الاسم وكلمة المرور فقط — لا يمكنك تغيير دورك أو تعطيل حسابك.'
                : 'Editing your account. You can change name and password only — not your role or active status.'}
            </p>
          )}
          {!isEdit && isSuperAdminRole && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {ROLE_DESCRIPTIONS.super_admin[isAr ? 'ar' : 'en']}
            </p>
          )}
          <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <UserPlus className="h-4 w-4 text-orange-600" />
              {isAr ? 'معلومات الحساب' : 'Account details'}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={isAr ? 'الاسم الكامل' : 'Full name'}
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <div>
                <Input
                  label={isAr ? 'اسم المستخدم' : 'Username'}
                  value={form.username}
                  onChange={(e) => patch({ username: e.target.value.toLowerCase() })}
                  disabled={isEdit}
                  dir="ltr"
                />
                {!isEdit && (
                  <p className="mt-1 text-xs text-text-muted">
                    {isAr ? '3–32 حرفاً: a-z, 0-9, . _ -' : '3–32 chars: a-z, 0-9, . _ -'}
                  </p>
                )}
              </div>
              <Input
                label={isAr ? 'البريد (اختياري)' : 'Email (optional)'}
                type="email"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                dir="ltr"
              />
              <Input
                label={isDriverRole
                  ? (isAr ? 'الهاتف (مطلوب للمندوب)' : 'Phone (required for driver)')
                  : (isAr ? 'الهاتف (اختياري)' : 'Phone (optional)')}
                value={form.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                dir="ltr"
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <KeyRound className="h-4 w-4 text-orange-600" />
              {isEdit
                ? (isAr ? 'كلمة مرور جديدة (اختياري)' : 'New password (optional)')
                : (isAr ? 'كلمة المرور' : 'Password')}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative">
                <Input
                  label={isAr ? 'كلمة المرور' : 'Password'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => patch({ password: e.target.value })}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute end-3 top-[2.15rem] text-text-muted hover:text-text"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!isEdit && (
                <Input
                  label={isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => patch({ confirmPassword: e.target.value })}
                  dir="ltr"
                  autoComplete="new-password"
                />
              )}
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Shield className="h-4 w-4 text-orange-600" />
              {isAr ? 'الدور والصلاحيات' : 'Role & permissions'}
            </h3>

            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-text-muted">
              {isAr
                ? 'اختر دور لوحة تحكم واحد، أو «مندوب» لوصول ميداني بدون لوحة تحكم. راجع صفحة «الأدوار والصلاحيات» لتفاصيل كل دور.'
                : 'Pick one admin-panel role, or “Driver” for field access with no panel. See the Roles & permissions tab for what each one can do.'}
            </p>

            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {isAr ? 'دور لوحة التحكم' : 'Admin panel role'}
            </p>
            <div className="space-y-2">
              {['manager', 'admin', 'super_admin'].map((role) => {
                const guide = ROLE_GUIDE[role][isAr ? 'ar' : 'en'];
                const count = ROLE_PRESET_PERMISSIONS[role]?.length ?? 0;
                return (
                  <RoleOptionCard
                    key={role}
                    selected={form.role === role && !form.useCustomPermissions}
                    disabled={isEdit && accountMeta.isSelf}
                    title={roleLabel(role, isAr)}
                    summary={guide.summary}
                    bestFor={guide.bestFor}
                    permCount={count}
                    permLabel={isAr ? 'صلاحية' : 'perms'}
                    onClick={() => applyRolePreset(role)}
                  />
                );
              })}
              <RoleOptionCard
                selected={form.useCustomPermissions}
                disabled={(isEdit && accountMeta.isSelf) || isSuperAdminRole || isDriverRole}
                title={isAr ? 'صلاحيات مخصصة' : 'Custom access'}
                summary={ROLE_GUIDE.custom[isAr ? 'ar' : 'en'].summary}
                bestFor={ROLE_GUIDE.custom[isAr ? 'ar' : 'en'].bestFor}
                permCount={form.useCustomPermissions ? effectivePermissions.length : null}
                permLabel={isAr ? 'محددة' : 'picked'}
                onClick={() => patch({
                  useCustomPermissions: true,
                  permissions: form.permissions.length
                    ? form.permissions
                    : ROLE_PRESET_PERMISSIONS[form.role] || [],
                })}
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {isAr ? 'وصول ميداني' : 'Field access'}
            </p>
            <div className="space-y-2">
              <RoleOptionCard
                selected={isDriverRole}
                disabled={isEdit && accountMeta.isSelf}
                title={roleLabel('driver', isAr)}
                summary={ROLE_GUIDE.driver[isAr ? 'ar' : 'en'].summary}
                bestFor={ROLE_GUIDE.driver[isAr ? 'ar' : 'en'].bestFor}
                permCount={null}
                permLabel=""
                onClick={() => applyRolePreset('driver')}
              />
            </div>

            {isDriverRole && (
              <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                {isAr
                  ? 'مندوب التوصيل يدخل من /driver/login ويرى الطلبات المعيّنة له فقط. عيّنه من صفحة الطلبات ثم يبدأ مشاركة الموقع المباشر.'
                  : 'Drivers sign in at /driver/login and only see orders assigned to them. Assign from Orders, then they start live GPS sharing.'}
              </p>
            )}

            {form.useCustomPermissions && !isSuperAdminRole && !isDriverRole && (
              <PermissionMatrix
                isAr={isAr}
                selected={form.permissions}
                onChange={(permissions) => patch({ permissions })}
              />
            )}

            <label className="flex items-center gap-3 rounded-xl border border-border bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
                disabled={accountMeta.isSelf}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
              />
              <span className="text-sm text-text">
                {isAr ? 'الحساب نشط — يمكنه تسجيل الدخول' : 'Account active — can sign in'}
              </span>
            </label>
          </section>

          <div className="flex gap-3 border-t border-border pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving
                ? (isAr ? 'جاري الحفظ...' : 'Saving...')
                : (isEdit ? (isAr ? 'حفظ' : 'Save') : (isAr ? 'إنشاء الحساب' : 'Create account'))}
            </Button>
          </div>
        </form>
      )}
    </AdminSlidePanel>
  );
}
