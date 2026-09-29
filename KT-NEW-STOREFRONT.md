# KT — Cloning the CRM for a New Storefront

**Audience:** Whoever is standing up the admin/back-office CRM for a new storefront.
**Source project:** `crmNext` (the "Plattera" gifting storefront back-office).
**Goal of this doc:** Everything you need to clone this repo, understand the **seed/database setup**, and safely re-brand it for a different storefront.

> ⚠️ The existing `SETUP.md` is slightly stale (it says "Next.js 14 / 20 tables"). Trust **this** doc and the actual `prisma/schema.prisma` — the app is on **Next.js 16 (App Router)** with ~**40 Prisma models**.

---

## 1. What this project actually is

This repo is **not** the storefront. It's the **admin panel + a public API bridge** that a separate storefront website consumes. Two distinct surfaces live in one Next.js app:

| Surface | Path | Who uses it | Auth |
|---|---|---|---|
| **Admin panel** | `app/(dashboard)/*` | Internal staff (manage catalog, orders, returns, promos, etc.) | NextAuth v5 (JWT), admin users table |
| **Storefront bridge API** | `app/api/store/*` | The public storefront website (a *separate* app/repo) | Public + CORS; customer auth via email-OTP |

So for a new storefront you typically clone **this** back-office, point it at a **fresh database**, re-seed with the new brand's catalog, and set `STORE_ORIGIN` to the new storefront's URL.

### Stack
- **Framework:** Next.js 16, App Router (`app/` dir, API routes as `route.ts`)
- **Styling:** Tailwind CSS v4
- **ORM:** Prisma v6 → **PostgreSQL**
- **Admin auth:** NextAuth.js v5 (JWT sessions) — `lib/auth.ts`
- **Customer auth (storefront):** email OTP — `lib/customer-auth.ts`, `email_otps` table
- **Email:** Nodemailer (`lib/mailer.ts`) driven by `notification_templates`
- **Excel exports:** `exceljs` (reports)

> 📌 **Read before coding:** `AGENTS.md` warns this Next.js version has breaking changes vs. what you may know. Check `node_modules/next/dist/docs/` before writing route/handler code.

---

## 2. First-time setup (fresh clone → running app)

```bash
# 1. Install
npm install                      # postinstall runs `prisma generate`

# 2. Environment
cp .env.example .env             # then edit — see §3

# 3. Create the schema in your DB
npm run db:push                  # prisma db push (no migrations folder; schema-push workflow)

# 4. Seed (ORDER MATTERS — see §4)
npm run db:seed                  # admin user + settings + reasons   (REQUIRED)
npm run db:seed:catalog          # categories + demo products        (REQUIRED for storefront)
npm run db:seed:notifications    # email/SMS templates               (REQUIRED for emails)

# 5. Run
npm run dev                      # http://localhost:3000
```

**Admin login:** `admin@crm.com` / `admin123` (created by `db:seed`). **Change this before any real deployment.**

Useful scripts (from `package.json`):
| Script | Does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | `prisma generate && next build` |
| `npm run db:push` | Push `schema.prisma` to the DB (no migration files) |
| `npm run db:studio` | Prisma Studio (browse/edit data in a GUI) |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Core seed |
| `npm run db:seed:catalog` | Catalog seed |
| `npm run db:seed:notifications` | Notification-templates seed |

---

## 3. Environment variables (`.env`)

Copy from `.env.example`. The ones that matter most:

| Var | Why it matters |
|---|---|
| `DATABASE_URL` | Postgres connection. **Use a brand-new empty DB per storefront** — never share one. |
| `NEXTAUTH_SECRET` | Admin JWT signing. Generate: `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | Admin app URL (e.g. `http://localhost:3000`). |
| `STORE_ORIGIN` | 🔑 **CORS allow-origin for `/api/store/*`.** Set to the **new storefront's URL** in prod. `"*"` is fine only in dev. |
| `NEXT_PUBLIC_APP_NAME` | Admin panel display name. |
| `SMTP_*` | Email sending (order/return/reminder mails). Without these, notifications won't send. |
| `CRON_SECRET` | Protects `/api/cron/occasion-reminders`. Sent via `x-cron-secret` header or `?secret=`. |
| `OCCASION_REMINDER_LEAD_DAYS` | Days before birthday/anniversary to email (default 7). |
| `CART_ABANDONMENT_HOURS` / `_COOLDOWN_DAYS` | Abandoned-cart email timing. |
| `CLOUDINARY_*` **or** `AWS_*` | Image storage — pick one for product/banner uploads. |

