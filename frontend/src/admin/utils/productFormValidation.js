export function validateProductForm(form, isAr) {
  const errors = {};

  if (!form.nameAr?.trim()) {
    errors.nameAr = isAr ? 'الاسم العربي مطلوب' : 'Arabic name is required';
  }
  if (!form.nameEn?.trim()) {
    errors.nameEn = isAr ? 'الاسم الإنجليزي مطلوب' : 'English name is required';
  }
  if (!form.category) {
    errors.category = isAr ? 'اختر القسم' : 'Category is required';
  }
  if (form.price === '' || form.price == null) {
    errors.price = isAr ? 'سعر البيع مطلوب' : 'Selling price is required';
  } else if (Number(form.price) < 0) {
    errors.price = isAr ? 'سعر البيع لا يمكن أن يكون سالباً' : 'Selling price cannot be negative';
  }
  if (form.wholesalePrice !== '' && form.wholesalePrice != null) {
    const wholesale = Number(form.wholesalePrice);
    const price = Number(form.price);
    if (!Number.isNaN(wholesale) && wholesale < 0) {
      errors.wholesalePrice = isAr ? 'سعر الجملة لا يمكن أن يكون سالباً' : 'Wholesale price cannot be negative';
    } else if (!Number.isNaN(wholesale) && !Number.isNaN(price) && wholesale > price) {
      errors.wholesalePrice = isAr
        ? 'سعر الجملة يجب أن يكون أقل من أو يساوي سعر البيع'
        : 'Wholesale price must be at or below selling price';
    }
  }
  if (form.stock === '' || form.stock == null) {
    errors.stock = isAr ? 'المخزون مطلوب' : 'Stock is required';
  } else if (Number(form.stock) < 0) {
    errors.stock = isAr ? 'المخزون لا يمكن أن يكون سالباً' : 'Stock cannot be negative';
  }
  if (form.oldPrice !== '' && form.oldPrice != null) {
    const old = Number(form.oldPrice);
    const price = Number(form.price);
    if (!Number.isNaN(old) && !Number.isNaN(price) && old > 0 && old <= price) {
      errors.oldPrice = isAr
        ? 'السعر القديم يجب أن يكون أعلى من السعر الحالي'
        : 'Old price must be higher than current price';
    }
  }

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}
