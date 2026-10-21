import mongoose from 'mongoose';

// Business category, e.g. "Jewellery", "Textile", "Doctor"
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [60, 'Category name cannot be longer than 60 characters'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// "Jewellery" and "jewellery" count as the same name
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const Category = mongoose.model('Category', categorySchema);

export default Category;
