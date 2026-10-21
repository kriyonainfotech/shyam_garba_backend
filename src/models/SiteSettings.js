import mongoose from 'mongoose';

const text = (max) => ({ type: String, trim: true, maxlength: max, default: '' });

// Heading shown above a website section: small red line, big title, sub text
const headSchema = new mongoose.Schema(
  { eyebrow: text(80), title: text(150), subtitle: text(600) },
  { _id: false }
);

// Block with an image, text and a button (featured course, about us)
const blockSchema = new mongoose.Schema(
  {
    eyebrow: text(80),
    title: text(150),
    text: text(3000),
    image: text(300),
    buttonText: text(40),
    buttonLink: text(300),
  },
  { _id: false }
);

const SECTION_KEYS = [
  'ticker',
  'team',
  'sponsors',
  'featured',
  'courses',
  'about',
  'locations',
  'testimonials',
  'events',
  'features',
  'venues',
  'gallery',
  'faq',
  'contact',
  // parts of the footer
  'footerAbout',
  'footerMenu',
  'footerExplore',
  'footerContact',
  // floating WhatsApp enquiry button (bottom right)
  'whatsappButton',
];

// Website colours (default = exactly the Shyam Garba logo: navy, orange, green on white)
const color = (value) => ({
  type: String,
  trim: true,
  default: value,
  match: [/^#[0-9a-fA-F]{6}$/, 'Colour must look like #1a2b3c'],
});
const themeSchema = new mongoose.Schema(
  {
    primary: color('#2e3192'), // navy: header, buttons on light parts
    dark: color('#1b1f6e'), // page background of the dark parts
    accent: color('#f47920'), // orange: main buttons, ribbons, tags
    secondary: color('#00a14b'), // green: small details, ticks, chips
    highlight: color('#ffffff'), // white: titles on the dark background, borders
    light: color('#fff8ef'), // warm white: background of the light part
    headingFont: { type: String, enum: ['Lilita One', 'Baloo 2', 'Poppins', 'Rozha One'], default: 'Lilita One' },
  },
  { _id: false }
);

// Big centre part at the top of the home page
const heroSchema = new mongoose.Schema(
  {
    tickerText: text(40), // short word repeated in the dotted strip at the top
    eyebrow: text(120), // small text above the logo
    logo: text(300), // big logo in the middle (empty = main logo)
    // design turning behind the logo
    ringStyle: { type: String, enum: ['mandala', 'rays', 'glow', 'petals', 'none'], default: 'mandala' },
    ribbon: text(80), // ribbon under the logo (e.g. dates)
    text: text(600),
    statusText: text(120), // small blinking pill (e.g. "Admissions open")
    buttonText: text(40),
    buttonLink: text(300),
    phoneText: text(60), // second button, e.g. "Call for help"
    phone: text(20),
    shareText: text(60), // "Share on WhatsApp" link (empty = hidden)
  },
  { _id: false }
);

// One switch per section, so the admin can hide a whole section
const sectionsSchema = new mongoose.Schema(
  Object.fromEntries(SECTION_KEYS.map((key) => [key, { type: Boolean, default: true }])),
  { _id: false }
);

// All editable texts and images of the public website (only one document).
const siteSettingsSchema = new mongoose.Schema(
  {
    siteName: text(80),
    tagline: text(80),
    logo: text(300),

    theme: { type: themeSchema, default: () => ({}) },
    hero: { type: heroSchema, default: () => ({}) },

    sections: { type: sectionsSchema, default: () => ({}) },

    featured: { type: blockSchema, default: () => ({}) },
    about: { type: blockSchema, default: () => ({}) },

    coursesHead: { type: headSchema, default: () => ({}) },
    locationsHead: { type: headSchema, default: () => ({}) },
    testimonialsHead: { type: headSchema, default: () => ({}) },
    teamHead: { type: headSchema, default: () => ({}) },
    eventsHead: { type: headSchema, default: () => ({}) },
    galleryHead: { type: headSchema, default: () => ({}) },
    featuresHead: { type: headSchema, default: () => ({}) },
    venuesHead: { type: headSchema, default: () => ({}) },
    faqHead: { type: headSchema, default: () => ({}) },
    contactHead: { type: headSchema, default: () => ({}) },

    // Button on every event card + app store links in the footer
    app: {
      eventButtonText: text(40),
      eventButtonLink: text(300),
      text: text(200),
      playStore: text(300),
      appStore: text(300),
    },

    footer: {
      about: text(1000),
      companyName: text(120),
      gst: text(40),
      address: text(500),
      phone: text(20),
      email: text(120),
      copyright: text(200),
      facebook: text(300),
      instagram: text(300),
      youtube: text(300),
      whatsapp: text(20),
      whatsappMessage: text(300), // text already typed when the WhatsApp button is clicked
    },
  },
  { timestamps: true }
);

export const SITE_SECTION_KEYS = SECTION_KEYS;

const SiteSettings = mongoose.model('SiteSettings', siteSettingsSchema);

export default SiteSettings;
