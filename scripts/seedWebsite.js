// Fills the public website with DUMMY content (texts + placeholder images)
// so every section is visible. Replace/delete it from Admin > Website.
//
// Usage:
//   npm run seed-website            -> only fills what is empty (lists with no items,
//                                      settings fields with no value); never overwrites
//   npm run seed-website -- --reset -> deletes all website items and settings first
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { UPLOAD_DIR } from '../src/config/paths.js';
import SiteItem from '../src/models/SiteItem.js';
import SiteSettings from '../src/models/SiteSettings.js';
import Venue from '../src/models/Venue.js';

const reset = process.argv.includes('--reset');
const SITE_DIR = path.join(UPLOAD_DIR, 'site');

// Colours of the Shyam Garba logo
const PALETTES = [
  ['#2e3192', '#f47920'],
  ['#f47920', '#ffffff'],
  ['#00a14b', '#2e3192'],
  ['#1b1f6e', '#2e3192'],
  ['#f47920', '#00a14b'],
  ['#2e3192', '#00a14b'],
  ['#d35400', '#f47920'],
  ['#1b1f6e', '#f47920'],
];

// The real Shyam Garba logo (put in uploads/site by the developer):
// round badge for the header/footer, full logo with "SHYAM GARBA ENTERTAINMENT" for the hero
const LOGO = '/uploads/site/shyam-garba-logo.webp';
const HERO_LOGO = '/uploads/site/shyam-garba-logo-full.webp';

// Dummy photo (free Pexels photo saved as uploads/site/dummy-<name>.jpg), when it is there
const dummyPhoto = (name) =>
  fs.existsSync(path.join(SITE_DIR, `dummy-${name}.jpg`)) ? `/uploads/site/dummy-${name}.jpg` : null;

// Returns the dummy photo, or writes a simple placeholder picture (gradient + label)
// and returns its public path.
// corner: put a small label in the bottom-right corner (for big backgrounds with text on top)
const placeholder = (name, label, width, height, paletteIndex = 0, { corner = false } = {}) => {
  const photo = dummyPhoto(name);
  if (photo) return photo;
  const [from, to] = PALETTES[paletteIndex % PALETTES.length];
  const size = Math.round(Math.min(width, height) / 9);
  const labels = corner
    ? `<text x="${width - 30}" y="${height - 30}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#fff" opacity="0.7">${label} · dummy ${width}×${height}</text>`
    : `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="#fff">${label}</text>
  <text x="50%" y="${50 + (size / height) * 100}%" dy="${size * 0.6}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(size * 0.4)}" fill="#fff" opacity="0.8">Dummy image · ${width}×${height}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width * 0.85}" cy="${height * 0.2}" r="${Math.min(width, height) * 0.25}" fill="#fff" opacity="0.08"/>
  <circle cx="${width * 0.1}" cy="${height * 0.9}" r="${Math.min(width, height) * 0.3}" fill="#fff" opacity="0.06"/>
  ${labels}
</svg>`;
  fs.writeFileSync(path.join(SITE_DIR, `dummy-${name}.svg`), svg);
  return `/uploads/site/dummy-${name}.svg`;
};

