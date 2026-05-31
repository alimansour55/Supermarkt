import { Users } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { AdminListPage, BulkActionsBar, ListFilterSelect } from '../components/list';
import { useConfirm, useToast } from '../components';
import { ASSIGNABLE_ROLES, roleLabel, STAFF_ROLES } from '../adminPermissions';

const ROLE_COLORS = {
  user: 'bg-slate-100 text-slate-700',
  manager: 'bg-blue-100 text-blue-800',
  admin: 'bg-purple-100 text-purple-800',
  super_admin: 'bg-amber-100 text-amber-900',
};

export default function UsersPage() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const isAr = language === 'ar';
  const confirm = useConfirm();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getUsers(params),
    initialFilters: { role: '' },
  });

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
      list.reload();
    } catch (err) {
      toast.error(err.response?.data?.message);
    }
  };

  const columns = [
    {
      key: 'name',
      header: isAr ? 'الاسم' : 'Name',
      sortKey: 'name',
      render: (u) => <span className="font-medium">{u.name}</span>,
    },
    { key: 'email', header: isAr ? 'البريد' : 'Email', sortKey: 'email' },
    {
      key: 'phone',
      header: isAr ? 'الهاتف' : 'Phone',
      render: (u) => u.phone || '—',
    },
    {
      key: 'role',
      header: isAr ? 'الدور' : 'Role',
      render: (u) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
          {roleLabel(u.role, isAr)}
        </span>
      ),
    },
  ];

  return (
    <AdminListPage
      isAr={isAr}
      q={list.q}
      onSearchChange={list.setQ}
      searchPlaceholder={isAr ? 'بحث...' : 'Search...'}
      sort={list.sort}
      onSort={list.toggleSort}
      filters={(
        <ListFilterSelect
          label={isAr ? 'الدور' : 'Role'}
          value={list.filters.role}
          onChange={(v) => list.setFilter('role', v)}
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
      rowActions={(u) => {
        const isStaff = STAFF_ROLES.includes(u.role);
        const isSelf = u._id === currentUser?._id || u._id === currentUser?.id;
        const actions = [];

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
      emptyTitle={isAr ? 'لا يوجد مستخدمون' : 'No users'}
      emptyDescription={isAr ? 'جرّب بحثاً آخر' : 'Try a different search'}
    />
  );
}
