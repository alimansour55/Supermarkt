import { useCallback, useState } from 'react';
import {
  Crown, KeyRound, Plus, ShieldAlert, ShieldCheck, UserCheck, UserCog, Users, UserX,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import StaffAccountEditorPanel from '../components/StaffAccountEditorPanel';
import StaffAccountDetailPanel from '../components/StaffAccountDetailPanel';
import { ROLE_BADGE_STYLES, roleLabel, resolveUserPermissions } from '../adminPermissions';
import { formatDate } from '../../utils/formatters';

function StatCard({ label, value, sub, icon: Icon, accent = 'orange' }) {
  const accents = {
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`rounded-2xl border p-4 ${accents[accent]}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
        {Icon && <Icon className="h-4 w-4 opacity-70" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-75">{sub}</p>}
    </div>
  );
}

function RoleBadge({ role, isAr }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700'}`}>
      {role === 'super_admin' && <Crown className="h-3 w-3" />}
      {roleLabel(role, isAr)}
    </span>
  );
}

export default function TeamPage() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const currentUserId = currentUser?._id || currentUser?.id;

  const [summary, setSummary] = useState({
    total: 0, active: 0, inactive: 0, superAdmins: 0, admins: 0, managers: 0, drivers: 0,
  });
  const [detailId, setDetailId] = useState(null);
  const [editorId, setEditorId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState(null);

  const fetchStaff = useCallback(async (params) => {
    const res = await adminApi.getStaffAccounts(params);
    if (res.data.summary) setSummary(res.data.summary);
    return res;
  }, []);

  const list = useAdminListPage({
    fetchFn: fetchStaff,
    initialFilters: { active: '', role: '' },
  });

  const openCreate = (template = null) => {
    setCloneTemplate(template);
    setEditorId(null);
    setDetailId(null);
    setEditorOpen(true);
  };

  const openEdit = (id) => {
    setCloneTemplate(null);
    setEditorId(id);
    setDetailId(null);
    setEditorOpen(true);
  };

  const openDetail = (id) => {
    setDetailId(id);
    setEditorOpen(false);
  };

  const handleDelete = async (account) => {
    const isSuper = account.role === 'super_admin';
    const ok = await confirm({
      title: isSuper
        ? (isAr ? 'حذف مسؤول أعلى' : 'Delete super admin')
        : (isAr ? 'حذف حساب الفريق' : 'Delete team account'),
      message: isAr
        ? `حذف @${account.username} نهائياً؟${isSuper ? ' يجب أن يبقى مسؤول أعلى واحد على الأقل في النظام.' : ''}`
        : `Permanently delete @${account.username}?${isSuper ? ' At least one super admin must remain in the system.' : ''}`,
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await adminApi.deleteStaffAccount(account.id);
      if (detailId === account.id) setDetailId(null);
      list.reload();
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const toggleActive = async (account) => {
    try {
      await adminApi.updateStaffAccount(account.id, { isActive: !account.isActive });
      list.reload();
      if (detailId === account.id) setDetailId(null);
      toast.success(account.isActive
        ? (isAr ? 'تم تعطيل الحساب' : 'Account deactivated')
        : (isAr ? 'تم تفعيل الحساب' : 'Account activated'));
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const duplicateAccount = (account) => {
    setDetailId(null);
    openCreate({
      role: account.role,
      useCustomPermissions: (account.permissions?.length || 0) > 0,
      permissions: resolveUserPermissions(account),
    });
  };

  const columns = [
    {
      key: 'name',
      header: isAr ? 'العضو' : 'Member',
      sortKey: 'name',
      render: (a) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-medium text-text">{a.name}</p>
            {a.isSelf && (
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                {isAr ? 'أنت' : 'You'}
              </span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-text-muted" dir="ltr">@{a.username}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: isAr ? 'الدور' : 'Role',
      sortKey: 'role',
      render: (a) => <RoleBadge role={a.role} isAr={isAr} />,
    },
    {
      key: 'permissions',
      header: isAr ? 'الصلاحيات' : 'Access',
      render: (a) => {
        if (a.role === 'driver' || a.isDriver) {
          return (
            <span className="text-sm font-medium text-teal-800">
              {isAr ? 'واجهة التوصيل' : 'Delivery app'}
            </span>
          );
        }
        const count = resolveUserPermissions(a).length;
        const isCustom = (a.permissions?.length || 0) > 0;
        return (
          <div className="text-sm">
            <span className="font-medium text-text">{count}</span>
            <span className="text-text-muted"> {isAr ? 'صلاحية' : 'perms'}</span>
            {isCustom && a.role !== 'super_admin' && (
              <span className="ms-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                {isAr ? 'مخصص' : 'custom'}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (a) => (
        <span className={[
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          a.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
        ].join(' ')}>
          <span className={`h-1.5 w-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {a.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: isAr ? 'آخر دخول' : 'Last login',
      sortKey: 'lastLoginAt',
      render: (a) => (
        <span className="text-sm text-text-muted">
          {a.lastLoginAt ? formatDate(a.lastLoginAt, isAr ? 'ar-EG' : 'en-GB') : '—'}
        </span>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border bg-white p-8 text-center">
        <ShieldCheck className="mb-3 h-10 w-10 text-text-muted" />
        <h2 className="text-lg font-semibold text-text">
          {isAr ? 'صلاحيات غير كافية' : 'Insufficient permissions'}
        </h2>
        <p className="mt-1 max-w-md text-sm text-text-muted">
          {isAr
            ? 'إدارة حسابات الفريق متاحة لمسؤول النظام الأعلى فقط.'
            : 'Team account management is available to super admins only.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-5 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="mb-2 flex items-center gap-2 text-orange-300">
                <UserCog className="h-5 w-5" />
                <h2 className="text-lg font-bold">{isAr ? 'فريق الإدارة' : 'Admin team'}</h2>
              </div>
              <p className="text-sm text-slate-300">
                {isAr
                  ? 'إدارة حسابات لوحة التحكم ومناديب التوصيل. عيّن المندوبين من صفحة الطلبات لمتابعة التوصيل المباشر.'
                  : 'Manage admin panel accounts and delivery drivers. Assign drivers from Orders for live tracking.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'عضو جديد' : 'New team member'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={isAr ? 'إجمالي الفريق' : 'Total team'}
            value={summary.total}
            sub={isAr ? `${summary.active} نشط` : `${summary.active} active`}
            icon={Users}
            accent="orange"
          />
          <StatCard
            label={isAr ? 'مسؤولون أعلى' : 'Super admins'}
            value={summary.superAdmins}
            icon={Crown}
            accent="amber"
          />
          <StatCard
            label={isAr ? 'مناديب التوصيل' : 'Drivers'}
            value={summary.drivers}
            icon={UserCheck}
            accent="emerald"
          />
          <StatCard
            label={isAr ? 'معطّلون' : 'Inactive'}
            value={summary.inactive}
            icon={UserX}
            accent="slate"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border bg-slate-50 px-4 py-3 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <KeyRound className="h-3.5 w-3.5" />
            {isAr ? 'الإدارة: /admin/login · المندوب: /driver/login' : 'Admin: /admin/login · Driver: /driver/login'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
            <ShieldAlert className="h-3.5 w-3.5" />
            {isAr ? 'لا حذف للحساب الشخصي' : 'Cannot delete your own account'}
          </span>
        </div>
      </div>

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث بالاسم أو اسم المستخدم...' : 'Search by name or username...'}
        sort={list.sort}
        onSort={list.toggleSort}
        filters={(
          <div className="flex flex-wrap gap-2">
            <ListFilterSelect
              label={isAr ? 'الدور' : 'Role'}
              value={list.filters.role}
              onChange={(role) => list.patchFilters({ role })}
              options={[
                { value: '', label: isAr ? 'كل الأدوار' : 'All roles' },
                { value: 'super_admin', label: roleLabel('super_admin', isAr) },
                { value: 'admin', label: roleLabel('admin', isAr) },
                { value: 'manager', label: roleLabel('manager', isAr) },
                { value: 'driver', label: roleLabel('driver', isAr) },
              ]}
            />
            <ListFilterSelect
              label={isAr ? 'الحالة' : 'Status'}
              value={list.filters.active}
              onChange={(active) => list.patchFilters({ active })}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                { value: 'true', label: isAr ? 'نشط' : 'Active' },
                { value: 'false', label: isAr ? 'معطّل' : 'Inactive' },
              ]}
            />
          </div>
        )}
        columns={columns}
        data={list.data}
        loading={list.loading}
        onRowClick={(a) => openDetail(a.id)}
        rowClassName={(a) => (a.isSelf ? 'bg-sky-50/60' : '')}
        rowActions={(a) => {
          const actions = [
            { label: isAr ? 'عرض التفاصيل' : 'View details', onClick: () => openDetail(a.id) },
            { label: isAr ? 'تعديل' : 'Edit', onClick: () => openEdit(a.id) },
          ];
          if (!a.isSelf) {
            actions.push({
              label: isAr ? 'نسخ كعضو جديد' : 'Duplicate as new',
              onClick: () => duplicateAccount(a),
            });
            actions.push({
              label: a.isActive ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate'),
              onClick: () => toggleActive(a),
              disabled: !a.canDeactivate,
            });
            actions.push({
              label: a.isSuperAdmin
                ? (isAr ? 'حذف مسؤول أعلى' : 'Delete super admin')
                : (isAr ? 'حذف' : 'Delete'),
              danger: true,
              onClick: () => handleDelete(a),
              disabled: !a.canDelete,
            });
          }
          return actions;
        }}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Users}
        emptyTitle={isAr ? 'لا يوجد أعضاء فريق' : 'No team members yet'}
        emptyDescription={isAr ? 'أنشئ أول حساب إداري للفريق' : 'Create your first admin team account'}
        emptyAction={(
          <button
            type="button"
            onClick={() => openCreate()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إنشاء حساب' : 'Create account'}
          </button>
        )}
      />

      <StaffAccountDetailPanel
        accountId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        isAr={isAr}
        onEdit={(a) => openEdit(a.id)}
        onDuplicate={duplicateAccount}
        onDelete={handleDelete}
        onToggleActive={toggleActive}
      />

      <StaffAccountEditorPanel
        accountId={editorId}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setCloneTemplate(null); }}
        isAr={isAr}
        currentUserId={currentUserId}
        cloneTemplate={cloneTemplate}
        onSaved={() => list.reload()}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />
    </>
  );
}
