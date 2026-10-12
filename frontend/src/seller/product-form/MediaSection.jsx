import { useRef, useState } from 'react';
import { GripVertical, ImagePlus, Star, UploadCloud, X } from 'lucide-react';
import Loader from '../../components/ui/Loader';
import { SectionHeader } from './ui';

export const MAX_MEDIA = 12;

/**
 * Photos & videos: drop files or click to upload, drag to reorder, star to make the main photo.
 * `media` is [{url, publicId, type}] — already uploaded; the form saves the list.
 */
export default function MediaSection({ media, onChange, onUpload, uploading, isAr, error }) {
  const fileRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [dropActive, setDropActive] = useState(false);

  const move = (from, to) => {
    if (from === to || from == null || to == null) return;
    const next = [...media];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const pick = (files) => {
    const list = Array.from(files || []).filter((f) => /^(image|video)\//.test(f.type));
    if (list.length) onUpload(list.slice(0, MAX_MEDIA - media.length));
  };

  const remaining = MAX_MEDIA - media.length;

  return (
    <div>
      <SectionHeader
        title={isAr ? 'الصور والفيديو' : 'Photos & video'}
        description={isAr
          ? 'المنتجات بـ 3 صور أو أكثر تُباع أفضل. أول صورة هي الرئيسية — اسحب الصور لترتيبها أو اضغط النجمة.'
          : 'Listings with 3+ photos sell better. The first photo is the main one — drag to reorder or tap the star.'}
      >
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{media.length} / {MAX_MEDIA}</span>
      </SectionHeader>

      {remaining > 0 && (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true); } }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => { e.preventDefault(); setDropActive(false); pick(e.dataTransfer.files); }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dropActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40'} ${error ? 'border-red-300' : ''}`}
        >
          {uploading ? <Loader size="md" /> : <UploadCloud className="h-9 w-9 text-indigo-500" aria-hidden />}
          <span className="text-sm font-semibold">
            {uploading ? (isAr ? 'جاري الرفع…' : 'Uploading…') : (isAr ? 'اسحب الصور هنا أو اضغط للاختيار' : 'Drop photos here or click to choose')}
          </span>
          <span className="text-xs text-slate-500">
            {isAr ? `JPG / PNG / WEBP أو فيديو MP4 — حتى ${remaining} ملف` : `JPG / PNG / WEBP or MP4 video — up to ${remaining} more`}
          </span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}

      {media.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m, i) => (
            <li
              key={`${m.url}-${i}`}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (dragIndex != null) { e.preventDefault(); setOverIndex(i); } }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              onDrop={(e) => { e.preventDefault(); move(dragIndex, i); setDragIndex(null); setOverIndex(null); }}
              className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-white ring-1 transition ${i === 0 ? 'ring-2 ring-indigo-500' : 'ring-slate-200'} ${overIndex === i && dragIndex !== i ? 'scale-[1.03] ring-2 ring-indigo-300' : ''} ${dragIndex === i ? 'opacity-40' : ''}`}
            >
              {m.type === 'video'
                ? <video src={m.url} className="h-full w-full object-cover" muted />
                : <img src={m.url} alt="" className="h-full w-full object-cover" />}
              <span className="absolute start-1.5 top-1.5 rounded-md bg-black/50 p-0.5 text-white opacity-0 group-hover:opacity-100" aria-hidden><GripVertical className="h-4 w-4" /></span>
              {i === 0 ? (
                <span className="absolute bottom-1.5 start-1.5 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{isAr ? 'الرئيسية' : 'Main'}</span>
              ) : (
                <button type="button" onClick={() => move(i, 0)} className="absolute bottom-1.5 start-1.5 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold shadow opacity-0 group-hover:opacity-100 focus:opacity-100">
                  <Star className="h-3 w-3" />{isAr ? 'اجعلها الرئيسية' : 'Make main'}
                </button>
              )}
              <button type="button" onClick={() => onChange(media.filter((_, j) => j !== i))} className="absolute end-1.5 top-1.5 rounded-full bg-white p-1 shadow ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-600" aria-label={isAr ? 'إزالة' : 'Remove'}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {remaining > 0 && (
            <li>
              <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
                <ImagePlus className="h-6 w-6" />{isAr ? 'إضافة' : 'Add'}
              </button>
            </li>
          )}
        </ul>
      )}

      <ul className="mt-4 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
        <li>• {isAr ? 'خلفية بيضاء وإضاءة جيدة للصورة الرئيسية' : 'White background and good light for the main photo'}</li>
        <li>• {isAr ? 'صورة للعبوة من الأمام والخلف (المكونات / تاريخ الصلاحية)' : 'Front and back of the pack (ingredients / expiry)'}</li>
        <li>• {isAr ? 'مقاس 1000×1000 بكسل أو أكبر' : '1000×1000 px or larger'}</li>
        <li>• {isAr ? 'بدون شعارات أو أرقام هواتف على الصور' : 'No watermarks or phone numbers on photos'}</li>
      </ul>
    </div>
  );
}
