import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Shield, Truck, UserPlus, UserCircle, Users } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import UserDetailPanel, { UserAvatar, ROLE_COLORS } from '../components/UserDetailPanel';
import AddUserModal from '../components/AddUserModal';
import Button from '../../components/ui/Button';
import { ASSIGNABLE_ROLES, hasPermission, roleLabel, STAFF_ROLES } from '../adminPermissions';
import { formatDate } from '../../utils/formatters';
import { formatLocalPhoneDisplay } from '../../utils/phoneHelpers';

const ACCOUNT_TABS = [
  { value: '', icon: Users },
  { value: 'customer', icon: UserCircle },
  { value: 'staff', icon: Shield },
  { value: 'driver', icon: Truck },
];

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

export default function UsersPage() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const canManageUsers = hasPermission(currentUser, 'users:write');
  const [summary, setSummary] = useState({ total: 0, customers: 0, staff: 0, drivers: 0 });
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
    initialFilters: { role: '', accountType: '' },
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

  const runBulkDelete = async () => {
    const ok = await confirm({
      title: isAr ? 'حذف المستخدمين' : 'Delete users',
      message: isAr ? `حذف ${list.selectedIds.length} مستخدم؟` : `Delete ${list.selectedIds.length} users?`,
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    try {
      await adminApi.bulkUsers(list.selectedIds, 'delete');
      list.clearSelection();
      list.reload();
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
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

  const handleDeleteOne = async (id) => {
    const ok = await confirm({
      title: isAr ? 'حذف المستخدم' : 'Delete user',
      confirmLabel: isAr ? 'حذف' : 'Delete',
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
    <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shadow-sm">
      <UserPlus className="h-4 w-4" />
      {isAr ? 'إضافة مستخدم' : 'Add user'}
    </Button>
  ) : null;

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
      key: 'email',
      header: isAr ? 'البريد' : 'Email',
      sortKey: 'email',
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <AdminListPage
        isAr={isAr}
        actions={addUserAction}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث بالاسم أو الهاتف…' : 'Search name or phone…'}
        sort={list.sort}
        onSort={list.toggleSort}
        filters={(
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
        )}
        bulkBar={isSuperAdmin ? (
          <BulkActionsBar
            count={list.selectedIds.length}
            isAr={isAr}
            showActivate={false}
            onDelete={runBulkDelete}
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
          const isSelf = u._id === currentUser?._id || u._id === currentUser?.id;
          const actions = [
            {
              label: isAr ? 'عرض التفاصيل' : 'View details',
              onClick: () => setDetailUserId(u._id),
            },
          ];

          if (isSuperAdmin && !isSelf) {
            ASSIGNABLE_ROLES.filter((r) => r !== u.role).forEach((r) => {
              actions.push({
                label: isAr ? `تعيين ${roleLabel(r, true)}` : `Set as ${roleLabel(r, false)}`,
                onClick: () => changeRole(u, r),
              });
            });
          }

          if (isSuperAdmin && !isStaff) {
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
        currentUserId={currentUser?._id || currentUser?.id}
        onUpdated={() => list.reload()}
        onDelete={(u) => handleDeleteOne(u._id)}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </>
  );
}
