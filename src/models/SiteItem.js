import mongoose from 'mongoose';

// What each type is used for on the website:
//   ticker      word in the moving ribbon under the hero: title
//   sponsor     logo in the sponsor ribbon: title, image, link
//   course      offline course card: title, text, image, linkText + link
//   location    city tile: title, image
//   testimonial student review: title = name, text = review, image = avatar
//   team        person: title = name, subtitle = role, image
//   gallery     photo: image, title = caption
//   feature     highlight chip: title, icon
//   faq         question: title = question, text = answer
//   contact     help card: title, text, icon, linkText + link
//   footerLink  "Explore" link in the footer: title, link
export const SITE_ITEM_TYPES = [
  'ticker',
  'sponsor',
  'course',
  'location',
  'testimonial',
  'team',
  'gallery',
  'feature',
  'faq',
  'contact',
  'footerLink',
];

const siteItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: { values: SITE_ITEM_TYPES, message: 'Invalid item type' },
    },
    title: { type: String, trim: true, maxlength: 150, default: '' },
    subtitle: { type: String, trim: true, maxlength: 150, default: '' },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    image: { type: String, trim: true, maxlength: 300, default: '' },
    image2: { type: String, trim: true, maxlength: 300, default: '' },
    icon: { type: String, trim: true, maxlength: 40, default: '' },
    linkText: { type: String, trim: true, maxlength: 40, default: '' },
    link: { type: String, trim: true, maxlength: 300, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

siteItemSchema.index({ type: 1, order: 1 });

const SiteItem = mongoose.model('SiteItem', siteItemSchema);

export default SiteItem;
