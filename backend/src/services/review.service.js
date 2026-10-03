import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { resolveCategoryProductFilter } from '../utils/categoryTree.js';

const REVIEW_STATUSES = ['pending', 'approved', 'hidden', 'rejected'];

async function resolveCategoryIdByRef(categoryRef) {
  if (!categoryRef) return null;
  if (mongoose.Types.ObjectId.isValid(categoryRef)) {
    return new mongoose.Types.ObjectId(String(categoryRef));
  }
  const cat = await Category.findOne({ slug: categoryRef, isActive: true }).select('_id');
  return cat?._id || null;
}

/** Product-level scope before unwinding embedded reviews. */
export async function buildReviewProductScopeMatch(options = {}) {
  const { productId, mainCategory, subCategory, brand } = options;

  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    return {
      _id: new mongoose.Types.ObjectId(String(productId)),
      'reviews.0': { $exists: true },
    };
  }

  const match = { 'reviews.0': { $exists: true } };
  const and = [];

  if (subCategory) {
    const catFilter = await resolveCategoryProductFilter(subCategory);
    if (catFilter) {
      and.push({ category: catFilter });
    }
  } else if (mainCategory) {
    const mainId = await resolveCategoryIdByRef(mainCategory);
    const childFilter = await resolveCategoryProductFilter(mainCategory);
    if (mainId) {
      const orClause = [{ mainCategory: mainId }];
      if (childFilter) {
        orClause.push({ category: childFilter });
      }
      and.push({ $or: orClause });
    }
  }

  if (brand?.trim()) {
    const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    and.push({ brand: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  }

  if (and.length) match.$and = and;
  return match;
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function buildReviewMatchQuery(filters = {}) {
  const {
    status,
    q,
    rating,
    hasReply,
    verified,
    hasImages,
    reported,
    userId,
    dateFrom,
    dateTo,
  } = filters;

  const match = {};
  const and = [];

  if (status) match['reviews.status'] = status;
  if (rating) match['reviews.rating'] = Number(rating);
  if (hasReply === 'yes') match['reviews.adminReply.message'] = { $nin: ['', null] };
  if (hasReply === 'no') {
    and.push({
      $or: [
        { 'reviews.adminReply.message': '' },
        { 'reviews.adminReply.message': null },
        { 'reviews.adminReply.message': { $exists: false } },
      ],
    });
  }
  if (verified === 'yes') match['reviews.verifiedPurchase'] = true;
  if (verified === 'no') match['reviews.verifiedPurchase'] = { $ne: true };
  if (hasImages === 'yes') match['reviews.images.0'] = { $exists: true };
  if (hasImages === 'no') match['reviews.images.0'] = { $exists: false };
  if (reported === 'yes') match['reviews.reportedCount'] = { $gt: 0 };
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    match['reviews.user'] = new mongoose.Types.ObjectId(String(userId));
  }
  if (dateFrom || dateTo) {
    match['reviews.createdAt'] = {};
    if (dateFrom) match['reviews.createdAt'].$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      match['reviews.createdAt'].$lte = end;
    }
  }
  if (q?.trim()) {
    const needle = q.trim();
    and.push({
      $or: [
        { 'reviews.comment': { $regex: needle, $options: 'i' } },
        { 'reviews.title': { $regex: needle, $options: 'i' } },
        { nameAr: { $regex: needle, $options: 'i' } },
        { nameEn: { $regex: needle, $options: 'i' } },
      ],
    });
  }

  if (and.length) match.$and = and;

  return match;
}

