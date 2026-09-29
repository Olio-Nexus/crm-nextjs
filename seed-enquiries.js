/**
 * Temporary seed: sample storefront leads so the CRM → Leads page + detail
 * popup can be tried locally. Safe to run more than once (adds fresh rows).
 * Run:  node seed-enquiries.js    (from the crmNext project root)
 */
const fs = require("fs");
const path = require("path");

// Load DATABASE_URL from .env if the shell didn't already provide it.
if (!process.env.DATABASE_URL) {
  try {
    const env = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of env.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"#]+)"?\s*$/);
      if (m) {
        process.env.DATABASE_URL = m[1].trim();
        break;
      }
    }
  } catch {
    /* ignore — will fail loudly below if unset */
  }
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const rows = [
  {
    // Product-specific quote (from a product page) — exercises the product
    // highlight in the table + popup.
    type: "quote",
    name: "Priya Sharma",
    email: "priya.sharma@acmecorp.co",
    phone: "+91 98200 11223",
    message:
      "We'd like these for our Diwali employee gifting. Please share branding options and lead time.",
    payload: {
      product: "Stanley Style Sipper",
      productSlug: "stanley-style-sipper",
      company: "Acme Corp",
      quantity: "100 - 250",
      deliveryDate: "2026-10-15",
      occasion: "Diwali",
      customization: ["Logo Printing", "Custom Message Card"],
      source: "bulk-quote",
    },
  },
  {
    // General quote (from the corporate "Request a Quote" section) — no product.
    type: "quote",
    name: "Rahul Mehta",
    email: "rahul@brightlabs.in",
    phone: "+91 99870 45566",
    message: "Looking for premium welcome kits for 50 new joiners this quarter.",
    payload: {
      company: "Bright Labs",
      occasion: "Onboarding",
      quantity: "50",
      budget: "Rs 1,500 - 2,500 per kit",
    },
  },
  {
    type: "vendor",
    name: "Anil Gupta",
    email: "anil@giftsource.com",
    phone: "+91 90040 22110",
    message:
      "We manufacture eco-friendly drinkware and would like to explore a supply partnership.",
    payload: {
      company: "GiftSource Pvt Ltd",
      category: "Drinkware",
      website: "https://giftsource.com",
    },
  },
  {
    type: "contact",
    name: "Sneha Iyer",
    email: "sneha.iyer@gmail.com",
    phone: "+91 91230 99887",
    message:
      "Do you deliver to Bengaluru for personal birthday gifts? Need it by this weekend.",
  },
  {
    type: "brochure",
    name: "Karan Malhotra",
    email: "karan.m@fintechco.in",
    phone: "+91 98111 33445",
    payload: { catalogue: "Diwali", occasion: "Diwali" },
  },
  {
    type: "newsletter",
    email: "hello.subscriber@example.com",
  },
];

async function main() {
  // Additively ensure the table exists (local DB is behind the schema).
  // Column names/types mirror the Prisma StoreEnquiry model so the client works.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS store_enquiries (
      id        SERIAL PRIMARY KEY,
      type      TEXT NOT NULL,
      name      TEXT,
      email     TEXT,
      phone     TEXT,
      message   TEXT,
      payload   JSONB,
      status    TEXT NOT NULL DEFAULT 'new',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const data of rows) {
    await prisma.storeEnquiry.create({ data });
  }
  const total = await prisma.storeEnquiry.count();
  console.log(`✓ Seeded ${rows.length} sample leads. Total store_enquiries now: ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e.message || e);
    await prisma.$disconnect();
    process.exit(1);
  });
