import Category from '../models/Category.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import logActivity from '../utils/activity.js';

// GET /api/categories
// Members see active categories. Admin can add ?all=true to include inactive ones.
export const getCategories = async (req, res) => {
  const showAll = req.user.role === 'admin' && req.query.all === 'true';
  const categories = await Category.find(showAll ? {} : { isActive: true }).sort({ name: 1 });

  res.status(200).json({ success: true, count: categories.length, categories });
};

// POST /api/categories (admin)
export const createCategory = async (req, res) => {
  const { name, isActive } = req.body ?? {};
  const category = await Category.create({ name, isActive });

  await logActivity(req.user._id, 'admin.category_create', `Created category "${category.name}"`);
  res.status(201).json({ success: true, category });
};

// PUT /api/categories/:id (admin)
export const updateCategory = async (req, res) => {
  const { name, isActive } = req.body ?? {};
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  if (name !== undefined) category.name = name;
  if (isActive !== undefined) category.isActive = isActive;
  await category.save();

  await logActivity(req.user._id, 'admin.category_update', `Updated category "${category.name}"`);
  res.status(200).json({ success: true, category });
};

// DELETE /api/categories/:id (admin)
export const deleteCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const membersUsingIt = await User.countDocuments({ 'business.category': category._id });
  if (membersUsingIt > 0) {
    throw new AppError(
      `${membersUsingIt} member(s) use this category. Mark it inactive instead of deleting.`,
      409
    );
  }

  await category.deleteOne();
  await logActivity(req.user._id, 'admin.category_delete', `Deleted category "${category.name}"`);
  res.status(200).json({ success: true, message: 'Category deleted' });
};