---

## 4. The seed system — READ THIS CAREFULLY

There are **6 seed files** in `prisma/`. They are **not** all wired the same way, and **not** all idempotent. This is the part most likely to bite you.

### 4a. Seed files at a glance

| File | npm script? | What it creates | Idempotent? | Depends on |
|---|---|---|---|---|
| `seed.ts` | ✅ `db:seed` | 1 admin user, 1 `settings` row, 5 cancellation reasons, 5 return reasons | ✅ (upsert by email/id; reasons `create` each run) | nothing |
| `seed-catalog.ts` | ✅ `db:seed:catalog` | 10 categories (+1 subcategory each), 14 demo products (+1 variation each) | ✅ (upsert by slug; products skipped if `urlSlug` exists) | nothing |
| `seed-notifications.ts` | ✅ `db:seed:notifications` | 12 email/SMS templates (order lifecycle, returns, warranty, occasion, cart) | ✅ (upsert by `event`; never clobbers admin edits) | nothing |
| `seed-orders.ts` | ❌ manual | 15 dummy orders across all statuses | ❌ **creates new rows every run** | **needs products first** |
| `seed-phase4.ts` | ❌ manual | ~5 returns + 5 warranty claims | partial (returns upsert by orderDetail; warranties `create`) | **needs orders first** |
| `seed-phase5.ts` | ❌ manual | 4 promo codes + 2 home banners | ❌ **banners created every run** | nothing |

> ⚠️ **`seed.ts` reasons are `create`, not upsert** — re-running `db:seed` on a populated DB will duplicate the cancellation/return reasons. On a fresh DB it's fine. Run it **once**.

### 4b. Running the manual (non-npm) seeds — Windows gotcha

The order/phase seeds aren't in `package.json`. Run them via `ts-node` with the module override (needed on Windows/CommonJS):

```bash
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-orders.ts
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-phase4.ts
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-phase5.ts
```

### 4c. Recommended seed order for a fresh storefront

```
db:push
  └─ db:seed                 # admin + settings + reasons   (MUST run, once)
     └─ db:seed:catalog      # categories + products        (MUST run for storefront)
        └─ db:seed:notifications   # email templates        (MUST run for emails)
           └─ (optional demo data, in this order:)
              seed-orders.ts        # needs products
              seed-phase4.ts        # needs orders
              seed-phase5.ts        # promos + banners
```

**Minimum viable for a real (non-demo) storefront:** `db:seed` + `db:seed:catalog` (replace demo products with real ones) + `db:seed:notifications`. Skip `seed-orders/phase4/phase5` — those are test fixtures only.

### 4d. What the seeds actually put in the DB

- **`seed.ts`** → `admin@crm.com`/`admin123` (bcrypt, 12 rounds), a `settings` row (`deliveryFee: 50`), and reason lookup lists used by the returns/cancellation UI.
- **`seed-catalog.ts`** → the **10 nav categories** (Hampers, Awards, Drinkware, Leather, Apparel, Tech, Gourmet, Stationery, Eco-Friendly, Plants) each with one subcategory, and **14 gifting products** with pricing (`price` = MRP, `specialPrice` = selling), stock, and merchandising flags (`isBestSeller`, `isNew`, `isFeatured`, `personalization`). Product images point at `/products/<slug>-1.jpg` placeholders.
- **`seed-notifications.ts`** → templates keyed by `event` (`ORDER_PLACED`, `ORDER_SHIPPED`, `OCCASION_REMINDER`, `CART_ABANDONMENT`, …) with `{{variable}}` placeholders substituted at send time.

---

## 5. 🔁 Re-branding checklist (the whole point)

Everything below is **hardcoded to "Plattera"** and must change for the new storefront:

