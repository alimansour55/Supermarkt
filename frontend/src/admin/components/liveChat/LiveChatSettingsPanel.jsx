import { Save } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Loader from '../../../components/ui/Loader';
import SettingToggleCard from '../SettingToggleCard';
import { useStoreSettingsForm } from '../../hooks/useStoreSettingsForm';
import WeeklyScheduleEditor from './WeeklyScheduleEditor';

/** Store-wide live-chat options: on/off, capacity, business hours, offline text, targets. */
export default function LiveChatSettingsPanel() {
  const { settings, loading, saving, save, update, isAr } = useStoreSettingsForm();

  if (!settings || loading) return <div className="flex justify-center py-16"><Loader size="md" /></div>;

  const liveChat = settings.liveChat || {};
  const patch = (p) => update('liveChat', { ...liveChat, ...p });

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-4 overflow-y-auto p-4">
      <SettingToggleCard
        accent="emerald"
        checked={liveChat.enabled !== false}
        onChange={(v) => patch({ enabled: v })}
        title={isAr ? 'تفعيل الدردشة المباشرة مع فريق الدعم' : 'Enable live chat with the support team'}
        description={isAr
          ? 'محادثة حقيقية بين العميل وفريق الدعم (منفصلة عن المساعد الذكي).'
          : 'Real human chat between customers and your support team (separate from the AI assistant).'}
      />

      <div className="max-w-xs">
        <Input
          label={isAr ? 'أقصى عدد محادثات نشطة في نفس الوقت (0 = بلا حد)' : 'Max concurrent chats (0 = unlimited)'}
          type="number"
          min="0"
          max="50"
          disabled={liveChat.enabled === false}
          value={liveChat.maxConcurrentChats ?? 2}
          onChange={(e) => patch({ maxConcurrentChats: e.target.value })}
        />
        <p className="mt-1 text-xs text-text-muted">
          {isAr
            ? 'العملاء الزيادة عن الرقم ده بيستنوا في قائمة انتظار ويتحولوا تلقائياً لما محادثة تخلص.'
            : 'Customers beyond this number wait in a queue and are promoted automatically when a chat ends.'}
        </p>
      </div>

      <SettingToggleCard
        accent="sky"
        checked={liveChat.scheduleEnabled === true}
        disabled={liveChat.enabled === false}
        onChange={(v) => patch({ scheduleEnabled: v })}
        title={isAr ? 'ساعات عمل المتجر للدردشة' : 'Store-wide chat hours'}
        description={isAr
          ? 'لو مقفول: الدردشة متاحة 24 ساعة. لو مفعّل: تظهر "غير متاح" خارج المواعيد أدناه. (لكل موظف ساعاته الخاصة من تبويب "الفريق").'
          : 'Off: chat is available 24/7. On: customers see “offline” outside the hours below. (Each agent also has personal hours in the Team tab.)'}
      />
      {liveChat.scheduleEnabled === true && (
        <WeeklyScheduleEditor
          schedule={liveChat.schedule || []}
          onChange={(schedule) => patch({ schedule })}
          isAr={isAr}
          disabled={liveChat.enabled === false}
        />
      )}

      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
        <h3 className="text-sm font-bold">{isAr ? 'عدم رد العميل' : 'Customer inactivity'}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label={isAr ? 'سؤال "هل تريد المتابعة؟" بعد (دقائق، 0 = بدون)' : 'Ask “do you want to continue?” after (minutes, 0 = never)'}
            type="number"
            min="0"
            value={liveChat.idlePromptMinutes ?? 1}
            onChange={(e) => patch({ idlePromptMinutes: e.target.value })}
          />
          <Input
            label={isAr ? 'إغلاق المحادثة تلقائياً بعد (دقائق، 0 = بدون)' : 'Auto-close the chat after (minutes, 0 = never)'}
            type="number"
            min="0"
            value={liveChat.autoCloseMinutes ?? 15}
            onChange={(e) => patch({ autoCloseMinutes: e.target.value })}
          />
        </div>
        <p className="text-xs text-text-muted">
          {isAr
            ? 'يُحسب من آخر رد للموظف ولم يرد عليه العميل. عند الإغلاق التلقائي يظهر للعميل "تم إغلاق المحادثة" ثم التقييم.'
            : 'Counted from the agent’s last reply the customer has not answered. On auto-close the customer sees “chat closed”, then the rating.'}
        </p>
      </div>

      <SettingToggleCard
        accent="violet"
        checked={liveChat.ratingEnabled !== false}
        onChange={(v) => patch({ ratingEnabled: v })}
        title={isAr ? 'تقييم المحادثة بعد انتهائها' : 'Ask customers to rate finished chats'}
        description={isAr
          ? 'لو مقفول: لا يظهر للعميل نجوم التقييم، ولا تُحسب نسب الرضا.'
          : 'Off: customers are not asked to rate, so no satisfaction numbers accrue.'}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label={isAr ? 'رسالة خارج ساعات العمل (عربي)' : 'Offline message (Arabic)'}
          value={liveChat.offlineMessageAr ?? ''}
          onChange={(e) => patch({ offlineMessageAr: e.target.value })}
        />
        <Input
          label={isAr ? 'رسالة خارج ساعات العمل (EN)' : 'Offline message (English)'}
          value={liveChat.offlineMessageEn ?? ''}
          onChange={(e) => patch({ offlineMessageEn: e.target.value })}
        />
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
        <h3 className="mb-3 text-sm font-bold">{isAr ? 'المستهدفات' : 'Targets'}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label={isAr ? 'هدف رضا العملاء % (تقييم ٤-٥ نجوم)' : 'Customer satisfaction target % (4–5★)'}
            type="number"
            min="0"
            max="100"
            value={liveChat.csatTargetPercent ?? 90}
            onChange={(e) => patch({ csatTargetPercent: e.target.value })}
          />
          <Input
            label={isAr ? 'هدف عدد المحادثات شهرياً لكل موظف (0 = بدون)' : 'Monthly chats target per agent (0 = none)'}
            type="number"
            min="0"
            value={liveChat.monthlyChatTarget ?? 0}
            onChange={(e) => patch({ monthlyChatTarget: e.target.value })}
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {isAr ? 'كل موظف يرى أرقامه مقابل هذه الأهداف في تبويب "الأداء".' : 'Each agent sees their own numbers against these targets in the Performance tab.'}
        </p>
      </div>

      <Button type="submit" disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? (isAr ? 'جار الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
      </Button>
    </form>
  );
}
