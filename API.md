# Shyam Garba API

Base URL: `<server>/api` (for example `http://localhost:5000/api`).

- Send JSON with the header `Content-Type: application/json`.
- Protected routes need the header `Authorization: Bearer <token>`.
- Errors always look like `{ "success": false, "message": "..." }`.
- Lists accept `?page=1&limit=20` and return `total`, `page` and `pages`.
- Image paths such as `/uploads/photos/x.jpg` are served from the server root: `<server>/uploads/photos/x.jpg`.

**Who can call what**

| Label | Meaning |
|---|---|
| Public | No token needed |
| Logged in | Any valid token, including members still waiting for approval |
| Member | Approved member or admin |
| Admin | Super Admin only |

New members start as `pending`. They can log in, see their own profile and edit it. Every other member route returns `403 "Your account is waiting for admin approval"` until the admin approves them. Blocked members get `403` on every request.

---

## 1. Auth

| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/auth/google` | Public | `{ idToken }`: Firebase ID token after Sign in with Google |
| POST | `/auth/login` | Public | `{ email, password }`: website (admin at `/admin/login`, members at `/login`) |
| POST | `/auth/register` | Public | `{ name, email, password }` |
| GET | `/auth/me` | Logged in | |
| POST | `/auth/fcm-token` | Logged in | `{ token }`: Firebase device token for push |
| DELETE | `/auth/fcm-token` | Logged in | `{ token }`: call this on logout |

Every login returns `{ token, user }`. `/auth/google` also returns `isNewUser`.

**Mobile login flow**
1. Flutter signs in with Google through Firebase Auth, then calls `user.getIdToken()`.
2. Send the ID token to `POST /auth/google` and save the returned `token`.
3. Send the device token to `POST /auth/fcm-token`.
4. If `user.status === "pending"`, show a "waiting for approval" screen and the profile form.

## 2. Profile

| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/profile` | Logged in | |
| PUT | `/profile` | Logged in | any of the fields below |
| POST | `/profile/photo` | Logged in | multipart form, field `photo` (JPG, PNG or WEBP, max 2 MB) |

```json
{
  "name": "Ramesh Patel",
  "mobile": "9876543210",
  "address": "12, Shanti Nagar",
  "area": "Varachha",
  "city": "Surat",
  "location": { "lat": 21.2, "lng": 72.85 },
  "bloodGroup": "B+",
  "emergencyContact": { "name": "Seema", "mobile": "9876500000" },
  "business": { "name": "Patel Gems", "address": "...", "mobile": "9876511111", "category": "<categoryId>" }
}
```
`bloodGroup` must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-. Send `null` to clear a field.

All mobile numbers (`mobile`, `emergencyContact.mobile`, `business.mobile`, venue `contactNumber`) must be a 10-digit Indian mobile number starting with 6-9. A `+91` or `91` prefix is allowed.

## 3. Member directory and map

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/members` | Member | `?q=` (name, business or mobile) `&category=<id>&area=&bloodGroup=B%2B` |
| GET | `/members/map` | Member | every approved member who has a `location` |
| GET | `/members/:id` | Member | |

For one-tap actions: call with `tel:<mobile>` and open WhatsApp with `https://wa.me/91<mobile>`.

## 4. Categories and Garba class venues

| Method | Path | Who |
|---|---|---|
| GET | `/categories` | Logged in (admin can add `?all=true` to include inactive ones) |
| POST, PUT `/:id`, DELETE `/:id` | `/categories` | Admin. Body: `{ name, isActive }` |
| GET | `/venues`, `/venues/:id` | Member |
| POST, PUT `/:id`, DELETE `/:id` | `/venues` | Admin |

Venue body: `{ name, address, area, city, location: { lat, lng }, contactPerson, contactNumber, timings, isActive }`. For directions, open `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`.

## 5. Events

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/events` | Member | `?when=upcoming\|past\|all`. Members only see published events. Admin can add `&status=` |
| GET | `/events/:id` | Member | admin also receives `scanCode` |
| POST | `/events` | Admin | publishing sends a notification to all members |
| PUT | `/events/:id` | Admin | |
| DELETE | `/events/:id` | Admin | fails with 409 if the event has bookings; add `?force=true` to delete it together with its bookings |
| POST | `/events/:id/banner` | Admin | multipart form, field `banner` |
| POST | `/events/:id/scan-code` | Admin | creates a new secret code and removes all existing scanners |
| GET | `/events/:id/stats` | Admin | seats left, bookings, collection, entries scanned |
| GET | `/events/:id/bookings` | Admin | `?status=` |
| GET | `/events/:id/bookings/export` | Admin | Excel file |

```json
{
  "title": "Navratri Night 2026",
  "description": "...",
  "startAt": "2026-10-25T19:00:00+05:30",
  "endAt": "2026-10-25T23:30:00+05:30",
  "bookingDeadline": "2026-10-24T23:59:00+05:30",
  "venueId": "<venueId>",
  "price": 499,
  "seatLimit": 300,
  "maxSeatsPerBooking": 4,
  "status": "published",
  "formFields": [
    { "key": "tshirt", "label": "T-shirt size", "type": "select", "options": ["S", "M", "L"], "required": true },
    { "key": "age", "label": "Age", "type": "number" }
  ]
}
```
- Instead of `venueId`, you can send `venue: { name, address, location }` directly.
- Field `type` can be: text, textarea, number, email, phone, date, select.
- `price` is in rupees. A price of `0` makes it a free event.

## 6. Booking and payment (Razorpay)

| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/bookings` | Member | `{ eventId, seats, formData: { tshirt: "M", age: 30 } }` |
| POST | `/bookings/verify-payment` | Member | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` |
| GET | `/bookings/my` | Member | booking history |
| GET | `/bookings/:id` | Member (own booking) | the pass. Show `passCode` as a QR code |
| POST | `/payments/webhook` | Razorpay servers | set this URL in the Razorpay dashboard |

**Flow**
1. `POST /bookings`
   - Free event: the response has `paymentRequired: false` and the booking is already confirmed with its `passCode`.
   - Paid event: the response has `paymentRequired: true` and a `razorpay` object `{ keyId, orderId, amount, currency, name, email, contact }`. Seats are held for **15 minutes**.
2. Open Razorpay Checkout in Flutter (`razorpay_flutter`) with `key: keyId` and `order_id: orderId`.
3. On success, send the 3 values Razorpay returns to `POST /bookings/verify-payment`. You get back the confirmed booking with its `passCode`.
4. If the app closes before step 3, the webhook still confirms the booking.

Webhook setup: in the Razorpay Dashboard, go to Webhooks and use the URL `<server>/api/payments/webhook`. Select the events `payment.captured` and `order.paid`. The secret goes into `RAZORPAY_WEBHOOK_SECRET`.

If someone pays after their 15 minutes ran out and the seats are already gone, the booking becomes `failed` with `refundRequired: true`. Admin finds these with `GET /admin/payments?refundRequired=true` and refunds them from the Razorpay dashboard.

## 7. Entry scanning

| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/scan/access` | Member | `{ code }`: the event's secret code from the admin |
| GET | `/scan/events` | Member | events I can scan for |
| POST | `/scan/verify` | Member with access | `{ eventId, passCode }`: passCode read from the QR |