1. **`prisma/seed-catalog.ts`** — replace the `CATEGORIES` and `PRODUCTS` arrays with the new brand's taxonomy and catalog. Keep the 10 categories aligned with whatever the new storefront's nav expects, or the storefront will show empty sections.
2. **`prisma/seed-notifications.ts`** — every template says "Plattera" and "— Team Plattera". Find/replace with the new brand name and tone.
3. **`.env`** — new `DATABASE_URL`, new `STORE_ORIGIN` (the new storefront URL), new `SMTP_FROM`, new `NEXT_PUBLIC_APP_NAME`.
4. **`seed.ts`** — change the admin email/password and the `settings.email` before going live.
5. **`seed-phase5.ts`** (if used) — the demo banners point at Unsplash "cookware" images; swap or drop them.
6. **Settings row** — after seeding, set phone/whatsapp/support email/instagram/linkedin from the admin **Settings** page (these feed the storefront footer/contact).
7. **Home banners** — set real banners in the admin (or via seed-phase5) so the storefront hero isn't empty.

> The catalog is designed to be **swapped for the client's real Excel data later** (see the comment at the top of `seed-catalog.ts`). The demo products are placeholders.

---

## 6. Database schema — the model map

40 models, PostgreSQL, defined in `prisma/schema.prisma`. Grouped by area:

**Auth & people**
- `users` (`UserRole`: SUPER_ADMIN / ADMIN / STAFF) — admin panel accounts
- `customers` — storefront shoppers (has `dob`, `anniversary` → powers occasion reminders; `company`)
- `customer_addresses` — saved delivery addresses
- `email_otps` — storefront email-OTP login (hashed, single-use)

**Catalog**
- `categories` (HSN/GST, slug, `isFeatured`) → `sub_categories` → `products`
- `products` — images as **JSON array**; storefront merchandising fields (`giftMode`, `occasions[]`, `recipients[]`, `hamperTier`, `badge`, `personalizationEnabled/Price`, `rating`, `reviewCount`)
- `product_variations` — the real **SKU / price / stock / dimensions** rows (a product with no variation has no price!)
- `attributes` + `product_attribute_values` — Color/Size etc.
- `product_tags` + `product_tag_maps`, `product_types`
- `reviews`, `blogs`, `store_enquiries` (lead capture)

**Promotions**
- `promocodes` — **`discountType`: 1 = percentage, 2 = flat ₹**; `useTime` = allowed uses; `maximumCap` = max discount; `isFirstOrder`
- pivots: `product_promocodes`, `subcategory_promocodes`, `customer_promocodes` (usage tracking)

**Orders**
- `order_masters` — order header (customer snapshot, address, totals, `OrderStatus` enum, `PaymentMode` RAZORPAY/COD, Razorpay fields)
- `order_details` — line items; carries **ShipRocket** fields (awb, shipment id, label url)
- `order_edits` + `order_edit_items` — post-order edits (audit trail, `editedBy` → users)
- `shipments` + `shipment_events` — tracking timeline

**Post-sale**
- `return_orders` (`ReturnStatus`), `return_reasons`, `cancellation_reasons`, `warranty_claims` (`WarrantyStatus`)

**Cart & content & config**
- `carts` (guest via `guestToken` + logged-in; `personalization` JSON), `wishlists`
- `home_banners` (`mode`: corporate/personal/both), `settings`, `states`
- `notification_templates`, `notification_logs`
- `tax_rules`, `payment_providers`

**Enums:** `UserRole`, `OrderStatus` (PAYMENT_PENDING → PLACED → PROCESSING → SHIPPED → DELIVERED → COMPLETED / CANCELLED / REFUNDED), `PaymentMode`, `ReturnStatus`, `WarrantyStatus`.

> The schema is a Prisma **translation of an older Laravel/PHP app** — `@@map` keeps the original snake_case table names, and some fields (Razorpay, ShipRocket) are carried over even if not wired yet. A few tables near the middle of the schema were introspected back from a live DB (marked "reconciled from the live DB").

---

## 7. Storefront bridge API (`/api/store/*`)

This is the contract the **new storefront** talks to. All routes:
- are **public** (no admin auth),
- send **CORS headers** from `lib/store.ts` (`corsHeaders()` uses `STORE_ORIGIN`),
- export `OPTIONS = handleOptions` for preflight.

**Set `STORE_ORIGIN` to the storefront's exact URL in production**, or the browser will block requests.

