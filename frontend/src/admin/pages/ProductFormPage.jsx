import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  DollarSign,
  FolderTree,
  Image as ImageIcon,
  Info,
  Layers,
  Link2,
  Search,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { localizeAdminApiError } from '../constants/productCategoryErrors';
import Loader from '../../components/ui/Loader';
import {
  buildProductSchema,
  buildEmptyFormValues,
  buildFormValuesForAnother,
  mapFormValuesToPayload,
  mapProductToFormValues,
} from '../utils/productFormSchema';
import { buildCategorySelectionFromLeaf, categoryHasChildren, getCategoryBreadcrumb } from '../../utils/categoryHelpers';
import { isVideoUrl } from '../../utils/imageHelpers';
import { adminNewProductUrl } from '../utils/adminProductRoutes';
import ProductFormLayout from '../components/product-form/ProductFormLayout';
import ProductFormSideNav from '../components/product-form/ProductFormSideNav';
import ProductFormStickyBar from '../components/product-form/ProductFormStickyBar';
import ProductPreviewCard from '../components/product-form/ProductPreviewCard';
import ProductBasicsSection from '../components/product-form/ProductBasicsSection';
import ProductPricingSection from '../components/product-form/ProductPricingSection';
import ProductCategorySection from '../components/product-form/ProductCategorySection';
import ProductMediaSection from '../components/product-form/ProductMediaSection';
import ProductVariantsSection from '../components/product-form/ProductVariantsSection';
import ProductSeoAdvancedSection from '../components/product-form/ProductSeoAdvancedSection';
import ProductRelatedSection from '../components/product-form/ProductRelatedSection';

const SECTION_FIELDS = {
  basics: ['nameAr', 'nameEn', 'brand', 'descriptionAr', 'descriptionEn', 'emoji'],
  pricing: ['price', 'wholesalePrice', 'oldPrice', 'stock', 'unit'],
  category: ['mainCategory', 'subCategory', 'category'],
  media: [],
  variants: ['variants'],
  seo: ['slug', 'sku', 'barcode'],
  related: ['specs', 'frequentlyBoughtTogether', 'similarProducts', 'similarMode'],
};

const SECTION_ORDER = ['basics', 'pricing', 'category', 'media', 'variants', 'seo', 'related'];

function mapImagesFromProduct(p) {
  return (p.images || [])
    .filter((img) => typeof img === 'string' && img.startsWith('http'))
    .map((url, index) => ({
      url,
      publicId: p.cloudinaryPublicIds?.[index] || null,
      type: p.mediaTypes?.[index] || (isVideoUrl(url) ? 'video' : 'image'),
    }));
}