// Dummy sponsor logo: a small mark + "Brand N" on a transparent background
const sponsorLogo = (i) => {
  const [mark, word] = PALETTES[i % PALETTES.length];
  const shapes = [
    `<circle cx="45" cy="60" r="26" fill="${mark}"/>`,
    `<rect x="19" y="34" width="52" height="52" rx="12" fill="${mark}"/>`,
    `<polygon points="45,30 73,86 17,86" fill="${mark}"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
  ${shapes[i % shapes.length]}
  <text x="45" y="69" text-anchor="middle" font-family="Arial Black, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#fff">${i}</text>
  <text x="86" y="62" font-family="Arial Black, Segoe UI, sans-serif" font-size="34" font-weight="900" fill="${word}">BRAND</text>
  <text x="88" y="88" font-family="Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="4" fill="#555">SPONSOR ${i}</text>
</svg>`;
  fs.writeFileSync(path.join(SITE_DIR, `dummy-sponsor-${i}.svg`), svg);
  return `/uploads/site/dummy-sponsor-${i}.svg`;
};

const items = () => {
  let order = 0;
  const next = () => (order += 1);
  const list = [];
  const add = (type, data) => list.push({ type, order: next(), isActive: true, ...data });

  // Moving ribbon under the hero
  ['Shyam Garba International', 'Garba Classes', 'Dandiya Raas', 'Navratri 2026', 'Surat', 'Ahmedabad', 'Mumbai', 'Dubai'].forEach(
    (title) => add('ticker', { title })
  );

  // Sponsor ribbon
  for (let i = 1; i <= 6; i++) {
    add('sponsor', { title: `Sponsor ${i}`, image: sponsorLogo(i) });
  }

  // Offline courses
  [
    ['Beginner Garba', 'A 2 month course for first timers. Basic steps, rhythm and confidence.'],
    ['Master Garba', 'A 3 month course focusing on rhythms, spins, sittings and grace.'],
    ['Intensive Program', 'New styles and rhythms with effective teaching methods and techniques.'],
  ].forEach(([title, text], i) =>
    add('course', { title, text, image: placeholder(`course-${i + 1}`, 'Course image', 600, 450, i) })
  );

  // Locations
  ['Surat', 'Ahmedabad', 'Mumbai', 'Vadodara', 'Dubai', 'London', 'USA', 'Canada'].forEach((city, i) =>
    add('location', { title: city, image: placeholder(`location-${i + 1}`, 'City photo', 400, 400, i, { corner: true }) })
  );

  // Testimonials
  [
    ['Student Name 1', 'Best garba classes in town! The instructors are so kind and humble. Learning something new every day.'],
    ['Student Name 2', 'Very experienced faculty. They break down every step very well. Encouraging environment.'],
    ['Student Name 3', 'Three months of amazing learning. Super cool teachers and so much perfection in every step.'],
    ['Student Name 4', 'The best garba class I have ever been to. The course structure is planned really well.'],
  ].forEach(([title, text], i) =>
    add('testimonial', { title, text, image: placeholder(`student-${i + 1}`, title.split(' ').pop(), 200, 200, i + 2) })
  );

  // Team / lineup
  [
    ['Founder Name', 'Founder'],
    ['Co-founder Name', 'Co-founder'],
    ['Choreographer Name', 'Choreographer'],
    ['Singer Name', 'Singer'],
  ].forEach(([title, subtitle], i) =>
    add('team', { title, subtitle, image: placeholder(`team-${i + 1}`, 'Photo', 500, 500, i + 6) })
  );

  // Gallery
  for (let i = 1; i <= 8; i++) {
    add('gallery', { title: `Gallery photo ${i}`, image: placeholder(`gallery-${i}`, `Photo ${i}`, 800, 600, i) });
  }

  // Highlight chips
  [
    ['Fully air-conditioned studios', 'snowflake'],
    ['Certified choreographers', 'crown'],
    ['Book events on the app', 'smartphone'],
    ['Classes in India & abroad', 'globe'],
    ['Kids, adults & seniors batches', 'users'],
    ['Navratri performance stage', 'sparkles'],
  ].forEach(([title, icon]) => add('feature', { title, icon }));

  // FAQ
  [
    ['Who can join Shyam Garba classes?', 'Anyone! We have batches for kids, adults and seniors - no experience needed. (Dummy answer)'],
    ['Where are the classes held?', 'See the class venues on this page or the Class Locations page in your account. (Dummy answer)'],
    ['How do I book an event pass?', 'Download the Shyam Garba app, log in and book your pass. Your QR entry pass appears in My Bookings. (Dummy answer)'],
    ['Can I attend a trial class?', 'Yes, contact us on WhatsApp to book a free trial class. (Dummy answer)'],
    ['Do you teach outside India?', 'Yes, we run workshops in many countries. Write to us for details. (Dummy answer)'],
  ].forEach(([title, text]) => add('faq', { title, text }));

  // "We're a call away" cards
  [
    ['Questions about classes', 'Call us on +91 98765 43210', 'phone', 'Call now', 'tel:9876543210'],
    ['Chat with us on WhatsApp', 'Admissions, timings and fees', 'message-circle', 'Open WhatsApp', 'whatsapp'],
    ['Email us', 'info@example.com', 'mail', 'Send email', 'mailto:info@example.com'],
    ['Become a member', 'Sign up to see events and keep your bookings in one place', 'smartphone', 'Join now', '/register'],
  ].forEach(([title, text, icon, linkText, link]) => add('contact', { title, text, icon, linkText, link }));

  // Footer "Explore" links
  [
    ['Member Login', '/login'],
    ['Become a Member', '/register'],
    ['Frequently Asked Questions', '#faq'],
    ['Become a Teacher', '#help'],
  ].forEach(([title, link]) => add('footerLink', { title, link }));

  return list;
};

const settings = () => ({
  siteName: 'Shyam Garba',
  tagline: 'Dance International',
  logo: LOGO,
  theme: {
    primary: '#2e3192',
    dark: '#1b1f6e',
    accent: '#f47920',
    secondary: '#00a14b',
    highlight: '#ffffff',
    light: '#fff8ef',
    headingFont: 'Lilita One',
  },
  hero: {
    tickerText: 'SG',
    eyebrow: 'Shyam Garba International presents',
    logo: HERO_LOGO,
    ribbon: 'Ab Garba Karegi Puri Duniya',
    text: 'Garba, Dandiya and dance classes for every age - in India and around the world. (Dummy text, change it from Admin > Website > Hero)',
    statusText: 'Admissions open - join a batch today',
    buttonText: 'Join now',
    buttonLink: '/register',
    phoneText: 'Call for help',
    phone: '9876543210',
    shareText: 'Share on WhatsApp',
  },
  featured: {
    eyebrow: 'Master Garba moves',
    title: 'Dummy Featured Course Title',
    text:
      "This is dummy text for the featured course. Describe your most popular course here: who teaches it, what students will learn and why they will love it.\n\nIn the Master Garba course students learn the classic two-clap and three-clap garba, Dodhiyu, Hinch, Popatiyu and the modern Sheri garba styles. Every week ends with a fun group session where the whole batch dances together on live dhol.\n\nThe course runs for 3 months with 3 classes a week. Batches are available for kids, adults and seniors, and every student gets to perform on the Shyam Garba Navratri stage at the end of the course.\n\nChange this text from Admin > Website > Featured.",
    image: placeholder('featured', 'Featured course', 900, 600, 7),
    buttonText: '',
    buttonLink: '',
  },
  about: {
    eyebrow: 'About us',
    title: 'Shyam Garba International',
    text:
      "Dummy about text. Shyam Garba, while rooted in tradition, also brings modern steps and styles for the younger generation. Write the story of your classes, your founders and your achievements here.\n\nWhat started as a small garba class in Surat has grown into Shyam Garba International, with batches across Surat, Ahmedabad and abroad. Thousands of students have learned garba and dandiya with us, from small kids to grandparents.\n\nOur choreographers have performed at Navratri festivals, weddings, corporate events and music videos. Every year we host the Shyam Garba Navratri, where our students perform with live singers and dhol.\n\nChange this text from Admin > Website > About Us.",
    image: placeholder('about', 'About us photo', 800, 760, 1),
    buttonText: 'More About Us',
    buttonLink: '#help',
  },
  coursesHead: { eyebrow: 'Our courses', title: 'Shyam Garba Offline Courses', subtitle: '' },
  locationsHead: {
    eyebrow: 'Our locations',
    title: 'Shyam Garba India & International',
    subtitle: 'Explore all of our locations and pick the one near you to start learning with us!',
  },
  testimonialsHead: {
    eyebrow: 'Testimonials',
    title: 'Our Happy Students',
    subtitle: 'We love to teach and grow our horizon to new opportunities',
  },
  teamHead: {
    eyebrow: 'The lineup',
    title: 'Faces of Shyam Garba',
    subtitle: 'Dummy text. Tell visitors about your founders, choreographers and artists.',
  },
  eventsHead: {
    eyebrow: 'Upcoming events',
    title: 'Book Your Passes',
    subtitle: 'Book your seats from the Shyam Garba app and get your QR entry pass instantly.',
  },
  galleryHead: { eyebrow: 'Memories', title: 'Our Gallery', subtitle: '' },
  featuresHead: { eyebrow: 'Why Shyam Garba', title: 'Signature Features', subtitle: '' },
  venuesHead: { eyebrow: 'Getting there', title: 'Our Class Venues', subtitle: 'Find a Shyam Garba class near you and tap "Get directions" for the route.' },
  faqHead: { eyebrow: 'Good to know', title: 'Frequently Asked Questions', subtitle: '' },
  contactHead: { eyebrow: 'Need help?', title: "We're a Call Away", subtitle: '' },
  app: {
    eventButtonText: 'Book on the app',
    eventButtonLink: '', // no link: the button only shows the text
    text: 'Get the Shyam Garba app to book passes and keep them on your phone.',
    playStore: '', // add the real store links when the app is live
    appStore: '',
  },
  footer: {
    about: 'Dummy footer text. Shyam Garba brings tradition and modern dance together for every generation.',
    companyName: 'Shyam Garba International',
    gst: 'GST: YOUR-GST-NUMBER',
    address: 'Your full address here, City - 000000',
    phone: '9876543210',
    email: 'info@example.com',
    copyright: 'Shyam Garba International. All rights reserved.',
    facebook: 'https://facebook.com',
    instagram: 'https://instagram.com',
    youtube: 'https://youtube.com',
    whatsapp: '9876543210',
    whatsappMessage: 'Hi Shyam Garba, I would like to know more about your garba classes.',
  },
});

// Dummy class venues (Admin > Website > Class Venues). Locations are approximate.
const VENUES = [
  {
    name: 'Shyam Garba Varachha',
    address: 'Yogi Chowk Ground, Puna-Simada Rd, Chikuwadi',
    area: 'Varachha',
    city: 'Surat',
    location: { lat: 21.2105, lng: 72.887 },
    contactPerson: 'Class coordinator',
    contactNumber: '9876543211',
    timings: 'Mon - Sat · 7:00 PM - 10:00 PM',
  },
  {
    name: 'Shyam Garba Katargam',
    address: 'Laxmikant Society Wadi, Gajera Rd, opp. Vaikunthdham Society',
    area: 'Katargam',
    city: 'Surat',
    location: { lat: 21.23331, lng: 72.83219 },
    contactPerson: 'Class coordinator',
    contactNumber: '9876543212',
    timings: 'Mon - Fri · 6:30 PM - 9:30 PM',
  },
  {
    name: 'Shyam Garba Adajan',
    address: 'Fortune High Street, Subhash Chandra Bose Marg',
    area: 'Adajan',
    city: 'Surat',
    location: { lat: 21.1959, lng: 72.7933 },
    contactPerson: 'Class coordinator',
    contactNumber: '9876543213',
    timings: 'Tue - Sun · 7:00 PM - 9:00 PM',
  },
  {
    name: 'Shyam Garba Ahmedabad',
    address: 'Community Hall, Drive-In Road',
    area: 'Memnagar',
    city: 'Ahmedabad',
    location: { lat: 23.0505, lng: 72.533 },
    contactPerson: 'Class coordinator',
    contactNumber: '9876543214',
    timings: 'Sat - Sun · 6:00 PM - 9:00 PM',
  },
];

// Keeps every value already in "target"; takes the dummy value only where it is empty
const fill = (target, source) =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) => {
      const have = target?.[key];
      if (value && typeof value === 'object') return [key, fill(have, value)];
      return [key, have === undefined || have === null || have === '' ? value : have];
    })
  );

