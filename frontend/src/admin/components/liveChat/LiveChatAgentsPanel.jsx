import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { adminApi } from '../../adminApi';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Loader from '../../../components/ui/Loader';
import ToggleSwitch from '../ToggleSwitch';
import { useToast } from '..';
import WeeklyScheduleEditor from './WeeklyScheduleEditor';

function MyProfile({ isAr }) {
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getMyLiveChatProfile()
      .then(({ data }) => setProfile(data.data))
      .catch(() => toast.error(isAr ? 'تعذر تحميل ملفك' : 'Could not load your profile'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!profile) return <div className="flex justify-center py-10"><Loader size="md" /></div>;

  const patch = (p) => setProfile((prev) => ({ ...prev, ...p }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await adminApi.updateMyLiveChatProfile({
        displayName: profile.displayName,
        whatsappNumber: profile.whatsappNumber,
        scheduleEnabled: profile.scheduleEnabled,
        schedule: profile.schedule,
      });
      setProfile(data.data);
      toast.success(isAr ? 'تم حفظ ملفك' : 'Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{isAr ? 'ملفي في الدردشة' : 'My chat profile'}</h3>
          <p className="text-sm text-text-muted">
            {profile.enabled
              ? (isAr ? 'أنت معيّن كموظف دردشة.' : 'You are designated as a chat agent.')
              : (isAr ? 'لم يتم تعيينك كموظف دردشة بعد — المسؤول الأعلى يحدد ذلك.' : 'You have not been designated as a chat agent yet — a super admin does that.')}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${profile.availableNow ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
          {profile.availableNow ? (isAr ? 'متاح الآن' : 'Available now') : (isAr ? 'غير متاح الآن' : 'Not available now')}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Input
            label={isAr ? 'الاسم الذي يراه العميل' : 'Name customers see'}
            value={profile.displayName || ''}
            maxLength={60}
            onChange={(e) => patch({ displayName: e.target.value })}
            placeholder={profile.name}
          />
          <p className="mt-1 text-xs text-text-muted">
            {isAr ? 'يظهر للعميل: "أنت تتحدث الآن مع …"' : 'Shown to the customer as “You are chatting with …”'}
          </p>
        </div>
        <div>
          <Input
            label={isAr ? 'رقم واتساب الخاص بي (سري)' : 'My WhatsApp number (private)'}
            value={profile.whatsappNumber || ''}
            onChange={(e) => patch({ whatsappNumber: e.target.value })}
            placeholder="201012345678"
            dir="ltr"
          />
          <p className="mt-1 text-xs text-text-muted">
            {isAr
              ? 'مع كود الدولة. لا يظهر للعملاء أبداً — تصلك عليه تنبيهات المحادثات الجديدة.'
              : 'Include the country code. Never shown to customers — new-chat alerts are sent here.'}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-slate-50/50 p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          {isAr ? 'تحديد أيام وساعات الرد الخاصة بي' : 'Limit my answering days & hours'}
          <ToggleSwitch checked={profile.scheduleEnabled === true} onChange={(v) => patch({ scheduleEnabled: v })} ariaLabel="schedule" />
        </label>
        <p className="text-xs text-text-muted">
          {isAr
            ? 'لو مقفول: تعتبر متاحاً دائماً. لو مفعّل: تتلقى المحادثات في الأيام والساعات أدناه فقط.'
            : 'Off: you count as always available. On: you receive chats only on the days and hours below.'}
        </p>
        {profile.scheduleEnabled && (
          <WeeklyScheduleEditor schedule={profile.schedule} onChange={(schedule) => patch({ schedule })} isAr={isAr} />
        )}
      </div>

      <Button type="button" onClick={save} disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
      </Button>
    </section>
  );
}

function TeamList({ isAr }) {
  const toast = useToast();
  const [agents, setAgents] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    adminApi.getLiveChatAgents()
      .then(({ data }) => setAgents(data.data))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (agent, enabled) => {
    setBusy(agent.userId);
    try {
      await adminApi.setLiveChatAgentEnabled(agent.userId, enabled);
      toast.success(isAr ? 'تم التحديث' : 'Updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'تعذر التحديث' : 'Update failed'));
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div>
        <h3 className="font-bold">{isAr ? 'فريق الدردشة' : 'Chat team'}</h3>
        <p className="text-sm text-text-muted">
          {isAr
            ? 'حدّد من من المسؤولين يجب أن يكون متاحاً للدردشة. لو لم تحدد أحداً تعمل الدردشة كالمعتاد؛ ولو حددت، تظهر "غير متاح" للعملاء عندما لا يوجد أي منهم في ساعات عمله.'
            : 'Mark which admins must be available for chat. With nobody marked, chat works as before; once marked, customers see “offline” when none of them is within their hours.'}
        </p>
      </div>
      {agents === null ? (
        <div className="flex justify-center py-8"><Loader size="md" /></div>
      ) : (
        <ul className="divide-y divide-border/80">
          {agents.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-text">
                  {a.displayName || a.name}
                  {a.displayName && a.displayName !== a.name && <span className="ms-2 text-xs font-normal text-text-muted">({a.name})</span>}
                </p>
                <p className="text-xs text-text-muted">
                  {a.role}
                  {a.hasWhatsapp && ` · ${isAr ? 'واتساب مضاف' : 'WhatsApp added'}`}
                  {a.enabled && ` · ${a.availableNow ? (isAr ? 'متاح الآن' : 'available now') : (isAr ? 'خارج ساعات عمله' : 'outside their hours')}`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold">
                {isAr ? 'موظف دردشة' : 'Chat agent'}
                <ToggleSwitch
                  checked={a.enabled}
                  disabled={busy === a.userId}
                  onChange={(v) => toggle(a, v)}
                  ariaLabel={a.name}
                />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LiveChatAgentsPanel({ isAr, canManage }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 overflow-y-auto p-4">
      <MyProfile isAr={isAr} />
      {canManage && <TeamList isAr={isAr} />}
    </div>
  );
}
