import { useCallback, useMemo, useState } from 'react';
import {
  BadgeCheck, CheckCircle2, Mail, Shield, ShieldOff, Sparkles, Truck, UserPlus, UserCircle, Users,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import UserDetailPanel, { UserAvatar, ROLE_COLORS } from '../components/UserDetailPanel';
import UserStatusBadge, { resolveUserStatus } from '../components/UserStatusBadge';
import AddUserModal from '../components/AddUserModal';
import Button from '../../components/ui/Button';
import { ASSIGNABLE_ROLES, hasPermission, roleLabel, STAFF_ROLES } from '../adminPermissions';
import { formatDate, formatMoneyLatin, formatRelativeTime } from '../../utils/formatters';
import { formatLocalPhoneDisplay } from '../../utils/phoneHelpers';

const ACCOUNT_TABS = [
  { value: '', icon: Users },
  { value: 'customer', icon: UserCircle },
  { value: 'staff', icon: Shield },
  { value: 'driver', icon: Truck },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

function SummaryCard({ label, value, active, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group rounded-2xl border px-4 py-3.5 text-start transition-all',
        active
          ? 'border-primary-400 bg-primary-50 shadow-sm ring-1 ring-primary-100'
          : 'border-border bg-white hover:border-primary-200 hover:bg-primary-50/30',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={[
          'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-700',
        ].join(' ')}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
      </div>
      <p className={`mt-2 text-xs font-semibold ${active ? 'text-primary-800' : 'text-text-muted'}`}>{label}</p>
    </button>
  );
}

function InsightPill({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-500',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${tones[tone]}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold tabular-nums text-text">{value}</p>
        <p className="truncate text-[11px] text-text-muted">{label}</p>
      </div>
    </div>
  );
}

function resolveActiveTab(filters) {
  if (filters.accountType) return filters.accountType;
  if (filters.role === 'user') return 'customer';
  if (filters.role === 'driver') return 'driver';
  if (filters.role && STAFF_ROLES.includes(filters.role)) return 'staff';
  return '';
}

function defaultRoleForTab(activeTab) {
  if (activeTab === 'driver') return 'driver';
  return 'user';
}

const money = (n, isAr) => `${formatMoneyLatin(n, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;

export default function UsersPage() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canManageUsers = hasPermission(currentUser, 'users:write');
  const currentUserId = currentUser?._id || currentUser?.id;
  const [summary, setSummary] = useState({
    total: 0, customers: 0, staff: 0, drivers: 0, suspended: 0, newThisMonth: 0, verified: 0,
  });
  const [detailUserId, setDetailUserId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async (params) => {
    const res = await adminApi.getUsers(params);
    if (res.data.summary) setSummary(res.data.summary);
    return res;
  }, []);

  const list = useAdminListPage({
    fetchFn: fetchUsers,
    initialFilters: { role: '', accountType: '', status: '', verified: '', joinedWithin: '' },
  });

  const activeTab = resolveActiveTab(list.filters);

  const tabLabels = {
    '': isAr ? 'الكل' : 'All',
    customer: isAr ? 'العملاء' : 'Customers',
    staff: isAr ? 'الموظفون' : 'Staff',
    driver: isAr ? 'المناديب' : 'Drivers',
  };

  const summaryValues = {
    '': summary.total,
    customer: summary.customers,
    staff: summary.staff,
    driver: summary.drivers,
  };

  const verifiedPct = summary.total ? Math.round((summary.verified / summary.total) * 100) : 0;

  const setAccountType = (accountType) => {
    list.patchFilters({ accountType, role: '' });
  };

  const setRoleFilter = (role) => {
    list.patchFilters({ role, accountType: '' });
  };

  const emptyCopy = useMemo(() => {
    if (list.q.trim()) {
      return {
        title: isAr ? 'لا توجد نتائج' : 'No results',
        description: isAr ? 'جرّب كلمة بحث أو فلتر مختلف' : 'Try a different search or filter',
      };
    }
    if (activeTab === 'customer') {
      return {
        title: isAr ? 'لا يوجد عملاء' : 'No customers yet',
        description: isAr ? 'أضف عميلاً برقم هاتفه ليبدأ التسوق' : 'Add a customer by phone so they can start shopping',
      };
    }
    if (activeTab === 'driver') {
      return {
        title: isAr ? 'لا يوجد مناديب' : 'No drivers yet',
        description: isAr ? 'أضف مندوب توصيل برقم هاتفه' : 'Add a delivery driver with their phone number',
      };
    }
    if (activeTab === 'staff') {
      return {
        title: isAr ? 'لا يوجد موظفون' : 'No staff here',
        description: isAr ? 'حسابات الفريق تُدار من صفحة فريق الإدارة' : 'Team accounts are managed in Admin team',
      };
    }
    return {
      title: isAr ? 'لا يوجد مستخدمون' : 'No users yet',
      description: isAr ? 'أضف مستخدماً برقم الهاتف' : 'Add a user with their phone number',
    };
  }, [activeTab, isAr, list.q]);

  const runBulk = async (action) => {
    const labels = {
      delete: { title: isAr ? 'حذف المستخدمين' : 'Delete users', confirm: isAr ? 'حذف' : 'Delete', done: isAr ? 'تم الحذف' : 'Deleted', variant: 'danger' },
      suspend: { title: isAr ? 'إيقاف الحسابات' : 'Suspend accounts', confirm: isAr ? 'إيقاف' : 'Suspend', done: isAr ? 'تم الإيقاف' : 'Suspended', variant: 'danger' },
      activate: { title: isAr ? 'إعادة تفعيل الحسابات' : 'Reactivate accounts', confirm: isAr ? 'تفعيل' : 'Reactivate', done: isAr ? 'تم التفعيل' : 'Reactivated', variant: 'primary' },
    };
    const cfg = labels[action];
    const ok = await confirm({
      title: cfg.title,
      message: isAr
        ? `${cfg.confirm} ${list.selectedIds.length} حساب؟`
        : `${cfg.confirm} ${list.selectedIds.length} accounts?`,
      confirmLabel: cfg.confirm,
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: cfg.variant,
    });
    if (!ok) return;
    try {
      await adminApi.bulkUsers(list.selectedIds, action);
      list.clearSelection();
      list.reload();
      toast.success(cfg.done);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const changeRole = async (targetUser, newRole) => {
    const ok = await confirm({
      title: isAr ? 'تغيير الدور' : 'Change role',
      message: isAr
        ? `تغيير دور ${targetUser.name} إلى ${roleLabel(newRole, true)}؟`
        : `Change ${targetUser.name}'s role to ${roleLabel(newRole, false)}?`,
      confirmLabel: isAr ? 'تأكيد' : 'Confirm',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      await adminApi.updateUser(targetUser._id, { role: newRole });
      list.reload();
      toast.success(isAr ? 'تم تحديث الدور' : 'Role updated');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const patchUser = async (targetUser, patch, successMsg, confirmCfg) => {
    if (confirmCfg) {
      const ok = await confirm({
        confirmLabel: isAr ? 'تأكيد' : 'Confirm',
        cancelLabel: isAr ? 'إلغاء' : 'Cancel',
        ...confirmCfg,
      });
      if (!ok) return;
    }
    try {
      await adminApi.updateUser(targetUser._id, patch);
      list.reload();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const handleDeleteOne = async (id) => {
    const ok = await confirm({
      title: isAr ? 'حذف المستخدم' : 'Delete user',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await adminApi.deleteUser(id);
      if (detailUserId === id) setDetailUserId(null);
      list.reload();
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  };

  const handleCreateUser = async (payload) => {
    setCreating(true);
    try {
      const res = await adminApi.createUser(payload);
      setAddOpen(false);
      list.reload();
      const created = res.data?.data;
      if (created?.id) setDetailUserId(created.id);
      toast.success(
        isAr
          ? `تم إنشاء حساب ${roleLabel(created?.role || payload.role, true)}`
          : `${roleLabel(created?.role || payload.role, false)} account created`,
      );
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذّر إنشاء الحساب' : 'Could not create account'));
    } finally {
      setCreating(false);
    }
  };

  const addUserAction = canManageUsers ? (
    <div className="flex items-center gap-2">
      <label className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
        {isAr ? 'لكل صفحة' : 'Per page'}
        <select
          value={list.pageSize}
          onChange={(e) => list.setPageSize(Number(e.target.value))}
          className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm">
        <UserPlus className="h-4 w-4" />
        {isAr ? 'إضافة مستخدم' : 'Add user'}
      </Button>
    </div>
  ) : (
    <label className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
      {isAr ? 'لكل صفحة' : 'Per page'}
      <select
        value={list.pageSize}
        onChange={(e) => list.setPageSize(Number(e.target.value))}
        className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
      >
        {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );

  const columns = [
    {
      key: 'name',
      header: isAr ? 'الاسم' : 'Name',
      sortKey: 'name',
      render: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={u.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{u.name}</p>
            {u.isPhoneVerified && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                {isAr ? 'هاتف موثّق' : 'Phone verified'}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: isAr ? 'الهاتف' : 'Phone',
      render: (u) => (
        u.phone ? (
          <span dir="ltr" className="inline-block rounded-lg bg-slate-50 px-2 py-0.5 font-mono text-sm text-text">
            {formatLocalPhoneDisplay(u.phone) || u.phone}
          </span>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )
      ),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (u) => <UserStatusBadge user={u} isAr={isAr} />,
    },
    {
      key: 'activity',
      header: isAr ? 'الطلبات' : 'Orders',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (u) => (
        u.orderCount ? (
          <div className="text-sm">
            <span className="font-semibold tabular-nums text-text">{u.orderCount}</span>
            <span className="ms-1.5 text-xs text-text-muted">· {money(u.totalSpent, isAr)}</span>
          </div>
        ) : (
          <span className="text-xs text-text-muted">{isAr ? 'لا طلبات' : 'No orders'}</span>
        )
      ),
    },
    {
      key: 'pointsBalance',
      header: isAr ? 'نقاط الولاء' : 'Loyalty',
      sortKey: 'pointsBalance',
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (u) => (
        <span className="text-sm tabular-nums text-text">{formatMoneyLatin(u.pointsBalance || 0, { maximumFractionDigits: 0 })}</span>
      ),
    },
    {
      key: 'walletBalance',
      header: isAr ? 'المحفظة' : 'Wallet',
      sortKey: 'walletBalance',
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (u) => (
        (u.walletBalance || 0) > 0
          ? <span className="text-sm tabular-nums text-text">{money(u.walletBalance, isAr)}</span>
          : <span className="text-xs text-text-muted">—</span>
      ),
    },
    {
      key: 'email',
      header: isAr ? 'البريد' : 'Email',
      sortKey: 'email',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (u) => (
        u.email ? (
          <span dir="ltr" className="inline-block text-sm">{u.email}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-text-muted">
            <Mail className="h-3.5 w-3.5 opacity-50" />
            {isAr ? 'غير مضاف' : 'Not set'}
          </span>
        )
      ),
    },
    {
      key: 'role',
      header: isAr ? 'الدور' : 'Role',
      render: (u) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
          {roleLabel(u.role, isAr)}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: isAr ? 'آخر نشاط' : 'Last active',
      sortKey: 'lastLoginAt',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (u) => (
        <span className="text-sm text-text-muted">
          {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt, isAr) : (isAr ? 'لم يسجّل الدخول' : 'Never')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: isAr ? 'تاريخ الانضمام' : 'Joined',
      sortKey: 'createdAt',
      render: (u) => (
        <span className="text-sm text-text-muted">
          {u.createdAt ? formatDate(u.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-text-muted">
          {isAr
            ? 'إدارة العملاء والمناديب — أضف حساباً برقم الهاتف كما لو سجّل المستخدم بنفسه.'
            : 'Manage customers and drivers — add accounts by phone as if they signed up themselves.'}
        </p>
        {canManageUsers && (
          <Button onClick={() => setAddOpen(true)} className="gap-2 self-start sm:self-auto">
            <UserPlus className="h-4 w-4" />
            {isAr ? 'إضافة مستخدم' : 'Add user'}
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ACCOUNT_TABS.map(({ value, icon }) => (
          <SummaryCard
            key={value || 'all'}
            icon={icon}
            label={tabLabels[value]}
            value={summaryValues[value]}
            active={activeTab === value}
            onClick={() => setAccountType(value)}
          />
        ))}
      </div>

      <div className="mb-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <InsightPill
          icon={Sparkles}
          tone="emerald"
          label={isAr ? 'انضموا هذا الشهر' : 'Joined this month'}
          value={formatMoneyLatin(summary.newThisMonth, { maximumFractionDigits: 0 })}
        />
        <InsightPill
          icon={BadgeCheck}
          tone="slate"
          label={isAr ? 'نسبة توثيق الهاتف' : 'Phone verified'}
          value={`${verifiedPct}%`}
        />
        <InsightPill
          icon={ShieldOff}
          tone={summary.suspended ? 'red' : 'slate'}
          label={isAr ? 'حسابات موقوفة' : 'Suspended accounts'}
          value={formatMoneyLatin(summary.suspended, { maximumFractionDigits: 0 })}
        />
        <InsightPill
          icon={Users}
          tone="slate"
          label={isAr ? 'إجمالي المستخدمين' : 'Total users'}
          value={formatMoneyLatin(summary.total, { maximumFractionDigits: 0 })}
        />
      </div>

      <AdminListPage
        isAr={isAr}
        actions={addUserAction}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث بالاسم أو الهاتف أو البريد…' : 'Search name, phone or email…'}
        sort={list.sort}
        onSort={list.toggleSort}
        filters={(
          <>
            <ListFilterSelect
              label={isAr ? 'الدور' : 'Role'}
              value={list.filters.role}
              onChange={setRoleFilter}
              options={[
                { value: '', label: isAr ? 'كل الأدوار' : 'All roles' },
                ...ASSIGNABLE_ROLES.map((r) => ({
                  value: r,
                  label: roleLabel(r, isAr),
                })),
              ]}
            />
            <ListFilterSelect
              label={isAr ? 'الحالة' : 'Status'}
              value={list.filters.status}
              onChange={(status) => list.patchFilters({ status })}
              options={[
                { value: '', label: isAr ? 'كل الحالات' : 'Any status' },
                { value: 'active', label: isAr ? 'نشط' : 'Active' },
                { value: 'suspended', label: isAr ? 'موقوف' : 'Suspended' },
              ]}
            />
            <ListFilterSelect
              label={isAr ? 'توثيق الهاتف' : 'Verification'}
              value={list.filters.verified}
              onChange={(verified) => list.patchFilters({ verified })}
              options={[
                { value: '', label: isAr ? 'الكل' : 'Any' },
                { value: 'yes', label: isAr ? 'موثّق' : 'Verified' },
                { value: 'no', label: isAr ? 'غير موثّق' : 'Unverified' },
              ]}
            />
            <ListFilterSelect
              label={isAr ? 'تاريخ الانضمام' : 'Joined'}
              value={list.filters.joinedWithin}
              onChange={(joinedWithin) => list.patchFilters({ joinedWithin })}
              options={[
                { value: '', label: isAr ? 'أي وقت' : 'Any time' },
                { value: '7', label: isAr ? 'آخر 7 أيام' : 'Last 7 days' },
                { value: '30', label: isAr ? 'آخر 30 يوم' : 'Last 30 days' },
                { value: '90', label: isAr ? 'آخر 90 يوم' : 'Last 90 days' },
              ]}
            />
          </>
        )}
        bulkBar={isSuperAdmin ? (
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            showActivate
            onActivate={() => runBulk('activate')}
            onDeactivate={() => runBulk('suspend')}
            onDelete={() => runBulk('delete')}
            onClear={list.clearSelection}
          />
        ) : null}
        columns={columns}
        data={list.data}
        loading={list.loading}
        selectable={isSuperAdmin}
        selectedIds={list.selectedIds}
        onToggleSelect={list.toggleSelect}
        onToggleSelectAll={list.toggleSelectAll}
        allSelected={list.allSelected}
        onRowClick={(u) => setDetailUserId(u._id)}
        rowActions={(u) => {
          const isStaff = STAFF_ROLES.includes(u.role);
          const isSelf = u._id === currentUserId;
          const suspended = resolveUserStatus(u) === 'suspended';
          const actions = [
            {
              label: isAr ? 'عرض التفاصيل' : 'View details',
              onClick: () => setDetailUserId(u._id),
            },
          ];

          if (isSuperAdmin && !isSelf) {
            if (!isStaff) {
              actions.push(suspended ? {
                label: isAr ? 'إعادة تفعيل الحساب' : 'Reactivate account',
                onClick: () => patchUser(u, { isActive: true }, isAr ? 'تم تفعيل الحساب' : 'Account reactivated'),
              } : {
                label: isAr ? 'إيقاف الحساب' : 'Suspend account',
                danger: true,
                onClick: () => patchUser(u, { isActive: false }, isAr ? 'تم إيقاف الحساب' : 'Account suspended', {
                  title: isAr ? 'إيقاف الحساب' : 'Suspend account',
                  message: isAr
                    ? `${u.name} لن يستطيع تسجيل الدخول حتى إعادة التفعيل.`
                    : `${u.name} will not be able to sign in until reactivated.`,
                  confirmLabel: isAr ? 'إيقاف' : 'Suspend',
                  variant: 'danger',
                }),
              });
            }

            if (!u.isPhoneVerified) {
              actions.push({
                label: isAr ? 'تعيين الهاتف كموثّق' : 'Mark phone verified',
                onClick: () => patchUser(u, { isPhoneVerified: true }, isAr ? 'تم توثيق الهاتف' : 'Phone verified'),
              });
            }

            actions.push(u.reviewBlocked ? {
              label: isAr ? 'السماح بالتقييمات' : 'Unblock reviews',
              onClick: () => patchUser(u, { reviewBlocked: false }, isAr ? 'تم السماح بالتقييمات' : 'Reviews unblocked'),
            } : {
              label: isAr ? 'حظر التقييمات' : 'Block reviews',
              onClick: () => patchUser(u, { reviewBlocked: true }, isAr ? 'تم حظر التقييمات' : 'Reviews blocked'),
            });

            ASSIGNABLE_ROLES.filter((r) => r !== u.role).forEach((r) => {
              actions.push({
                label: isAr ? `تعيين ${roleLabel(r, true)}` : `Set as ${roleLabel(r, false)}`,
                onClick: () => changeRole(u, r),
              });
            });
          }

          if (isSuperAdmin && !isStaff && !isSelf) {
            actions.push({
              label: isAr ? 'حذف' : 'Delete',
              danger: true,
              onClick: () => handleDeleteOne(u._id),
            });
          }

          return actions;
        }}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Users}
        emptyTitle={emptyCopy.title}
        emptyDescription={emptyCopy.description}
        emptyAction={canManageUsers && activeTab !== 'staff' ? (
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {activeTab === 'driver'
              ? (isAr ? 'إضافة مندوب' : 'Add driver')
              : (isAr ? 'إضافة مستخدم' : 'Add user')}
          </Button>
        ) : null}
      />

      <AddUserModal
        open={addOpen}
        isAr={isAr}
        saving={creating}
        defaultRole={defaultRoleForTab(activeTab)}
        onClose={() => !creating && setAddOpen(false)}
        onSubmit={handleCreateUser}
      />

      <UserDetailPanel
        userId={detailUserId}
        open={Boolean(detailUserId)}
        onClose={() => setDetailUserId(null)}
        isAr={isAr}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUserId}
        onUpdated={() => list.reload()}
        onDelete={(u) => handleDeleteOne(u._id)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </>
  );
}