export default function ProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillCategoryId = searchParams.get('category') || '';
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
  const [allProducts, setAllProducts] = useState([]);
  const [linkedProducts, setLinkedProducts] = useState([]);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [removingImage, setRemovingImage] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [brands, setBrands] = useState([]);
  const [categoryPickerKey, setCategoryPickerKey] = useState(0);
  const [activeSection, setActiveSection] = useState('basics');
  const formTopRef = useRef(null);

  const safeCategories = Array.isArray(categories) ? categories : [];
  const categoriesRef = useRef(safeCategories);
  categoriesRef.current = safeCategories;

  const resolver = useCallback((values, context, options) => {
    const schema = buildProductSchema(isAr, categoriesRef.current);
    return zodResolver(schema)(values, context, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);

  const {
    register, control, handleSubmit, watch, setValue, reset, trigger,
    formState: { errors },
  } = useForm({
    resolver,
    defaultValues: buildEmptyFormValues(),
    mode: 'onBlur',
  });

  const SECTIONS = useMemo(() => ([
    { id: 'basics', label: isAr ? 'الأساسيات' : 'Basics', icon: Info },
    { id: 'pricing', label: isAr ? 'التسعير والمخزون' : 'Pricing & Stock', icon: DollarSign },
    { id: 'category', label: isAr ? 'القسم' : 'Category', icon: FolderTree },
    { id: 'media', label: isAr ? 'الصور والوسائط' : 'Media', icon: ImageIcon },
    { id: 'variants', label: isAr ? 'المتغيرات' : 'Variants', icon: Layers },
    { id: 'seo', label: isAr ? 'SEO ومتقدم' : 'SEO & Advanced', icon: Search },
    { id: 'related', label: isAr ? 'منتجات ذات صلة' : 'Related products', icon: Link2 },
  ]), [isAr]);

  const errorSections = useMemo(() => {
    const set = new Set();
    Object.entries(SECTION_FIELDS).forEach(([sectionId, fields]) => {
      if (fields.some((f) => errors[f])) set.add(sectionId);
    });
    return set;
  }, [errors]);

  useEffect(() => {
    adminApi.getCategories({ limit: 500 })
      .then(({ data }) => setCategories(Array.isArray(data.data) ? data.data : []))
      .catch(() => setCategories([]));
    adminApi.getProducts({ limit: 300 })
      .then(({ data }) => setAllProducts(Array.isArray(data.data) ? data.data : []))
      .catch(() => setAllProducts([]));
    adminApi.getBrands({ limit: 500, isActive: 'true' })
      .then(({ data }) => setBrands(Array.isArray(data.data) ? data.data : []))
      .catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.getProduct(id)
      .then(({ data }) => {
        const p = data?.data;
        if (!p?._id) {
          setSubmitError(isAr ? 'المنتج غير موجود أو تم حذفه' : 'Product not found or was deleted');
          return;
        }
        reset(mapProductToFormValues(p));
        setLinkedProducts(Array.isArray(p.linkedProducts) ? p.linkedProducts : []);
        setImages(mapImagesFromProduct(p));
        setMeta({
          updatedAt: p.updatedAt,
          stockUpdatedAt: p.stockUpdatedAt,
          stockHistory: p.stockHistory || [],
        });
      })
      .catch((err) => {
        setSubmitError(err.response?.data?.message || (isAr ? 'تعذر تحميل المنتج' : 'Could not load product'));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const subCategory = watch('subCategory');
  const mainCategory = watch('mainCategory');

  useEffect(() => {
    if (!subCategory || mainCategory || !safeCategories.length) return;
    const selection = buildCategorySelectionFromLeaf(safeCategories, subCategory);
    if (selection.level1) {
      setValue('mainCategory', String(selection.level1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategory, mainCategory, safeCategories.length]);

  useEffect(() => {
    if (isEdit || !prefillCategoryId || !safeCategories.length) return;
    const selection = buildCategorySelectionFromLeaf(safeCategories, prefillCategoryId);
    if (!selection.leafId) return;
    if (subCategory) return;
    setValue('mainCategory', selection.level1 ? String(selection.level1) : '');
    setValue('subCategory', String(selection.leafId));
    setValue('category', String(selection.leafId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, prefillCategoryId, safeCategories.length]);

  const handleReorder = useCallback((newImages) => {
    setImages(newImages);
    if (isEdit && id) {
      adminApi.reorderProductImages(id, newImages).catch(() => {});
    }
  }, [isEdit, id]);

  const handleRemoveImage = async (entry) => {
    if (!isEdit || !entry.publicId) {
      setImages((prev) => prev.filter((img) => img.url !== entry.url));
      return;
    }
    setRemovingImage(entry.publicId);
    setSubmitError('');
    try {
      const { data } = await adminApi.removeProductImage(id, entry.publicId);
      setImages(mapImagesFromProduct(data.data));
    } catch (err) {
      setSubmitError(err.response?.data?.message || (isAr ? 'تعذر حذف الصورة' : 'Failed to remove image'));
    } finally {
      setRemovingImage(null);
    }
  };

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resetForAnother = (previousValues) => {
    reset(buildFormValuesForAnother(previousValues));
    setCategoryPickerKey((k) => k + 1);
    setImages([]);
    setFiles([]);
    setMeta({ updatedAt: null, stockUpdatedAt: null, stockHistory: [] });
    setSubmitError('');
    setActiveSection('basics');
    if (prefillCategoryId) {
      navigate(adminNewProductUrl(), { replace: true });
    }
    scrollToTop();
  };

  const onInvalid = (formErrors) => {
    const firstSection = SECTION_ORDER.find((sectionId) =>
      SECTION_FIELDS[sectionId].some((f) => formErrors[f]));
    if (firstSection) setActiveSection(firstSection);
    setSubmitError(isAr
      ? 'بعض الحقول تحتاج مراجعة — تحقق من الحقول المُحددة بالأحمر.'
      : 'Some fields need attention — check the fields highlighted in red.');
    scrollToTop();
  };

  const onValid = async (values, addAnother) => {
    setSaving(true);
    setSubmitError('');
    try {
      const payload = mapFormValuesToPayload(values, safeCategories);

      let productId = id;
      if (isEdit) {
        const { data } = await adminApi.updateProduct(id, payload);
        productId = data.data._id;
        setMeta({
          updatedAt: data.data.updatedAt,
          stockUpdatedAt: data.data.stockUpdatedAt,
          stockHistory: data.data.stockHistory || [],
        });
      } else {
        const { data } = await adminApi.createProduct(payload);
        productId = data.data._id;
      }

      if (files.length) {
        await adminApi.uploadImages(productId, files);
      }

      if (addAnother && !isEdit) {
        resetForAnother(values);
        return;
      }

      navigate('/admin/products');
    } catch (err) {
      setSubmitError(localizeAdminApiError(
        err,
        isAr,
        'Could not save the product — check the form and try again.',
        'تعذّر حفظ المنتج — تحقق من النموذج وحاول مرة أخرى.',
      ));
      scrollToTop();
    } finally {
      setSaving(false);
    }
  };

  const submit = (addAnother) => handleSubmit((values) => onValid(values, addAnother), onInvalid)();

  const prefillCategory = prefillCategoryId && !isEdit
    ? safeCategories.find((c) => String(c._id) === String(prefillCategoryId))
    : null;
  const prefillBreadcrumb = prefillCategory
    ? getCategoryBreadcrumb(prefillCategory, safeCategories, isAr)
    : '';

  if (loading) {
    return <div className="flex justify-center py-20"><Loader size="lg" /></div>;
  }

  return (
    <div ref={formTopRef} className="mx-auto max-w-6xl space-y-4">
      {submitError && (
        <div className="flex items-start gap-2 rounded-xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{submitError}</p>
        </div>
      )}

      {prefillBreadcrumb && watch('subCategory') && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm text-primary-900">
          {isAr ? `القسم مُعبّأ مسبقًا: ${prefillBreadcrumb}` : `Category pre-filled: ${prefillBreadcrumb}`}
          {categoryHasChildren(safeCategories, watch('subCategory')) && (
            <p className="mt-1 text-xs text-amber-800">
              {isAr
                ? 'هذا القسم له أقسام فرعية — اختر مستوى أعمق قبل الحفظ.'
                : 'This category has children — pick a deeper subcategory before saving.'}
            </p>
          )}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} noValidate>
        <ProductFormLayout
          isAr={isAr}
          sideNav={(
            <ProductFormSideNav
              sections={SECTIONS}
              active={activeSection}
              onSelect={setActiveSection}
              errorSections={errorSections}
            />
          )}
          previewCard={<ProductPreviewCard watch={watch} images={images} isAr={isAr} />}
          stickyBar={(
            <ProductFormStickyBar
              isAr={isAr}
              isEdit={isEdit}
              saving={saving}
              onSave={() => submit(false)}
              onSaveAndAddAnother={() => submit(true)}
              onCancel={() => navigate('/admin/products')}
              updatedAt={meta.updatedAt}
              stockUpdatedAt={meta.stockUpdatedAt}
            />
          )}
        >
          <div className={activeSection === 'basics' ? '' : 'hidden'}>
            <ProductBasicsSection register={register} control={control} errors={errors} isAr={isAr} brands={brands} />
          </div>
          <div className={activeSection === 'pricing' ? '' : 'hidden'}>
            <ProductPricingSection
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              isAr={isAr}
              meta={meta}
              isEdit={isEdit}
            />
          </div>
          <div className={activeSection === 'category' ? '' : 'hidden'} key={categoryPickerKey}>
            <ProductCategorySection
              watch={watch}
              setValue={setValue}
              trigger={trigger}
              errors={errors}
              isAr={isAr}
              categories={safeCategories}
            />
          </div>
          <div className={activeSection === 'media' ? '' : 'hidden'}>
            <ProductMediaSection
              images={images}
              files={files}
              onImagesChange={setImages}
              onFilesChange={setFiles}
              onRemoveImage={handleRemoveImage}
              onReorder={handleReorder}
              removingImage={removingImage}
              isAr={isAr}
              saving={saving}
            />
          </div>
          <div className={activeSection === 'variants' ? '' : 'hidden'}>
            <ProductVariantsSection control={control} register={register} watch={watch} setValue={setValue} isAr={isAr} />
          </div>
          <div className={activeSection === 'seo' ? '' : 'hidden'}>
            <ProductSeoAdvancedSection
              register={register}
              watch={watch}
              setValue={setValue}
              isAr={isAr}
              categories={safeCategories}
              productId={id}
            />
          </div>
          <div className={activeSection === 'related' ? '' : 'hidden'}>
            <ProductRelatedSection
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              isAr={isAr}
              products={allProducts}
              seedProducts={linkedProducts}
              categories={safeCategories}
              brands={brands}
            />
          </div>
        </ProductFormLayout>
      </form>
    </div>
  );
}
