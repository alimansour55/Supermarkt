export function parsePagination(query, maxLimit = 100) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function parseSort(query, allowedFields, defaultField = 'createdAt') {
  const field = allowedFields.includes(query.sort) ? query.sort : defaultField;
  const order = query.order === 'asc' ? 1 : -1;
  return { [field]: order };
}

export function paginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}
