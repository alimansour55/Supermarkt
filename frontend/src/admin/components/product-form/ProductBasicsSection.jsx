import { Controller } from 'react-hook-form';
import { Link } from '../../../app/router';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import BrandFilterSelect from '../BrandFilterSelect';

export default function ProductBasicsSection({ register, control, errors, isAr, brands }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={isAr ? 'الاسم (عربي)' : 'Name (Arabic)'}
          error={errors.nameAr?.message}
          required
          {...register('nameAr')}
        />
        <Input
          label={isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}
          error={errors.nameEn?.message}
          required
          {...register('nameEn')}
        />
        <div>
          <Controller
            control={control}
            name="brand"
            render={({ field }) => (
              <BrandFilterSelect
                brands={brands}
                value={field.value || ''}
                onChange={field.onChange}
                isAr={isAr}
                label={isAr ? 'العلامة التجارية' : 'Brand'}
                placeholder={isAr ? 'اختر علامة تجارية…' : 'Select a brand…'}
                maxOptions={200}
              />
            )}
          />
          <p className="mt-1.5 text-xs text-text-muted">
            {isAr ? (
              <>
                القائمة من{' '}
                <Link to="/admin/brands" className="font-semibold text-primary-600 hover:underline">
                  العلامات التجارية
                </Link>
                {' '}— يجب أن تطابق قيمة الفلتر في المنتج.
              </>
            ) : (
              <>
                Options come from{' '}
                <Link to="/admin/brands" className="font-semibold text-primary-600 hover:underline">
                  Brands
                </Link>
                {' '}— must match the product filter value.
              </>
            )}
          </p>
        </div>
        <Input
          label="Emoji"
          {...register('emoji')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Textarea
          label={isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}
          rows={4}
          {...register('descriptionAr')}
        />
        <Textarea
          label={isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}
          rows={4}
          {...register('descriptionEn')}
        />
      </div>

      <div className="flex flex-wrap gap-4 border-t border-border pt-5">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isActive')} />
          {isAr ? 'نشط' : 'Active'}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isOffer')} />
          {isAr ? 'عرض' : 'Offer'}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isFeatured')} />
          {isAr ? 'وصل حديثاً 🆕' : 'New arrival 🆕'}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('isBestSeller')} />
          {isAr ? 'الأكثر مبيعاً ⭐' : 'Best seller ⭐'}
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-900">
          <input type="checkbox" {...register('isOurProduct')} />
          {isAr ? 'منتجنا (علامتنا التجارية)' : 'Our product (house brand)'}
        </label>
      </div>
    </div>
  );
}
