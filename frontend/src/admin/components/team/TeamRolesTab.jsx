import { useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Crown, Store, ClipboardList, Truck, X, Users, ExternalLink,
} from 'lucide-react';
import { Link } from '../../../app/router';
import {
  PERMISSION_GROUPS,
  ROLE_GUIDE,
  ROLE_PRESET_PERMISSIONS,
  TEAM_PANEL_ROLES,
  roleLabel,
} from '../../adminPermissions';

const ROLE_ICON = {
  super_admin: Crown,
  admin: Store,
  manager: ClipboardList,
  driver: Truck,
};

const TONE = {
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  purple: 'border-purple-200 bg-purple-50 text-purple-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
  teal: 'border-teal-200 bg-teal-50 text-teal-900',
};

const ICON_TONE = {
  amber: 'bg-amber-100 text-amber-700',
  purple: 'bg-purple-100 text-purple-700',
  blue: 'bg-blue-100 text-blue-700',
  teal: 'bg-teal-100 text-teal-700',
};

function permissionLabelsForRole(role, isAr) {
  const preset = new Set(ROLE_PRESET_PERMISSIONS[role] || []);
  return PERMISSION_GROUPS.map((group) => ({
    id: group.id,
    label: isAr ? group.labelAr : group.labelEn,
    items: group.permissions
      .filter((p) => preset.has(p.key))
      .map((p) => (isAr ? p.labelAr : p.labelEn)),
  })).filter((g) => g.items.length > 0);
}

function BulletList({ items, tone }) {
  const Icon = tone === 'can' ? Check : X;
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-text">
          <Icon
            className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'can' ? 'text-emerald-600' : 'text-slate-400'}`}
          />
          <span className={tone === 'cannot' ? 'text-text-muted' : ''}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RoleCard({ role, count, isAr, tone }) {
  const [open, setOpen] = useState(false);
  const guide = ROLE_GUIDE[role][isAr ? 'ar' : 'en'];
  const Icon = ROLE_ICON[role];
  const groups = permissionLabelsForRole(role, isAr);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className={`flex items-start gap-3 border-b border-border p-4 ${TONE[tone]}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold">{roleLabel(role, isAr)}</h4>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
              <Users className="h-3 w-3" />
              {count} {isAr ? 'عضو' : count === 1 ? 'member' : 'members'}
            </span>
          </div>
          <p className="mt-0.5 text-sm opacity-90">{guide.summary}</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-xs">
          <span className="font-semibold text-text-muted">{isAr ? 'مناسب لـ: ' : 'Best for: '}</span>
          <span className="text-text-muted">{guide.bestFor}</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {isAr ? 'يمكنه' : 'Can'}
            </p>
            <BulletList items={guide.can} tone="can" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isAr ? 'لا يمكنه' : 'Cannot'}
            </p>
            <BulletList items={guide.cannot} tone="cannot" />
          </div>
        </div>

        {groups.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-text hover:bg-slate-100"
            >
              {isAr ? `كل الصلاحيات (${(ROLE_PRESET_PERMISSIONS[role] || []).length})` : `All permissions (${(ROLE_PRESET_PERMISSIONS[role] || []).length})`}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {open && (
              <div className="mt-2 space-y-2.5">
                {groups.map((g) => (
                  <div key={g.id}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g.label}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.items.map((label) => (
                        <span key={label} className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-medium text-orange-900">
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamRolesTab({ isAr, summary }) {
  const counts = {
    super_admin: summary.superAdmins || 0,
    admin: summary.admins || 0,
    manager: summary.managers || 0,
    driver: summary.drivers || 0,
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'أدوار لوحة التحكم' : 'Admin panel roles'}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'كل عضو إداري يأخذ دوراً واحداً من هذه. الدور الأعلى يشمل كل ما دونه.'
              : 'Each admin member gets exactly one of these. Higher roles include everything below them.'}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {TEAM_PANEL_ROLES.map((role) => (
            <RoleCard
              key={role}
              role={role}
              count={counts[role]}
              isAr={isAr}
              tone={role === 'super_admin' ? 'amber' : role === 'admin' ? 'purple' : 'blue'}
            />
          ))}
          <div className="rounded-2xl border border-dashed border-border bg-slate-50/60 p-4 text-sm text-text-muted lg:col-span-2">
            <p className="font-semibold text-text">{isAr ? 'صلاحيات مخصصة' : 'Custom access'}</p>
            <p className="mt-1">
              {isAr
                ? 'بدل اختيار دور جاهز، يمكن لمالك النظام تحديد كل صلاحية يدوياً لعضو معيّن — للحالات الخاصة مثل «المرتجعات فقط». يظهر عندها وسم «مخصص» بجانب العضو.'
                : 'Instead of a ready-made role, an owner can hand-pick each permission for one member — for edge cases like “returns only”. Those members show a “Custom” tag.'}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
            {isAr ? 'وصول ميداني' : 'Field access'}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {isAr
              ? 'مندوب التوصيل ليس دوراً في لوحة التحكم — له تطبيق منفصل.'
              : 'Delivery driver is not an admin-panel role — it has its own separate app.'}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <RoleCard role="driver" count={counts.driver} isAr={isAr} tone="teal" />
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-sm text-teal-950">
            <p className="font-semibold">{isAr ? 'كيف يعمل التوصيل' : 'How delivery works'}</p>
            <ol className="mt-2 list-decimal space-y-1 ps-4">
              <li>{isAr ? 'أنشئ حساب مندوب (اسم مستخدم + هاتف).' : 'Create a driver account (username + phone).'}</li>
              <li>{isAr ? 'المندوب يدخل من /driver/login بالبيانات.' : 'The driver signs in at /driver/login with the credentials.'}</li>
              <li>{isAr ? 'عيّن المندوب لطلب من صفحة الطلبات.' : 'Assign the driver to an order from the Orders page.'}</li>
              <li>{isAr ? 'يبدأ المندوب التوصيل ويشارك موقعه المباشر.' : 'The driver starts delivery and shares live GPS.'}</li>
            </ol>
            <Link
              to="/admin/orders"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 underline"
            >
              {isAr ? 'صفحة الطلبات' : 'Go to Orders'}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