try {
  await mongoose.connect(process.env.MONGO_URI);
  fs.mkdirSync(SITE_DIR, { recursive: true });

  if (reset) {
    await SiteItem.deleteMany({});
    await SiteSettings.deleteMany({});
    console.log('Old website content removed');
  }

  // The old hero slider was replaced by the hero settings
  await SiteItem.deleteMany({ type: 'slide' });

  // Dummy items only for lists that are still empty
  const all = items();
  const emptyTypes = [];
  for (const type of new Set(all.map((i) => i.type))) {
    if (!(await SiteItem.exists({ type }))) emptyTypes.push(type);
  }
  const created = await SiteItem.insertMany(all.filter((i) => emptyTypes.includes(i.type)));
  console.log(created.length ? `Added ${created.length} dummy items (${emptyTypes.join(', ')})` : 'All website lists already have items');

  // Dummy venues only when there are none yet
  if (!(await Venue.exists({}))) {
    await Venue.insertMany(VENUES.map((v) => ({ ...v, isActive: true })));
    console.log(`Added ${VENUES.length} dummy class venues`);
  }

  // Old coloured dummy boxes (dummy-*.svg) -> dummy photos. Pictures uploaded by the admin are never touched.
  const toPhoto = (value) => {
    const name = /^\/uploads\/site\/dummy-(.+)\.svg$/.exec(value || '')?.[1];
    return (name && dummyPhoto(name)) || value;
  };
  let swapped = 0;
  for (const item of await SiteItem.find({ image: /^\/uploads\/site\/dummy-.+\.svg$/ })) {
    const photo = toPhoto(item.image);
    if (photo !== item.image) {
      item.image = photo;
      await item.save();
      swapped += 1;
    }
  }

  // Settings: fill only the empty fields, admin changes are kept
  const doc = (await SiteSettings.findOne()) || new SiteSettings();
  const current = doc.toObject();
  const filled = fill(current, settings());
  if (!current.logo || current.logo.includes('dummy-logo')) filled.logo = LOGO; // old dummy logo -> real logo
  for (const key of ['featured', 'about']) {
    const photo = toPhoto(filled[key]?.image);
    if (photo !== filled[key]?.image) {
      filled[key].image = photo;
      swapped += 1;
    }
  }
  console.log(`Swapped ${swapped} coloured dummy boxes for dummy photos`);
  doc.set(filled);
  await doc.save();
  console.log('Website settings ready');
} catch (error) {
  console.error('Failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
