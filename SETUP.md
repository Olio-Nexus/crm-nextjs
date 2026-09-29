# CRM — Next.js + Node.js Setup Guide

## Stack
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: NextAuth.js v5 (JWT sessions)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and NEXTAUTH_SECRET
```

### 3. Set up the database
```bash
# Push schema to your PostgreSQL database
npx prisma db push

# Seed with admin user + default data
npx prisma db seed
# Login: admin@crm.com / admin123
```

### 4. Run the dev server
```bash
npm run dev
# Open http://localhost:3000
```

---

## nv Schema — 20 Tables

| Table | Purpose |
|---|---|
| `users` | Admin panel users (SUPER_ADMIN / ADMIN / STAFF) |
| `customers` | Storefront customers |
| `customer_addresses` | Saved delivery addresses |
| `categories` | Product categories (with HSN/GST) |
| `sub_categories` | Product subcategories |
| `products` | Products (images as JSON array) |
| `product_variations` | SKUs with price/stock/dimensions |
| `attributes` | Attribute definitions (Color, Size…) |
| `product_attribute_values` | Variation ↔ attribute values |
| `promocodes` | Discount codes (% or flat) |
| `product_promocodes` | Promo ↔ product pivot |
| `subcategory_promocodes` | Promo ↔ subcategory pivot |
| `customer_promocodes` | Customer promo usage tracking |
| `order_masters` | Order header (customer, address, totals) |
| `order_details` | Order line items (with ShipRocket fields) |
| `return_orders` | Return requests |
| `return_reasons` | Return reason options |
| `cancellation_reasons` | Cancellation reason options |
| `warranty_claims` | Warranty claim submissions |
| `carts` | Shopping cart (guest + logged-in) |
| `wishlists` | Customer wishlists |
| `home_banners` | Homepage banner images |
| `settings` | Global config (delivery fee, emails) |
| `states` | Indian states reference list |

## Key Decisions vs PHP

| PHP | Next.js |
|---|---|
| Laravel Shield roles | `UserRole` enum on `users` table |
| `money('INR')` | `formatINR()` in `lib/utils.ts` |
| `order_status` enum strings | `OrderStatus` Prisma enum (SCREAMING_SNAKE) |
| `images` JSON column | Prisma `Json` type, typed as `string[]` in app |
| ShipRocket fields | Preserved on `order_details` |
| Razorpay fields | Preserved on `order_masters` |

## Next Steps (Phase 2+)
- [ ] Phase 2: Products CRUD + Categories
- [ ] Phase 3: Orders list, detail view, status updates
- [ ] Phase 4: Returns + Refunds + Warranties
- [ ] Phase 5: Promo codes + Banners + Settings
- [ ] Phase 6: Reports + Excel exports