Available endpoints (folders under `app/api/store/`):
`products` · `products/[slug]` · `categories` · `banners` · `blogs` · `blogs/[slug]` · `settings` · `promocodes` + `promocodes/validate` · `reviews` · `enquiries` · `wishlist` · `cart` (+ `cart/merge`, `cart/[id]`) · `addresses` · `profile` · `auth` (`request-otp`, `verify-otp`, `me`, `smtp-check`).

**Product shaping** (`lib/store.ts`) is the piece to understand:
- `shapeProductCard(p)` — grid/list shape: `id` = `urlSlug`, cheapest variation's `price` + `compareAtPrice`, images, badge (explicit `badge` wins, else derived from flags), `inStock`, plus merchandising fields.
- `shapeProductDetail(p)` — card fields + full description + all variations + personalization block.

So the storefront keys products by **`urlSlug`**, and price comes from the **cheapest variation** (`specialPrice ?? price`). A product with **no variation shows price 0** — always seed at least one variation per product.

---

## 7b. Full API reference

All routes live under `app/api/` as `route.ts` files (App Router). Methods listed are the ones each file actually exports. Store routes also export `OPTIONS` (CORS preflight) — omitted below for brevity except where relevant.

### Admin API (`/api/*`) — requires admin auth

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | — | NextAuth handler (login/session) |
| `/api/users` | GET, POST | Admin users list / create |
| `/api/users/[id]` | DELETE | Delete admin user |
| `/api/customers` | GET | Storefront customers list |
| `/api/customers/[id]` | GET, PUT | Customer detail / update |
| `/api/categories` | GET, POST | Categories |
| `/api/categories/[id]` | GET, PUT, DELETE | Category CRUD |
| `/api/subcategories` | GET, POST | Subcategories |
| `/api/subcategories/[id]` | GET, PUT, DELETE | Subcategory CRUD |
| `/api/products` | GET, POST | Products |
| `/api/products/[id]` | GET, PUT, DELETE | Product CRUD |
| `/api/attributes` | GET, POST | Attributes (Color/Size…) |
| `/api/product-tags` | GET, POST | Product tags |
| `/api/product-tags/[id]` | PUT, DELETE | Tag update/delete |
| `/api/promocodes` | GET, POST | Promo codes |
| `/api/promocodes/[id]` | GET, PUT, DELETE | Promo CRUD |
| `/api/orders` | GET | Orders list |
| `/api/orders/[id]` | GET | Order detail |
| `/api/orders/[id]/status` | PUT | Update order status |
| `/api/order-edits` | GET, POST | Post-order edit requests |
| `/api/order-edits/[id]` | PUT | Confirm/cancel an edit |
| `/api/shipments` | POST | Create shipment |
| `/api/shipments/[orderDetailId]` | GET, PUT | Shipment tracking / update |
| `/api/returns` | GET | Return requests |
| `/api/returns/[id]` | GET, PUT | Return detail / approve-reject |
| `/api/warranties` | GET | Warranty claims |
| `/api/warranties/[id]` | GET, PUT | Warranty detail / status |
| `/api/reviews` | GET | Reviews moderation list |
| `/api/reviews/[id]` | PATCH | Approve/reject a review |
| `/api/banners` | GET, POST | Home banners |
| `/api/banners/[id]` | PUT, DELETE | Banner update/delete |
| `/api/blogs` | GET, POST | Blog posts |
| `/api/blogs/[id]` | GET, PUT, DELETE | Blog CRUD |
| `/api/blogs/diag` | GET | Blog diagnostics |
| `/api/enquiries` | GET | Storefront leads/enquiries |
| `/api/notifications` | GET, POST | Notification templates |
| `/api/notifications/[id]` | PUT | Update a template |
| `/api/settings` | GET, PUT | Global settings |
| `/api/tax-rules` | GET, POST | Tax rules |
| `/api/tax-rules/[id]` | PUT, DELETE | Tax rule update/delete |
| `/api/payment-providers` | GET, POST | Payment providers |
| `/api/payment-providers/[id]` | PUT | Provider update |
| `/api/reports` | GET | Reports data |
| `/api/reports/export` | GET | Excel export (`exceljs`) |
| `/api/cron/occasion-reminders` | GET, POST | Birthday/anniversary emails (needs `CRON_SECRET`) |
| `/api/cron/cart-abandonment` | GET, POST | Abandoned-cart emails (needs `CRON_SECRET`) |

