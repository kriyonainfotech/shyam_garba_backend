// Reads ?page=&limit= from the query string with safe defaults
export const getPagination = (query, defaultLimit = 20) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

// Extra info sent with every paginated list
export const pageMeta = (total, { page, limit }) => ({
  total,
  page,
  pages: Math.ceil(total / limit),
});
