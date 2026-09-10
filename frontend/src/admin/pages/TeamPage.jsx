import { useCallback, useState } from 'react';
import {
  Crown, KeyRound, Plus, RefreshCw, ShieldCheck, Truck, UserCheck, UserCog, Users, UserX,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import StaffAccountEditorPanel from '../components/StaffAccountEditorPanel';
import ResetPasswordDialog from '../components/ResetPasswordDialog';
import TeamMemberDetailPanel from '../components/team/TeamMemberDetailPanel';
import TeamRolesTab from '../components/team/TeamRolesTab';
import TeamAccessTab from '../components/team/TeamAccessTab';
import { ROLE_BADGE_STYLES, roleLabel, resolveUserPermissions } from '../adminPermissions';
import { formatDate } from '../../utils/formatters';

function StatCard({ label, value, sub, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-start transition-all',
        active
          ? 'border-orange-300 bg-orange-50 ring-1 ring-orange-100'
          : 'border-border bg-white hover:border-orange-200 hover:bg-orange-50/30',
      ].join(' ')}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-text-muted" />}
      </div>
      <p className="text-2xl font-bold tabular-nums text-text">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </button>
  );
}

function RoleBadge({ role, isAr }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[role] || 'bg-slate-100 text-slate-700'}`}>
      {role === 'super_admin' && <Crown className="h-3 w-3" />}
      {role === 'driver' && <Truck className="h-3 w-3" />}
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

  const [tab, setTab] = useState('members');
  const [summary, setSummary] = useState({
    total: 0, active: 0, inactive: 0, superAdmins: 0, admins: 0, managers: 0, drivers: 0,
  });
  const [detailId, setDetailId] = useState(null);
  const [editorId, setEditorId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState(null);
  const [resetAccount, setResetAccount] = useState(null);
  const [accessRefreshKey, setAccessRefreshKey] = useState(0);

  const fetchStaff = useCallback(async (params) => {
    const res = await adminApi.getStaffAccounts(params);
    if (res.data.summary) setSummary(res.data.summary);
    return res;
  }, []);

  const list = useAdminListPage({
    fetchFn: fetchStaff,
    initialFilters: { active: '', role: '' },
  });

  const reloadAll = useCallback(() => {
    list.reload();
    setAccessRefreshKey((k) => k + 1);
  }, [list]);

  const openCreate = (template = null, role = null) => {
    setCloneTemplate(template || (role ? { role } : null));
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

  const openReset = (account) => {
    setDetailId(null);
    setResetAccount({
      id: account.id,
      name: account.name,
      username: account.username,
      isDriver: account.role === 'driver' || account.isDriver,
      portal: account.portal,
      loginPath: account.loginPath,
    });
  };

  const handleDelete = async (account) => {
    const isSuper = account.role === 'super_admin';
    const ok = await confirm({
      title: isSuper
        ? (isAr ? 'حذف مالك النظام' : 'Delete owner')
        : (isAr ? 'حذف عضو الفريق' : 'Delete team member'),
      message: isAr
        ? `حذف @${account.username} نهائياً؟${isSuper ? ' يجب أن يبقى مالك نظام واحد على الأقل.' : ''}`
        : `Permanently delete @${account.username}?${isSuper ? ' At least one owner must remain.' : ''}`,
      confirmLabel: isAr ? 'حذف' : 'Delete',
      cancelLabel: isAr ? 'إلغاء' : 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await adminApi.deleteStaffAccount(account.id);
      if (detailId === account.id) setDetailId(null);
      reloadAll();
      toast.success(isAr ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Error'));
    }
  };

  const toggleActive = async (account) => {
    try {
      await adminApi.updateStaffAccount(account.id, { isActive: !account.isActive });
      reloadAll();
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
      render: (a) => {
        const isCustom = (a.permissions?.length || 0) > 0
          && a.role !== 'super_admin' && a.role !== 'driver';
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <RoleBadge role={a.role} isAr={isAr} />
            {isCustom && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
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
          {a.isActive ? (isAr ? 'يمكنه الدخول' : 'Can sign in') : (isAr ? 'معطّل' : 'Disabled')}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: isAr ? 'آخر دخول' : 'Last sign-in',
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
            ? 'إدارة حسابات الفريق متاحة لمالك النظام فقط.'
            : 'Team account management is available to owners only.'}
        </p>
      </div>
    );
  }

  const TABS = [
    { id: 'members', labelAr: 'الأعضاء', labelEn: 'Members' },
    { id: 'roles', labelAr: 'الأدوار والصلاحيات', labelEn: 'Roles & permissions' },
    { id: 'access', labelAr: 'الدخول والوصول', labelEn: 'Sign-in & access' },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-text">{isAr ? 'فريق الإدارة' : 'Admin team'}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-text-muted">
                {isAr
                  ? 'حسابات لوحة التحكم ومناديب التوصيل: الأدوار، الدخول، وكلمات المرور.'
                  : 'Admin panel accounts and delivery drivers — roles, sign-in and passwords.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadAll}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-text-muted hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              {isAr ? 'عضو جديد' : 'Add member'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-border" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={[
                '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                tab === t.id
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-text-muted hover:border-border hover:text-text',
              ].join(' ')}
            >
              {isAr ? t.labelAr : t.labelEn}
            </button>
          ))}
        </div>
      </div>

      {tab === 'members' && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={isAr ? 'إجمالي الفريق' : 'Total team'}
              value={summary.total}
              sub={isAr ? `${summary.active} نشط` : `${summary.active} active`}
              icon={Users}
              active={list.filters.role === '' && list.filters.active === ''}
              onClick={() => list.patchFilters({ role: '', active: '' })}
            />
            <StatCard
              label={isAr ? 'مالكو النظام' : 'Owners'}
              value={summary.superAdmins}
              icon={Crown}
              active={list.filters.role === 'super_admin'}
              onClick={() => list.patchFilters({ role: 'super_admin', active: '' })}
            />
            <StatCard
              label={isAr ? 'مناديب التوصيل' : 'Drivers'}
              value={summary.drivers}
              icon={UserCheck}
              active={list.filters.role === 'driver'}
              onClick={() => list.patchFilters({ role: 'driver', active: '' })}
            />
            <StatCard
              label={isAr ? 'معطّلون' : 'Disabled'}
              value={summary.inactive}
              icon={UserX}
              active={list.filters.active === 'false'}
              onClick={() => list.patchFilters({ role: '', active: 'false' })}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5">
              <KeyRound className="h-3.5 w-3.5" />
              {isAr ? 'لوحة التحكم: /admin/login · المندوب: /driver/login' : 'Admin: /admin/login · Driver: /driver/login'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isAr ? 'لا يمكنك حذف أو تعطيل حسابك' : 'You cannot delete or deactivate your own account'}
            </span>
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
                    { value: 'true', label: isAr ? 'يمكنه الدخول' : 'Can sign in' },
                    { value: 'false', label: isAr ? 'معطّل' : 'Disabled' },
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
              if (a.canResetPassword) {
                actions.push({ label: isAr ? 'إعادة تعيين كلمة المرور' : 'Reset password', onClick: () => openReset(a) });
              }
              if (!a.isSelf && a.role !== 'driver') {
                actions.push({
                  label: isAr ? 'نسخ كعضو جديد' : 'Duplicate as new',
                  onClick: () => duplicateAccount(a),
                });
              }
              if (!a.isSelf) {
                actions.push({
                  label: a.isActive ? (isAr ? 'تعطيل' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate'),
                  onClick: () => toggleActive(a),
                  disabled: !a.canDeactivate,
                });
                actions.push({
                  label: a.isSuperAdmin
                    ? (isAr ? 'حذف مالك النظام' : 'Delete owner')
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
        </>
      )}

      {tab === 'roles' && <TeamRolesTab isAr={isAr} summary={summary} />}

      {tab === 'access' && (
        <TeamAccessTab
          isAr={isAr}
          refreshKey={accessRefreshKey}
          onResetPassword={openReset}
          onAddDriver={() => openCreate(null, 'driver')}
          onOpenMember={openDetail}
        />
      )}

      <TeamMemberDetailPanel
        accountId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        isAr={isAr}
        onEdit={(a) => openEdit(a.id)}
        onDuplicate={duplicateAccount}
        onDelete={handleDelete}
        onToggleActive={toggleActive}
        onResetPassword={openReset}
      />

      <StaffAccountEditorPanel
        accountId={editorId}
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setCloneTemplate(null); }}
        isAr={isAr}
        currentUserId={currentUserId}
        cloneTemplate={cloneTemplate}
        onSaved={() => reloadAll()}
        onSuccess={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
      />

      <ResetPasswordDialog
        account={resetAccount}
        open={Boolean(resetAccount)}
        onClose={() => setResetAccount(null)}
        isAr={isAr}
        onDone={reloadAll}
      />
    </>
  );
}
