export const DEFAULT_INVOICE_COLUMNS = {
  sku: false,
  unitPrice: true,
  lineTotal: true,
};

export const DEFAULT_INVOICE = {
  titleAr: 'فاتورة ضريبية',
  titleEn: 'Tax Invoice',
  documentPrefixAr: '',
  documentPrefixEn: '',
  companyNameAr: 'سوق+ للتجارة',
  companyNameEn: 'MarketPlus Retail',
  companyAddressAr: 'شارع التحرير، مدينة نصر، القاهرة، مصر',
  companyAddressEn: 'Tahrir Street, Nasr City, Cairo, Egypt',
  taxRegistrationNumber: '123-456-789',
  taxIdLabelAr: 'الرقم الضريبي',
  taxIdLabelEn: 'Tax ID',
  paymentMethodLabelAr: 'طريقة الدفع',
  paymentMethodLabelEn: 'Payment method',
  headerNoteAr: 'شكراً لاختياركم سوق+ — نتمنى لكم تسوقاً ممتعاً',
  headerNoteEn: 'Thank you for choosing MarketPlus — happy shopping!',
  footerNoteAr: 'للاستفسارات: اتصل بنا على الرقم الموضح أعلاه',
  footerNoteEn: 'For questions, call the support number shown above.',
  termsAr: 'هذه فاتورة إلكترونية صادرة من نظام سوق+ ولا تحتاج إلى توقيع أو ختم.',
  termsEn: 'This is an electronic invoice issued by MarketPlus and does not require a signature or stamp.',
  bankDetailsAr: '',
  bankDetailsEn: '',

  // Appearance
  accentColor: '#0f766e',
  pageSize: 'A4',
  logoPosition: 'end',
  logoSize: 'md',

  // Display toggles
  showLogo: true,
  showTaxId: true,
  showOrderStatus: true,
  showPaymentStatus: true,
  showPaymentMethod: true,
  showSavings: true,
  showBankDetails: false,
  showStamp: false,
  showQr: false,

  // Assets
  stampUrl: '',

  // Table columns
  columns: { ...DEFAULT_INVOICE_COLUMNS },

  // Free key/value rows shown in the meta card (max 8)
  customRows: [],

  labels: {
    invoiceAr: 'فاتورة',
    invoiceEn: 'Invoice',
    orderNumberAr: 'رقم الطلب',
    orderNumberEn: 'Order no.',
    dateAr: 'التاريخ',
    dateEn: 'Date',
    customerAr: 'بيانات العميل',
    customerEn: 'Customer',
    itemsAr: 'المنتجات',
    itemsEn: 'Items',
    itemAr: 'المنتج',
    itemEn: 'Product',
    qtyAr: 'الكمية',
    qtyEn: 'Qty',
    priceAr: 'السعر',
    priceEn: 'Price',
    lineTotalAr: 'المجموع',
    lineTotalEn: 'Total',
    subtotalAr: 'المجموع الفرعي',
    subtotalEn: 'Subtotal',
    deliveryAr: 'التوصيل',
    deliveryEn: 'Delivery',
    discountAr: 'الخصم',
    discountEn: 'Discount',
    pointsDiscountAr: 'خصم النقاط',
    pointsDiscountEn: 'Points discount',
    grandTotalAr: 'الإجمالي',
    grandTotalEn: 'Grand total',
    orderStatusAr: 'حالة الطلب',
    orderStatusEn: 'Order status',
    paymentStatusAr: 'حالة الدفع',
    paymentStatusEn: 'Payment status',
    phoneAr: 'الهاتف',
    phoneEn: 'Phone',
  },
};

/** Sample order used for admin invoice preview. */
export const SAMPLE_INVOICE_ORDER = {
  _id: 'demo000000000000000000001',
  orderNumber: 'DEMO-2026-001',
  createdAt: new Date(),
  phone: '01001234567',
  orderStatus: 'delivered',
  paymentStatus: 'paid',
  paymentMethod: 'cod',
  subtotal: 181.98,
  deliveryFee: 29.99,
  discount: 15,
  pointsDiscount: 0,
  total: 196.97,
  shippingAddress: {
    street: 'شارع التحرير',
    building: '12',
    area: 'مدينة نصر',
    city: 'القاهرة',
    governorate: 'القاهرة',
  },
  items: [
    { nameAr: 'ألوفين 600 مل', nameEn: 'Alofin 600ml', sku: 'ALF-600', quantity: 2, price: 5 },
    { nameAr: 'منظف أرضيات 2 لتر', nameEn: 'Floor cleaner 2L', sku: 'FCL-2000', quantity: 1, price: 85.99 },
    { nameAr: 'صابون سائل 500 مل', nameEn: 'Liquid soap 500ml', sku: 'LSP-500', quantity: 3, price: 28.33 },
  ],
};

export const SAMPLE_INVOICE_USER = {
  name: 'محمد أحمد',
  email: 'customer@example.com',
};
