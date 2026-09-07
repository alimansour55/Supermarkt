import { useLanguage } from '../../context/LanguageContext';

const EMPTY_ITEM = { titleAr: '', titleEn: '', image: '', link: '', emoji: '' };

export default function HomepageItemsEditor({ items = [], onChange }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const setItem = (index, patch) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addItem = () => onChange([...items, { ...EMPTY_ITEM }]);

  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  const moveItem = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          {isAr
            ? 'أضف علامة أو بانراً: عنوان، صورة، رابط، وأيقونة اختيارية.'
            : 'Add a brand or promo tile: title, image, link, and optional emoji.'}
        </p>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100"
        >
          {isAr ? '+ عنصر' : '+ Item'}
        </button>
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-6 text-center text-sm text-text-muted">
          {isAr ? 'لا عناصر بعد — اضغط «+ عنصر».' : 'No items yet — click "+ Item".'}
        </p>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-xl border border-border bg-surface-muted/30 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-muted">
              {isAr ? `عنصر ${index + 1}` : `Item ${index + 1}`}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
                className="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface disabled:opacity-30"
                aria-label={isAr ? 'أعلى' : 'Move up'}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, 1)}
                className="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface disabled:opacity-30"
                aria-label={isAr ? 'أسفل' : 'Move down'}
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                {isAr ? 'حذف' : 'Remove'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'العنوان (عربي)' : 'Title (AR)'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={item.titleAr || ''}
                onChange={(e) => setItem(index, { titleAr: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'العنوان (EN)' : 'Title (EN)'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={item.titleEn || ''}
                onChange={(e) => setItem(index, { titleEn: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'رابط الصورة' : 'Image URL'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                dir="ltr"
                placeholder="https://..."
                value={item.image || ''}
                onChange={(e) => setItem(index, { image: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'الرابط' : 'Link'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                dir="ltr"
                placeholder="/products?brand=..."
                value={item.link || ''}
                onChange={(e) => setItem(index, { link: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'وصف / قيمة (اختياري)' : 'Subtitle / value (optional)'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? '1000+ أو نص قصير' : '1000+ or short text'}
                value={item.query || ''}
                onChange={(e) => setItem(index, { query: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                {isAr ? 'أيقونة (اختياري)' : 'Emoji (optional)'}
              </label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                maxLength={4}
                value={item.emoji || ''}
                onChange={(e) => setItem(index, { emoji: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