### Storefront bridge API (`/api/store/*`) — public + CORS

Every route also exports `OPTIONS` for CORS preflight (via `handleOptions`).

| Route | Methods | Purpose |
|---|---|---|
| `/api/store/products` | GET | Product listing (filters: `q`, `category`, `subcategory`, `badge`, `minPrice`, `maxPrice`, `sort`, `page`, `limit`) |
| `/api/store/products/[slug]` | GET | Product detail (keyed by `urlSlug`) |
| `/api/store/products/[slug]/reviews` | GET | Reviews for a product |
| `/api/store/categories` | GET | Category/subcategory tree (nav) |
| `/api/store/banners` | GET | Home banners |
| `/api/store/blogs` | GET | Blog list |
| `/api/store/blogs/[slug]` | GET | Blog detail |
| `/api/store/settings` | GET | Public settings (footer/contact/social) |
| `/api/store/promocodes/validate` | POST | Validate a promo code against a cart |
| `/api/store/reviews` | POST | Submit a review |
| `/api/store/enquiries` | POST | Contact/newsletter/quote/vendor forms |
| `/api/store/wishlist` | GET, POST | Wishlist read / add |
| `/api/store/wishlist/[slug]` | DELETE | Remove from wishlist |
| `/api/store/cart` | GET, POST | Cart read / add item |
| `/api/store/cart/[id]` | PATCH, DELETE | Update qty / remove line |
| `/api/store/cart/merge` | POST | Merge guest cart into logged-in cart on login |
| `/api/store/addresses` | GET, POST | Saved addresses list / add |
| `/api/store/addresses/[id]` | PATCH, DELETE | Address update/delete |
| `/api/store/profile` | GET, PATCH | Customer profile (name, company, dob, anniversary…) |
| `/api/store/auth/request-otp` | POST | Send email login OTP |
| `/api/store/auth/verify-otp` | POST | Verify OTP → session |
| `/api/store/auth/me` | GET, POST | Current logged-in customer |
| `/api/store/auth/smtp-check` | GET | Diagnose SMTP config (is email working?) |

> **Guest cart:** the storefront passes an `X-Guest-Token` header (allowed in `corsHeaders`) so a not-yet-logged-in visitor keeps a cart; `cart/merge` folds it into the customer's cart at login.

---

## 8. Cron / background jobs

- `POST /api/cron/occasion-reminders` — emails customers before their `dob`/`anniversary`. Protect with `CRON_SECRET`. Schedule it (Vercel Cron / external scheduler) to hit the endpoint daily.
- Cart-abandonment emails are governed by `CART_ABANDONMENT_HOURS` / `_COOLDOWN_DAYS`.

---

## 9. Gotchas / things that will trip you up

1. **No migrations folder** — this is a `db push` (schema-sync) workflow, not `prisma migrate`. Don't look for a migrations history; the schema *is* the source of truth.
2. **`seed-orders/phase4/phase5` aren't npm scripts** and aren't idempotent — run them manually, once, only for demo data.
3. **Re-running `db:seed`** duplicates cancellation/return reasons. Run once per fresh DB.
4. **`STORE_ORIGIN="*"` in prod = insecure CORS.** Lock it to the storefront URL.
5. **Products need variations** or they're priced 0 and show out-of-stock on the storefront.
6. **Everything says "Plattera"** — do the §5 re-brand pass before showing anyone.
7. **`SETUP.md` is outdated** (Next 14 / 20 tables) — use this doc + the live schema.
8. **Windows shell:** the manual seeds need the `--compiler-options "{\"module\":\"CommonJS\"}"` flag.

---

## 10. Quick reference card

```text
Login (dev):        admin@crm.com / admin123
Dev URL:            http://localhost:3000
DB workflow:        prisma db push  (NO migrations)
Core seeds:         db:seed → db:seed:catalog → db:seed:notifications
Demo seeds:         seed-orders → seed-phase4 → seed-phase5  (manual, ts-node)
Storefront CORS:    STORE_ORIGIN env  (set to storefront URL)
Product key:        urlSlug ; price = cheapest variation
Promo discountType: 1 = percent, 2 = flat ₹
Brand to replace:   "Plattera" in seed-catalog.ts + seed-notifications.ts
```
