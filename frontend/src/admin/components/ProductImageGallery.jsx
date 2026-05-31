import { useRef, useState } from 'react';
import { GripVertical, ImagePlus, X } from 'lucide-react';

function reorderList(list, fromIndex, toIndex) {
  const next = [...list];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

export default function ProductImageGallery({
  images,
  pendingFiles = [],
  onImagesChange,
  onPendingFilesChange,
  onRemoveImage,
  onReorder,
  removingId,
  isAr,
  disabled = false,
}) {
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const fileInputRef = useRef(null);

  const pendingPreviews = pendingFiles.map((file, index) => ({
    id: `pending-${index}-${file.name}`,
    url: URL.createObjectURL(file),
    isPending: true,
    fileIndex: index,
  }));

  const allItems = [
    ...images.map((img, index) => ({ ...img, id: img.url || `saved-${index}`, isPending: false })),
    ...pendingPreviews,
  ];

  const handleDragStart = (index) => {
    if (disabled) return;
    dragIndex.current = index;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (index) => {
    if (dragIndex.current === null || dragIndex.current === index) {
      dragIndex.current = null;
      setDragOverIndex(null);
      return;
    }

    const from = dragIndex.current;
    const to = index;
    const reordered = reorderList(allItems, from, to);

    const newImages = reordered.filter((item) => !item.isPending).map(({ url, publicId }) => ({ url, publicId }));
    const newFiles = reordered
      .filter((item) => item.isPending)
      .map((item) => pendingFiles[item.fileIndex]);

    onImagesChange(newImages);
    if (onPendingFilesChange) onPendingFilesChange(newFiles);
    onReorder?.(newImages);

    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleFilesAdded = (e) => {
    const added = [...(e.target.files || [])];
    if (!added.length) return;
    onPendingFilesChange?.([...pendingFiles, ...added]);
    e.target.value = '';
  };

  const removePending = (fileIndex) => {
    onPendingFilesChange?.(pendingFiles.filter((_, i) => i !== fileIndex));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {allItems.map((item, index) => (
          <div
            key={item.id}
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={[
              'group relative flex h-24 w-24 shrink-0 cursor-grab flex-col overflow-hidden rounded-xl border-2 bg-slate-50 active:cursor-grabbing',
              dragOverIndex === index ? 'border-primary-500 ring-2 ring-primary-200' : 'border-border',
              item.isPending ? 'border-dashed border-primary-300' : '',
            ].join(' ')}
          >
            <img src={item.url} alt="" className="h-full w-full object-cover" draggable={false} />
            <div className="absolute start-1 top-1 rounded bg-black/50 p-0.5 text-white opacity-80">
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            {item.isPending && (
              <span className="absolute bottom-0 start-0 end-0 bg-primary-600/90 py-0.5 text-center text-[10px] font-medium text-white">
                {isAr ? 'جديد' : 'New'}
              </span>
            )}
            <button
              type="button"
              disabled={disabled || (!item.isPending && removingId === item.publicId)}
              onClick={() => {
                if (item.isPending) removePending(item.fileIndex);
                else onRemoveImage({ url: item.url, publicId: item.publicId });
              }}
              className="absolute -end-1 -top-1 rounded-full bg-red-600 p-1 text-white shadow-sm hover:bg-red-700"
              aria-label={isAr ? 'إزالة' : 'Remove'}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-xs font-medium">{isAr ? 'إضافة' : 'Add'}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesAdded}
      />

      <p className="text-xs text-text-muted">
        {isAr
          ? 'اسحب الصور لإعادة الترتيب · تُرفع الصور الجديدة عند الحفظ'
          : 'Drag images to reorder · New images upload on save'}
      </p>
    </div>
  );
}
