import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, CheckCircle2, Crown, Download, Mail, MessageSquareOff, Shield, ShieldOff, ShoppingBag, Sparkles,
  Truck, UserPlus, UserCircle, Users, Wallet, Hourglass,
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
import {
  ASSIGNABLE_ROLES, CUSTOMER_PAGE_ROLES, hasPermission, roleLabel, STAFF_ROLES,
} from '../adminPermissions';
import { downloadBlob } from '../utils/downloadBlob';
import { formatDate, formatMoneyLatin, formatRelativeTime } from '../../utils/formatters';
import { formatLocalPhoneDisplay } from '../../utils/phoneHelpers';

const ACCOUNT_TABS = [
  { value: '', icon: Users },
  { value: 'customer', icon: UserCircle },
  { value: 'staff', icon: Shield },
  { value: 'driver', icon: Truck },
];

/** Ready-made customer groups — rules live in the backend (USER_SEGMENTS in user.controller.js). */
const SEGMENTS = [
  {
    value: 'vip', icon: Crown, ar: 'كبار العملاء', en: 'VIP', hintAr: 'أنفقوا 5,000 ج.م أو أكثر', hintEn: 'Spent 5,000 EGP or more',
  },
  {
    value: 'no_orders', icon: ShoppingBag, ar: 'لم يطلبوا بعد', en: 'Never ordered', hintAr: 'سجّلوا ولم يطلبوا', hintEn: 'Signed up, no orders yet',
  },
  {
    value: 'at_risk', icon: Hourglass, ar: 'مهددون بالانقطاع', en: 'At risk', hintAr: 'لا طلبات منذ 60 يوماً', hintEn: 'No order in 60 days',
  },
  {
    value: 'wallet', icon: Wallet, ar: 'رصيد في المحفظة', en: 'Wallet balance', hintAr: 'لديهم رصيد', hintEn: 'Have wallet money',
  },
  {
    value: 'review_blocked', icon: MessageSquareOff, ar: 'تقييمات محظورة', en: 'Reviews blocked', hintAr: 'ممنوعون من التقييم', hintEn: 'Blocked from reviewing',
  },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const EMPTY_SUMMARY = {
  total: 0, customers: 0, staff: 0, drivers: 0, suspended: 0, newThisMonth: 0, verified: 0, noOrders: 0,
};

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

function InsightPill({
  icon: Icon, label, value, tone = 'slate', onClick,
}) {
  const tones = {
    slate: 'text-slate-500',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`flex items-center gap-2.5 rounded-xl border border-border bg-white px-3.5 py-2.5 text-start ${onClick ? 'transition-colors hover:border-primary-200 hover:bg-primary-50/30' : ''}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${tones[tone]}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold tabular-nums text-text">{value}</p>
        <p className="truncate text-[11px] text-text-muted">{label}</p>
      </div>
    </Tag>
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

const money = (n, isAr) => `${formatMoneyLatin(n || 0, { maximumFractionDigits: 0 })} ${isAr ? 'ج.م' : 'EGP'}`;
const count = (n) => formatMoneyLatin(n || 0, { maximumFractionDigits: 0 });

export default function UsersPage() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canManageUsers = hasPermission(currentUser, 'users:write');
  const currentUserId = currentUser?._id || currentUser?.id;
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [detailUserId, setDetailUserId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchUsers = useCallback((params) => adminApi.getUsers(params), []);

  const list = useAdminListPage({
    fetchFn: fetchUsers,
    initialFilters: {
      role: '', accountType: '', status: '', verified: '', joinedWithin: '', segment: '',
    },
    syncUrl: true,
  });

  const loadSummary = useCallback(() => {
    adminApi.getUsersSummary()
      .then(({ data }) => setSummary({ ...EMPTY_SUMMARY, ...data.data }))
      .catch(() => {});
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  /** After any change: refresh the rows and the headline counts. */
  const refresh = () => {
    list.reload();
    loadSummary();
  };

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

  const toggleSegment = (segment) => {
    list.patchFilters({ segment: list.filters.segment === segment ? '' : segment });
  };

  const emptyCopy = useMemo(() => {
    if (list.q.trim() || list.filters.segment) {
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
  }, [activeTab, isAr, list.q, list.filters.segment]);

  const runBulk = async (action) => {
    const labels = {
      delete: { title: isAr ? 'حذف المستخدمين' : 'Delete users', confirm: isAr ? 'حذف' : 'Delete', done: isAr ? 'تم الحذف' : 'Deleted', variant: 'danger' },
      suspend: { title: isAr ? 'إيقاف الحسابات' : 'Suspend accounts', confirm: isAr ? 'إيقاف' : 'Suspend', done: isAr ? 'تم الإيقاف' : 'Suspended', variant: 'danger' },
      activate: { title: isAr ? 'إعادة تفعيل الحسابات' : 'Reactivate accounts', confirm: isAr ? 'تفعيل' : 'Reactivate', done: isAr ? 'تم التفعيل' : 'Reactivated', variant: 'primary' },
      signout: { title: isAr ? 'تسجيل الخروج من كل الأجهزة' : 'Sign out everywhere', confirm: isAr ? 'تسجيل خروج' : 'Sign out', done: isAr ? 'تم تسجيل الخروج' : 'Signed out', variant: 'primary' },
      verify_phone: { title: isAr ? 'توثيق الهاتف' : 'Mark phones verified', confirm: isAr ? 'توثيق' : 'Verify', done: isAr ? 'تم التوثيق' : 'Phones verified', variant: 'primary' },
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
      const { data } = await adminApi.bulkUsers(list.selectedIds, action);
      list.clearSelection();
      refresh();
      toast.success(cfg.done);
      if (data?.skipped?.length) {
        toast.error(isAr
          ? `لم يُحذف ${data.skipped.length} حساب (رصيد في المحفظة أو حساب بائع)`
          : `${data.skipped.length} account(s) not deleted: ${data.skipped[0].reason}`);
      }
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
      refresh();
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
      refresh();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const handleDeleteOne = async (id) => {
    const ok = await confirm({
      title: isAr ? 'حذف المستخدم' : 'Delete user',
      message: isAr
        ? 'إذا كان للعميل طلبات سابقة، تُمسح بياناته الشخصية ويُحتفظ بسجل الطلبات.'
        : 'If this customer has past orders, their personal details are erased and the order history is kept.',
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const { data } = await adminApi.deleteUser(id);
      if (detailUserId === id) setDetailUserId(null);
      refresh();
      toast.success(data?.outcome === 'anonymized'
        ? (isAr ? 'تم مسح البيانات الشخصية مع الاحتفاظ بالطلبات' : 'Personal details erased — order history kept')
        : (isAr ? 'تم الحذف' : 'Deleted'));
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const handleCreateUser = async (payload) => {
    setCreating(true);
    try {
      const res = await adminApi.createUser(payload);
      setAddOpen(false);
      refresh();
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const { page: _page, limit: _limit, ...params } = list.queryParams;
      const { data } = await adminApi.exportUsers(params);
      downloadBlob(data, `customers-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toolbarActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting} className="gap-1.5">
        <Download className="h-4 w-4" />
        {exporting ? (isAr ? 'جاري التصدير…' : 'Exporting…') : (isAr ? 'تصدير CSV' : 'Export CSV')}
      </Button>
      {canManageUsers && (
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm">
          <UserPlus className="h-4 w-4" />
          {isAr ? 'إضافة مستخدم' : 'Add user'}
        </Button>
      )}
    </div>
  );

  const orderStatsCell = (u) => (
    u.orderCount ? (
      <div className="text-sm">
        <span className="font-semibold tabular-nums text-text">{u.orderCount}</span>
        <span className="ms-1.5 text-xs text-text-muted">· {money(u.totalSpent, isAr)}</span>
      </div>
    ) : (
      <span className="text-xs text-text-muted">{isAr ? 'لا طلبات' : 'No orders'}</span>
    )
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
      key: 'orderCount',
      header: isAr ? 'الطلبات' : 'Orders',
      sortKey: 'orderCount',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (u) => (
        u.orderCount ? (
          <span className="font-semibold tabular-nums text-text">{u.orderCount}</span>
        ) : (
          <span className="text-xs text-text-muted">{isAr ? 'لا طلبات' : 'None'}</span>
        )
      ),
    },
    {
      key: 'totalSpent',
      header: isAr ? 'إجمالي الإنفاق' : 'Spent',
      sortKey: 'totalSpent',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden lg:table-cell',
      render: (u) => (
        u.totalSpent > 0 ? (
          <div className="text-sm">
            <p className="tabular-nums text-text">{money(u.totalSpent, isAr)}</p>
            <p className="text-xs text-text-muted">
              {isAr ? 'متوسط' : 'avg'} {money(u.avgOrderValue, isAr)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )
      ),
    },
    {
      key: 'lastOrderAt',
      header: isAr ? 'آخر طلب' : 'Last order',
      sortKey: 'lastOrderAt',
      headerClassName: 'hidden xl:table-cell',
      cellClassName: 'hidden xl:table-cell',
      render: (u) => (
        <span className="text-sm text-text-muted">
          {u.lastOrderAt ? formatRelativeTime(u.lastOrderAt, isAr) : '—'}
        </span>
      ),
    },
    {
      key: 'pointsBalance',
      header: isAr ? 'نقاط الولاء' : 'Loyalty',
      sortKey: 'pointsBalance',
      headerClassName: 'hidden 2xl:table-cell',
      cellClassName: 'hidden 2xl:table-cell',
      render: (u) => (
        <span className="text-sm tabular-nums text-text">{count(u.pointsBalance)}</span>
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
      headerClassName: 'hidden 2xl:table-cell',
      cellClassName: 'hidden 2xl:table-cell',
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
        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
          {roleLabel(u.role, isAr)}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: isAr ? 'آخر نشاط' : 'Last active',
      sortKey: 'lastLoginAt',
      headerClassName: 'hidden 2xl:table-cell',
      cellClassName: 'hidden 2xl:table-cell',
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
        <span className="whitespace-nowrap text-sm text-text-muted">
          {u.createdAt ? formatDate(u.createdAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
        </span>
      ),
    },
  ];

  const renderMobileCard = (u) => (
    <div className="flex items-start gap-3">
      <UserAvatar name={u.name} size="sm" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate font-medium text-text">{u.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
            {roleLabel(u.role, isAr)}
          </span>
        </div>
        {u.phone && (
          <p dir="ltr" className="text-start font-mono text-xs text-text-muted">
            {formatLocalPhoneDisplay(u.phone) || u.phone}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <UserStatusBadge user={u} isAr={isAr} />
          {orderStatsCell(u)}
        </div>
      </div>
    </div>
  );

  const rowActions = (u) => {
    const isStaff = STAFF_ROLES.includes(u.role);
    const isSelf = u._id === currentUserId;
    const suspended = resolveUserStatus(u) === 'suspended';
    const actions = [
      {
        label: isAr ? 'عرض التفاصيل' : 'View details',
        onClick: () => setDetailUserId(u._id),
      },
    ];

    if (canManageUsers && !isSelf) {
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
              ? `${u.name} لن يستطيع تسجيل الدخول حتى إعادة التفعيل، وسيتم تسجيل خروجه من كل الأجهزة.`
              : `${u.name} will be signed out everywhere and cannot sign in until reactivated.`,
            confirmLabel: isAr ? 'إيقاف' : 'Suspend',
            variant: 'danger',
          }),
        });
      }

      if (!u.isPhoneVerified && u.phone) {
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

      (CUSTOMER_PAGE_ROLES.includes(u.role) ? CUSTOMER_PAGE_ROLES.filter((r) => r !== u.role) : []).forEach((r) => {
        actions.push({
          label: isAr ? `تعيين ${roleLabel(r, true)}` : `Set as ${roleLabel(r, false)}`,
          onClick: () => changeRole(u, r),
        });
      });
    }

    if (isSuperAdmin && CUSTOMER_PAGE_ROLES.includes(u.role) && !isSelf) {
      actions.push({
        label: isAr ? 'حذف' : 'Delete',
        danger: true,
        onClick: () => handleDeleteOne(u._id),
      });
    }

    return actions;
  };

  return (
    <>
      <p className="mb-5 max-w-xl text-sm text-text-muted">
        {isAr
          ? 'إدارة العملاء والمناديب — أضف حساباً برقم الهاتف كما لو سجّل المستخدم بنفسه.'
          : 'Manage customers and drivers — add accounts by phone as if they signed up themselves.'}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {ACCOUNT_TABS.map(({ value, icon }) => (
          <SummaryCard
            key={value || 'all'}
            icon={icon}
            label={tabLabels[value]}
            value={count(summaryValues[value])}
            active={activeTab === value}
            onClick={() => setAccountType(value)}
          />
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <InsightPill
          icon={Sparkles}
          tone="emerald"
          label={isAr ? 'انضموا هذا الشهر' : 'Joined this month'}
          value={count(summary.newThisMonth)}
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
          value={count(summary.suspended)}
          onClick={() => list.patchFilters({ status: list.filters.status === 'suspended' ? '' : 'suspended' })}
        />
        <InsightPill
          icon={ShoppingBag}
          tone={summary.noOrders ? 'amber' : 'slate'}
          label={isAr ? 'عملاء لم يطلبوا بعد' : 'Customers who never ordered'}
          value={count(summary.noOrders)}
          onClick={() => toggleSegment('no_orders')}
        />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={isAr ? 'مجموعات العملاء' : 'Customer groups'}>
        {SEGMENTS.map(({
          value, icon: Icon, ar, en, hintAr, hintEn,
        }) => {
          const active = list.filters.segment === value;
          return (
            <button
              key={value}
              type="button"
              title={isAr ? hintAr : hintEn}
              aria-pressed={active}
              onClick={() => toggleSegment(value)}
              className={[
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'border-primary-500 bg-primary-600 text-white'
                  : 'border-border bg-white text-text-muted hover:border-primary-200 hover:text-text',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {isAr ? ar : en}
            </button>
          );
        })}
      </div>

      <AdminListPage
        isAr={isAr}
        actions={toolbarActions}
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
            <ListFilterSelect
              label={isAr ? 'لكل صفحة' : 'Per page'}
              value={String(list.pageSize)}
              onChange={(n) => list.setPageSize(Number(n))}
              className="min-w-0"
              options={PAGE_SIZE_OPTIONS.map((n) => ({
                value: String(n),
                label: isAr ? `${n} لكل صفحة` : `${n} per page`,
              }))}
            />
          </>
        )}
        bulkBar={canManageUsers ? (
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            showActivate
            onActivate={() => runBulk('activate')}
            onDeactivate={() => runBulk('suspend')}
            onDelete={isSuperAdmin ? () => runBulk('delete') : undefined}
            onClear={list.clearSelection}
            extraActions={(
              <>
                <Button size="sm" variant="secondary" onClick={() => runBulk('signout')}>
                  {isAr ? 'تسجيل خروج' : 'Sign out'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => runBulk('verify_phone')}>
                  {isAr ? 'توثيق الهاتف' : 'Verify phone'}
                </Button>
              </>
            )}
          />
        ) : null}
        columns={columns}
        renderMobileCard={renderMobileCard}
        data={list.data}
        loading={list.loading}
        selectable={canManageUsers}
        selectedIds={list.selectedIds}
        onToggleSelect={list.toggleSelect}
        onToggleSelectAll={list.toggleSelectAll}
        allSelected={list.allSelected}
        onRowClick={(u) => setDetailUserId(u._id)}
        rowActions={rowActions}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Users}
        emptyTitle={emptyCopy.title}
        emptyDescription={emptyCopy.description}
        emptyAction={canManageUsers && activeTab !== 'staff' && !list.filters.segment ? (
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
        canManage={canManageUsers}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUserId}
        onUpdated={refresh}
        onDelete={(u) => handleDeleteOne(u._id)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </>
  );
}