export async function aggregateReviewStats(ProductModel) {
  const todayStart = startOfTodayUtc();

  const [facetRow] = await ProductModel.aggregate([
    { $unwind: '$reviews' },
    {
      $facet: {
        byStatus: [
          {
            $group: {
              _id: '$reviews.status',
              count: { $sum: 1 },
            },
          },
        ],
        totals: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              newToday: {
                $sum: {
                  $cond: [{ $gte: ['$reviews.createdAt', todayStart] }, 1, 0],
                },
              },
              withoutReply: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$reviews.adminReply.message', ''] },
                        { $eq: ['$reviews.adminReply.message', null] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              reported: {
                $sum: {
                  $cond: [{ $gt: ['$reviews.reportedCount', 0] }, 1, 0],
                },
              },
              avgApprovedRating: {
                $avg: {
                  $cond: [
                    { $eq: ['$reviews.status', 'approved'] },
                    '$reviews.rating',
                    null,
                  ],
                },
              },
              star5: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$reviews.status', 'approved'] }, { $eq: ['$reviews.rating', 5] }] },
                    1,
                    0,
                  ],
                },
              },
              star4: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$reviews.status', 'approved'] }, { $eq: ['$reviews.rating', 4] }] },
                    1,
                    0,
                  ],
                },
              },
              star3: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$reviews.status', 'approved'] }, { $eq: ['$reviews.rating', 3] }] },
                    1,
                    0,
                  ],
                },
              },
              star2: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$reviews.status', 'approved'] }, { $eq: ['$reviews.rating', 2] }] },
                    1,
                    0,
                  ],
                },
              },
              star1: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ['$reviews.status', 'approved'] }, { $eq: ['$reviews.rating', 1] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        duplicates: [
          {
            $match: {
              'reviews.comment': { $exists: true, $ne: '' },
            },
          },
          {
            $group: {
              _id: { $toLower: { $trim: { input: '$reviews.comment' } } },
              count: { $sum: 1 },
            },
          },
          { $match: { count: { $gte: 3 }, _id: { $ne: '' } } },
          { $count: 'duplicateGroups' },
        ],
      },
    },
  ]);

  const statusMap = Object.fromEntries(
    (facetRow?.byStatus || []).map((row) => [row._id, row.count]),
  );
  const totals = facetRow?.totals?.[0] || {};

  return {
    total: totals.total || 0,
    newToday: totals.newToday || 0,
    pending: statusMap.pending || 0,
    approved: statusMap.approved || 0,
    hidden: statusMap.hidden || 0,
    rejected: statusMap.rejected || 0,
    published: statusMap.approved || 0,
    withoutReply: totals.withoutReply || 0,
    reported: totals.reported || 0,
    averageRating: totals.avgApprovedRating
      ? Math.round(totals.avgApprovedRating * 10) / 10
      : 0,
    starDistribution: {
      5: totals.star5 || 0,
      4: totals.star4 || 0,
      3: totals.star3 || 0,
      2: totals.star2 || 0,
      1: totals.star1 || 0,
    },
    duplicateAlertGroups: facetRow?.duplicates?.[0]?.duplicateGroups || 0,
  };
}

export async function getReviewProductFilterOptions(ProductModel, options = {}) {
  const { mainCategory, subCategory, brand, q } = options;
  const scopeMatch = await buildReviewProductScopeMatch({ mainCategory, subCategory, brand });

  const [totalRow] = await ProductModel.aggregate([
    { $match: scopeMatch },
    { $unwind: '$reviews' },
    { $count: 'count' },
  ]);
  const totalInScope = totalRow?.count || 0;

  const categoryLookup = [
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'cat',
      },
    },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: false } },
    {
      $project: {
        slug: '$cat.slug',
        nameAr: '$cat.nameAr',
        nameEn: '$cat.nameEn',
        icon: '$cat.icon',
        sortOrder: '$cat.sortOrder',
        count: 1,
      },
    },
    { $sort: { sortOrder: 1, nameEn: 1 } },
  ];

  let mainCategories = [];
  let totalAllReviews = totalInScope;

  if (!mainCategory) {
    const [allRow, mains] = await Promise.all([
      ProductModel.aggregate([
        { $match: { 'reviews.0': { $exists: true } } },
        { $unwind: '$reviews' },
        { $count: 'count' },
      ]),
      ProductModel.aggregate([
        { $match: { 'reviews.0': { $exists: true } } },
        { $unwind: '$reviews' },
        { $group: { _id: '$mainCategory', count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        ...categoryLookup,
      ]),
    ]);
    totalAllReviews = allRow[0]?.count || 0;
    mainCategories = mains;
  }

  let subcategories = [];
  if (mainCategory && !subCategory) {
    subcategories = await ProductModel.aggregate([
      { $match: scopeMatch },
      { $unwind: '$reviews' },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: null } } },
      ...categoryLookup,
    ]);
  }

  const brands = await ProductModel.aggregate([
    { $match: scopeMatch },
    { $unwind: '$reviews' },
    { $match: { brand: { $nin: [null, ''] } } },
    { $group: { _id: '$brand', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { name: '$_id', count: 1, _id: 0 } },
  ]);

  const productMatch = { ...scopeMatch };
  if (q?.trim()) {
    const needle = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = { $regex: needle, $options: 'i' };
    productMatch.$or = [
      { nameAr: regex },
      { nameEn: regex },
      { sku: regex },
      { slug: regex },
      { brand: regex },
    ];
  }

  const products = await ProductModel.aggregate([
    { $match: productMatch },
    {
      $project: {
        nameAr: 1,
        nameEn: 1,
        slug: 1,
        sku: 1,
        brand: 1,
        image: { $arrayElemAt: ['$images', 0] },
        reviewCount: { $size: { $ifNull: ['$reviews', []] } },
      },
    },
    { $match: { reviewCount: { $gt: 0 } } },
    { $sort: { reviewCount: -1, nameEn: 1 } },
    { $limit: 400 },
  ]);

  return {
    totalInScope,
    totalAllReviews,
    mainCategories,
    subcategories,
    brands,
    products,
  };
}

