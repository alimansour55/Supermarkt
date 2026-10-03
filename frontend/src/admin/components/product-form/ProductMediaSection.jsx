import ProductImageGallery from '../ProductImageGallery';

export default function ProductMediaSection({
  images,
  files,
  onImagesChange,
  onFilesChange,
  onRemoveImage,
  onReorder,
  removingImage,
  isAr,
  saving,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{isAr ? 'صور وفيديو المنتج' : 'Product images & video'}</label>
      <ProductImageGallery
        images={images}
        pendingFiles={files}
        onImagesChange={onImagesChange}
        onPendingFilesChange={onFilesChange}
        onRemoveImage={onRemoveImage}
        onReorder={onReorder}
        removingId={removingImage}
        isAr={isAr}
        disabled={saving}
      />
    </div>
  );
}