`/scan/verify` responses:
- `200 "Entry allowed"`
- `409 "This pass was already used"`, including who scanned it and when
- `400` for a pass from a different event or an unpaid booking
- `404` for an invalid pass

Every response includes `pass.member` (name, photo, mobile) and `pass.seats`.

## 8. Business tracking

| Method | Path | Who | Body |
|---|---|---|---|
| POST | `/business` | Member | `{ memberId, type: "given" \| "received", amount, date, note }` |
| GET | `/business` | Member | `?type=given\|received`. Each entry includes `type` from my side |
| GET | `/business/summary` | Member | `{ given: { total, count }, received: { total, count } }` |
| DELETE | `/business/:id` | Member who recorded it | |

## 9. Notifications

| Method | Path | Who | Body |
|---|---|---|---|
| GET | `/notifications` | Member | newest first |
| POST | `/notifications` | Admin | `{ title, body }`: saved to the list and sent as a push to all approved members |
| DELETE | `/notifications/:id` | Admin | removes it from the members' list |

Push `data` contains `type` (`event`, `announcement` or `approved`) plus `eventId` or `notificationId`.

## 10. Super Admin

All routes here are Admin only.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/dashboard` | members by status, new registrations, upcoming events, bookings, payment collection |
| GET | `/admin/members` | `?status=pending\|approved\|blocked&q=&category=&area=&bloodGroup=` |
| GET | `/admin/members/export` | Excel file, same filters as the list |
| GET | `/admin/members/:id` | full details, recent bookings, business totals |
| PATCH | `/admin/members/:id/status` | `{ status: "approved" \| "blocked" \| "pending" }`. Approving sends a push |
| PUT | `/admin/members/:id` | edit profile (same fields as `PUT /profile`) |
| DELETE | `/admin/members/:id` | |
| GET | `/admin/activity` | activity log, `?user=<id>&action=` |
| DELETE | `/admin/activity/:id` | delete one activity record |
| GET | `/admin/business/report` | `?from=&to=`: totals, top givers, top receivers |
| GET | `/admin/business/entries` | every business entry, `?from=&to=&page=` |
| DELETE | `/admin/business/entries/:id` | delete a business entry |
| GET | `/admin/payments` | `?status=&event=&refundRequired=true&from=&to=` |
| DELETE | `/admin/bookings/:id` | delete a booking; seats of a pending/confirmed booking go back to the event (refund from Razorpay yourself) |
| GET | `/admin/events/report` | bookings, collection and entries for every event |

To create the first admin account, run `npm run create-admin -- admin@example.com StrongPass123 "Super Admin"`.

## 11. Public website

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/public/home` | Public | landing page data: `stats` (approved members, venues, upcoming events), active `venues`, next 6 published `events` |

`/public/home` also returns `settings` (all website texts/images) and `content` (`ticker`, `sponsor`, `course`, `location`, `testimonial`, `team`, `gallery`, `feature`, `faq`, `contact`, `footerLink` lists, only visible items, sorted by `order`).

## 12. Website content (Admin > Website)

All routes are Admin only.

| Method | Path | Notes |
|---|---|---|
| GET, PUT | `/admin/site/settings` | logo, site name, theme colours/font, hero, section on/off switches, section headings, featured/about blocks, app links, footer |
| GET | `/admin/site/items` | `?type=ticker\|sponsor\|course\|location\|testimonial\|team\|gallery\|feature\|faq\|contact\|footerLink` |
| POST, PUT `/:id`, DELETE `/:id` | `/admin/site/items` | `{ type, title, subtitle, text, image, image2, icon, linkText, link, order, isActive }` |
| POST | `/admin/site/upload` | multipart field `image` (JPG/PNG/WEBP, max 5 MB). Returns `{ path }` |

Dummy content for every section: `npm run seed-website` (only if empty) or `npm run seed-website -- --reset` (replaces everything).