export async function queryAdminReviews(ProductModel, options = {}) {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
  const skip = (page - 1) * limit;
  const sortField = options.sort === 'rating' ? 'reviews.rating' : 'reviews.createdAt';
  const sortOrder = options.order === 'asc' ? 1 : -1;

  const productScope = await buildReviewProductScopeMatch(options);
  const match = buildReviewMatchQuery(options);

  const [result] = await ProductModel.aggregate([
    { $match: productScope },
    { $unwind: '$reviews' },
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'reviews.user',
        foreignField: '_id',
        as: 'reviewUser',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'reviews.adminReply.repliedBy',
        foreignField: '_id',
        as: 'replyAdmin',
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'reviews.reReviewGrantedBy',
        foreignField: '_id',
        as: 'reReviewAdmin',
      },
    },
    { $sort: { [sortField]: sortOrder } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: '$reviews._id',
              rating: '$reviews.rating',
              title: '$reviews.title',
              comment: '$reviews.comment',
              status: '$reviews.status',
              verifiedPurchase: '$reviews.verifiedPurchase',
              verifiedPurchaseManual: '$reviews.verifiedPurchaseManual',
              pinned: '$reviews.pinned',
              featured: '$reviews.featured',
              reReviewAllowed: '$reviews.reReviewAllowed',
              reReviewGrantedAt: '$reviews.reReviewGrantedAt',
              images: '$reviews.images',
              reportedCount: '$reviews.reportedCount',
              reports: '$reviews.reports',
              internalNote: '$reviews.internalNote',
              orderId: '$reviews.order',
              createdAt: '$reviews.createdAt',
              updatedAt: '$reviews.updatedAt',
              adminReply: {
                message: '$reviews.adminReply.message',
                repliedAt: '$reviews.adminReply.repliedAt',
                adminName: { $arrayElemAt: ['$replyAdmin.name', 0] },
              },
              user: {
                _id: { $arrayElemAt: ['$reviewUser._id', 0] },
                name: { $arrayElemAt: ['$reviewUser.name', 0] },
                email: { $arrayElemAt: ['$reviewUser.email', 0] },
                phone: { $arrayElemAt: ['$reviewUser.phone', 0] },
                reviewBlocked: { $arrayElemAt: ['$reviewUser.reviewBlocked', 0] },
              },
              reReviewGrantedByName: { $arrayElemAt: ['$reReviewAdmin.name', 0] },
              product: {
                _id: '$_id',
                slug: '$slug',
                nameAr: '$nameAr',
                nameEn: '$nameEn',
                image: { $arrayElemAt: ['$images', 0] },
              },
            },
          },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const total = result?.total?.[0]?.count || 0;

  return {
    data: result?.data || [],
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function exportAdminReviews(ProductModel, filters = {}) {
  const { data } = await queryAdminReviews(ProductModel, { ...filters, page: 1, limit: 5000 });
  return data;
}

export { REVIEW_STATUSES };
